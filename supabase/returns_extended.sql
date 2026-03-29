-- ============================================================
-- returns 테이블 확장 — 주문자·결제·환불 정보 추가
-- Supabase SQL Editor에서 실행하세요
-- ============================================================

ALTER TABLE public.returns
  ADD COLUMN IF NOT EXISTS orderer_name    text,         -- 주문자 이름
  ADD COLUMN IF NOT EXISTS orderer_tel     text,         -- 주문자 연락처
  ADD COLUMN IF NOT EXISTS product_option  text,         -- 상품 옵션 (색상/사이즈 등)
  ADD COLUMN IF NOT EXISTS unit_price      integer,      -- 상품 단가
  ADD COLUMN IF NOT EXISTS payment_method  text,         -- 결제수단 (네이버페이/카드/계좌이체 등)
  ADD COLUMN IF NOT EXISTS payment_amount  integer,      -- 결제금액
  ADD COLUMN IF NOT EXISTS naver_order_id  text,         -- 네이버 주문번호 연동
  ADD COLUMN IF NOT EXISTS refund_bank     text,         -- 환불 은행명
  ADD COLUMN IF NOT EXISTS refund_account  text,         -- 환불 계좌번호
  ADD COLUMN IF NOT EXISTS refund_holder   text,         -- 환불 예금주
  ADD COLUMN IF NOT EXISTS refund_amount   integer,      -- 환불금액
  ADD COLUMN IF NOT EXISTS refund_done     boolean       DEFAULT false;  -- 환불 완료 여부

-- 네이버 주문 연동 인덱스
CREATE INDEX IF NOT EXISTS returns_naver_order_idx ON public.returns (naver_order_id)
  WHERE naver_order_id IS NOT NULL;
