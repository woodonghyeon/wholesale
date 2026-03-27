-- ============================================================
-- naver_orders 테이블 — 네이버 주문 원본 데이터 저장
-- Supabase SQL Editor에서 실행하세요
-- ============================================================

CREATE TABLE IF NOT EXISTS public.naver_orders (
  id                          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  product_order_id            text        NOT NULL UNIQUE,
  order_id                    text,
  order_date                  timestamptz,
  payment_date                timestamptz,
  status                      text,

  -- 상품 정보
  product_name                text,
  product_no                  text,        -- originProductNo
  channel_product_no          text,        -- channelProductNo
  product_option              text,        -- 옵션 문자열

  -- 수량 / 금액
  quantity                    integer,
  unit_price                  integer,
  total_payment_amount        integer,
  discount_amount             integer      DEFAULT 0,
  expected_settlement_amount  integer      DEFAULT 0,  -- 정산 예정금
  payment_commission          integer      DEFAULT 0,  -- 결제 수수료
  sale_commission             integer      DEFAULT 0,  -- 판매 수수료

  -- 주문자
  orderer_name                text,
  orderer_tel                 text,

  -- 수신자 / 배송지
  receiver_name               text,
  receiver_tel                text,
  receiver_address            text,
  receiver_zip_code           text,
  receiver_lat                numeric(10,6),
  receiver_lng                numeric(10,6),

  -- 배송
  delivery_company            text,
  tracking_number             text,
  delivery_status             text,

  -- 기타
  inflow_path                 text,        -- 유입 경로 (검색, 광고 등)
  payment_means               text,        -- 결제 수단 (CARD, NPAY 등)
  is_membership_subscribed    boolean      DEFAULT false,

  -- 메타
  business_id                 uuid        REFERENCES public.businesses(id) ON DELETE SET NULL,
  synced_at                   timestamptz  DEFAULT now(),
  created_at                  timestamptz  DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS naver_orders_order_date_idx    ON public.naver_orders (order_date DESC);
CREATE INDEX IF NOT EXISTS naver_orders_payment_date_idx  ON public.naver_orders (payment_date DESC);
CREATE INDEX IF NOT EXISTS naver_orders_status_idx        ON public.naver_orders (status);
CREATE INDEX IF NOT EXISTS naver_orders_business_id_idx   ON public.naver_orders (business_id);
CREATE INDEX IF NOT EXISTS naver_orders_tracking_idx      ON public.naver_orders (tracking_number) WHERE tracking_number IS NOT NULL;

-- RLS
ALTER TABLE public.naver_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated can manage naver_orders" ON public.naver_orders;
CREATE POLICY "authenticated can manage naver_orders"
  ON public.naver_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- service role (서버 API 직접 접근)
DROP POLICY IF EXISTS "service role can manage naver_orders" ON public.naver_orders;
CREATE POLICY "service role can manage naver_orders"
  ON public.naver_orders FOR ALL TO service_role USING (true) WITH CHECK (true);
