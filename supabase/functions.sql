-- ============================================================
-- Supabase SQL Editor에서 전체 실행하세요
-- ============================================================

-- ============================================================
-- 재고 조정 RPC 함수
-- ============================================================

-- adjust_inventory: 재고 수량을 delta(±) 만큼 변경하고 stock_logs에 기록
CREATE OR REPLACE FUNCTION public.adjust_inventory(
  p_product_id   uuid,
  p_business_id  uuid,
  p_warehouse_id uuid,
  p_quantity     int,       -- 양수: 입고, 음수: 출고/감소
  p_note         text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- inventory 행이 없으면 삽입, 있으면 quantity에 delta 가산
  INSERT INTO inventory (product_id, business_id, warehouse_id, quantity, updated_at)
  VALUES (p_product_id, p_business_id, p_warehouse_id, GREATEST(0, p_quantity), now())
  ON CONFLICT (product_id, business_id, warehouse_id)
  DO UPDATE SET
    quantity   = GREATEST(0, inventory.quantity + p_quantity),
    updated_at = now();

  -- 이력 기록 (stock_logs 테이블이 있는 경우)
  BEGIN
    INSERT INTO stock_logs (
      product_id, business_id, warehouse_id,
      log_type, quantity, note, created_at
    ) VALUES (
      p_product_id, p_business_id, p_warehouse_id,
      'adjustment', p_quantity, p_note, now()
    );
  EXCEPTION WHEN undefined_table THEN
    -- stock_logs 테이블이 없으면 무시
    NULL;
  END;
END;
$$;

-- 권한 부여
GRANT EXECUTE ON FUNCTION public.adjust_inventory TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_inventory TO anon;

-- ============================================================
-- 활동 로그 테이블 (activity_logs)
-- 로그인/회원가입/CRUD 이벤트를 시간별로 수집
-- ============================================================

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type   text        NOT NULL,   -- 'auth.login' | 'auth.signup' | 'auth.logout' | 'create' | 'update' | 'delete' | 'adjust' | 'export' | 'error'
  resource_type text,                   -- 'slip' | 'product' | 'partner' | 'inventory' | 'payment' | 'note' | 'return' | 'quote' | 'customer' | 'cash' | 'tax'
  resource_id   text,
  description   text,
  metadata      jsonb       DEFAULT '{}',
  ip_address    text,
  user_agent    text,
  created_at    timestamptz DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS activity_logs_created_at_idx ON public.activity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS activity_logs_action_type_idx ON public.activity_logs (action_type);
CREATE INDEX IF NOT EXISTS activity_logs_user_id_idx ON public.activity_logs (user_id);

-- RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated can insert activity_logs" ON public.activity_logs;
DROP POLICY IF EXISTS "authenticated can read activity_logs" ON public.activity_logs;

CREATE POLICY "authenticated can insert activity_logs"
  ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated can read activity_logs"
  ON public.activity_logs FOR SELECT TO authenticated USING (true);

-- Realtime 활성화 (터미널 탭 실시간 스트림용) - 이미 추가된 경우 무시
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'activity_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;
  END IF;
END$$;
