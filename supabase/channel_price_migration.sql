-- ============================================================
-- 채널별 가격/상품명 컬럼 추가
-- channel_product_mappings 테이블에 채널 전용 가격·이름 저장
-- ============================================================

ALTER TABLE public.channel_product_mappings
  ADD COLUMN IF NOT EXISTS channel_price  integer,   -- 채널 전용 판매가 (NULL이면 상품 기본가 사용)
  ADD COLUMN IF NOT EXISTS channel_name   text;      -- 채널 전용 상품명 (NULL이면 상품명 그대로)

COMMENT ON COLUMN public.channel_product_mappings.channel_price IS '채널 전용 판매가. NULL이면 products.sell_price 사용';
COMMENT ON COLUMN public.channel_product_mappings.channel_name  IS '채널 전용 상품명. NULL이면 products.name 사용';
