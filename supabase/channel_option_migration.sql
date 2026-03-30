-- ============================================================
-- 채널 연동 & 상품 옵션 관리 마이그레이션
-- Supabase SQL Editor에서 전체 복사 후 한 번에 실행하세요
-- ============================================================


-- ============================================================
-- STEP 1. channels 테이블에 platform_type 컬럼 추가
-- ============================================================

ALTER TABLE public.channels
  ADD COLUMN IF NOT EXISTS platform_type text
  CHECK (platform_type IN ('naver', '11st', 'gmarket', 'auction', 'own', 'offline'));


-- ============================================================
-- STEP 2. 상품 옵션 그룹 (색상, 사이즈, 용량 등)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.product_option_groups (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id    uuid        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  display_order integer     DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_option_groups_product_idx
  ON public.product_option_groups (product_id);

ALTER TABLE public.product_option_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated can manage product_option_groups"
  ON public.product_option_groups;
CREATE POLICY "authenticated can manage product_option_groups"
  ON public.product_option_groups FOR ALL TO authenticated
  USING (true) WITH CHECK (true);


-- ============================================================
-- STEP 3. 상품 옵션값 (빨강, 파랑, S, M, L 등)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.product_option_values (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  option_group_id uuid        NOT NULL REFERENCES public.product_option_groups(id) ON DELETE CASCADE,
  value           text        NOT NULL,
  display_order   integer     DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_option_values_group_idx
  ON public.product_option_values (option_group_id);

ALTER TABLE public.product_option_values ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated can manage product_option_values"
  ON public.product_option_values;
CREATE POLICY "authenticated can manage product_option_values"
  ON public.product_option_values FOR ALL TO authenticated
  USING (true) WITH CHECK (true);


-- ============================================================
-- STEP 4. 상품 옵션 조합 (빨강+S, 빨강+M, 파랑+S 등)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.product_option_combinations (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id       uuid        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  option_value_ids jsonb       NOT NULL DEFAULT '[]',
  label            text        NOT NULL DEFAULT '',
  sku              text,
  add_price        integer     NOT NULL DEFAULT 0 CHECK (add_price >= 0),
  is_active        boolean     NOT NULL DEFAULT true,
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_option_combinations_product_idx
  ON public.product_option_combinations (product_id);

ALTER TABLE public.product_option_combinations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated can manage product_option_combinations"
  ON public.product_option_combinations;
CREATE POLICY "authenticated can manage product_option_combinations"
  ON public.product_option_combinations FOR ALL TO authenticated
  USING (true) WITH CHECK (true);


-- ============================================================
-- STEP 5. inventory 테이블에 option_combination_id 추가
--         기존 UNIQUE 제약 제거 → 부분 유니크 인덱스 2개로 교체
-- ============================================================

-- option_combination_id 컬럼 추가 (NULL = 옵션 없는 상품)
ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS option_combination_id uuid
  REFERENCES public.product_option_combinations(id) ON DELETE CASCADE;

-- 기존 UNIQUE 제약 안전하게 제거 (이름이 다를 수 있으므로 DO 블록 사용)
DO $$
DECLARE
  v_constraint text;
BEGIN
  SELECT tc.constraint_name INTO v_constraint
  FROM information_schema.table_constraints tc
  WHERE tc.table_schema = 'public'
    AND tc.table_name   = 'inventory'
    AND tc.constraint_type = 'UNIQUE'
  ORDER BY tc.constraint_name
  LIMIT 1;

  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.inventory DROP CONSTRAINT %I', v_constraint);
    RAISE NOTICE '기존 UNIQUE 제약 제거: %', v_constraint;
  ELSE
    RAISE NOTICE '제거할 UNIQUE 제약 없음 — 건너뜀';
  END IF;
END $$;

-- 옵션 없는 상품용 부분 유니크 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS inventory_no_option_unique
  ON public.inventory (product_id, business_id, warehouse_id)
  WHERE option_combination_id IS NULL;

-- 옵션 있는 상품용 부분 유니크 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS inventory_with_option_unique
  ON public.inventory (product_id, option_combination_id, business_id, warehouse_id)
  WHERE option_combination_id IS NOT NULL;


-- ============================================================
-- STEP 6. adjust_inventory RPC 업데이트
--         option_combination_id 파라미터 추가
-- ============================================================

-- 기존 함수 명시적 삭제 (파라미터 시그니처가 달라 오버로드 충돌 방지)
DROP FUNCTION IF EXISTS public.adjust_inventory(uuid, uuid, uuid, int, text);

CREATE OR REPLACE FUNCTION public.adjust_inventory(
  p_product_id            uuid,
  p_business_id           uuid,
  p_warehouse_id          uuid,
  p_quantity              int,
  p_note                  text DEFAULT NULL,
  p_option_combination_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_option_combination_id IS NULL THEN
    -- 옵션 없는 상품: 기존 방식 유지
    INSERT INTO public.inventory (product_id, business_id, warehouse_id, quantity, updated_at)
    VALUES (p_product_id, p_business_id, p_warehouse_id, GREATEST(0, p_quantity), now())
    ON CONFLICT (product_id, business_id, warehouse_id)
    WHERE option_combination_id IS NULL
    DO UPDATE SET
      quantity   = GREATEST(0, public.inventory.quantity + p_quantity),
      updated_at = now();
  ELSE
    -- 옵션 있는 상품: option_combination_id 포함
    INSERT INTO public.inventory (product_id, option_combination_id, business_id, warehouse_id, quantity, updated_at)
    VALUES (p_product_id, p_option_combination_id, p_business_id, p_warehouse_id, GREATEST(0, p_quantity), now())
    ON CONFLICT (product_id, option_combination_id, business_id, warehouse_id)
    WHERE option_combination_id IS NOT NULL
    DO UPDATE SET
      quantity   = GREATEST(0, public.inventory.quantity + p_quantity),
      updated_at = now();
  END IF;

  -- 재고 이력 기록
  BEGIN
    INSERT INTO public.stock_logs (
      product_id, business_id, warehouse_id,
      log_type, quantity, note, created_at
    ) VALUES (
      p_product_id, p_business_id, p_warehouse_id,
      'adjustment', p_quantity, p_note, now()
    );
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.adjust_inventory TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_inventory TO anon;


-- ============================================================
-- STEP 7. 채널-상품 매핑 테이블
--         NULL option_combination_id 중복 방지를 위해
--         UNIQUE 제약 대신 부분 유니크 인덱스 2개 사용
-- ============================================================

CREATE TABLE IF NOT EXISTS public.channel_product_mappings (
  id                    uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id           uuid        REFERENCES public.businesses(id) ON DELETE CASCADE,
  product_id            uuid        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  option_combination_id uuid        REFERENCES public.product_option_combinations(id) ON DELETE CASCADE,
  channel_id            uuid        NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  platform_product_id   text        NOT NULL,
  platform_option_id    text,
  sync_price            boolean     NOT NULL DEFAULT true,
  sync_inventory        boolean     NOT NULL DEFAULT true,
  last_synced_at        timestamptz,
  last_sync_status      text        CHECK (last_sync_status IN ('success', 'failed', 'pending')),
  last_sync_error       text,
  created_at            timestamptz DEFAULT now()
);

-- 옵션 없는 상품: (product_id, channel_id) 중복 방지
CREATE UNIQUE INDEX IF NOT EXISTS channel_mappings_no_option_unique
  ON public.channel_product_mappings (product_id, channel_id)
  WHERE option_combination_id IS NULL;

-- 옵션 있는 상품: (product_id, option_combination_id, channel_id) 중복 방지
CREATE UNIQUE INDEX IF NOT EXISTS channel_mappings_with_option_unique
  ON public.channel_product_mappings (product_id, option_combination_id, channel_id)
  WHERE option_combination_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS channel_mappings_product_idx
  ON public.channel_product_mappings (product_id);
CREATE INDEX IF NOT EXISTS channel_mappings_channel_idx
  ON public.channel_product_mappings (channel_id);

ALTER TABLE public.channel_product_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated can manage channel_product_mappings"
  ON public.channel_product_mappings;
CREATE POLICY "authenticated can manage channel_product_mappings"
  ON public.channel_product_mappings FOR ALL TO authenticated
  USING (true) WITH CHECK (true);


-- ============================================================
-- STEP 8. 채널 동기화 이력 테이블
-- ============================================================

CREATE TABLE IF NOT EXISTS public.channel_sync_logs (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid        REFERENCES public.businesses(id) ON DELETE SET NULL,
  product_id  uuid        REFERENCES public.products(id) ON DELETE SET NULL,
  channel_id  uuid        REFERENCES public.channels(id) ON DELETE SET NULL,
  sync_type   text        NOT NULL CHECK (sync_type IN ('price', 'inventory', 'both')),
  old_value   jsonb       NOT NULL DEFAULT '{}',
  new_value   jsonb       NOT NULL DEFAULT '{}',
  status      text        NOT NULL CHECK (status IN ('success', 'failed')),
  error_msg   text,
  synced_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS channel_sync_logs_product_idx
  ON public.channel_sync_logs (product_id);
CREATE INDEX IF NOT EXISTS channel_sync_logs_synced_at_idx
  ON public.channel_sync_logs (synced_at DESC);

ALTER TABLE public.channel_sync_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated can manage channel_sync_logs"
  ON public.channel_sync_logs;
CREATE POLICY "authenticated can manage channel_sync_logs"
  ON public.channel_sync_logs FOR ALL TO authenticated
  USING (true) WITH CHECK (true);


-- ============================================================
-- 완료 확인
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '마이그레이션 완료:';
  RAISE NOTICE '  ✅ channels.platform_type 컬럼';
  RAISE NOTICE '  ✅ product_option_groups 테이블';
  RAISE NOTICE '  ✅ product_option_values 테이블';
  RAISE NOTICE '  ✅ product_option_combinations 테이블';
  RAISE NOTICE '  ✅ inventory.option_combination_id 컬럼 + 부분 유니크 인덱스';
  RAISE NOTICE '  ✅ adjust_inventory RPC 업데이트';
  RAISE NOTICE '  ✅ channel_product_mappings 테이블';
  RAISE NOTICE '  ✅ channel_sync_logs 테이블';
END $$;
