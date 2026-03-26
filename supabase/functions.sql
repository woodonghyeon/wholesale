-- ============================================================
-- 재고 조정 RPC 함수
-- Supabase SQL Editor에서 실행하세요
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
