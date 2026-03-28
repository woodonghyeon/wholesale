-- ============================================================
-- 송장 관리 테이블 (shipping_labels)
-- 네이버 주문 연동 or 수동 입력 모두 지원
-- ============================================================

CREATE TABLE IF NOT EXISTS public.shipping_labels (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id     uuid        REFERENCES public.businesses(id) ON DELETE CASCADE,
  slip_id         uuid        REFERENCES public.slips(id) ON DELETE SET NULL,
  naver_order_id  text,                              -- 네이버 주문번호 (연동 시)
  carrier         text        NOT NULL DEFAULT '',   -- 택배사 (CJ대한통운, 우체국 등)
  tracking_no     text        NOT NULL,              -- 송장번호
  recipient_name  text,
  recipient_phone text,
  recipient_addr  text,
  product_name    text,                              -- 대표 상품명
  qty             integer,
  status          text        DEFAULT 'pending',     -- pending / shipped / delivered
  shipped_at      date,
  delivered_at    date,
  note            text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shipping_labels_business_idx ON public.shipping_labels (business_id);
CREATE INDEX IF NOT EXISTS shipping_labels_tracking_idx ON public.shipping_labels (tracking_no);
CREATE INDEX IF NOT EXISTS shipping_labels_naver_idx    ON public.shipping_labels (naver_order_id);

ALTER TABLE public.shipping_labels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated can manage shipping_labels" ON public.shipping_labels;
CREATE POLICY "authenticated can manage shipping_labels"
  ON public.shipping_labels FOR ALL TO authenticated USING (true) WITH CHECK (true);
