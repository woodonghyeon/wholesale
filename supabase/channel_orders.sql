-- ============================================================
-- channel_orders 테이블 및 channels 테이블 확장
-- Supabase SQL Editor에서 실행하세요
-- ============================================================

-- channels 테이블 확장 (플랫폼 연동 컬럼 추가)
ALTER TABLE channels ADD COLUMN IF NOT EXISTS platform_type TEXT
  CHECK (platform_type IN ('naver', '11st', 'auction', 'gmarket', 'coupang', 'own', 'offline'));
ALTER TABLE channels ADD COLUMN IF NOT EXISTS api_client_id TEXT;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS api_client_secret TEXT;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS sync_enabled BOOLEAN DEFAULT false;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- 통합 채널 주문 테이블
CREATE TABLE IF NOT EXISTS channel_orders (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id               UUID REFERENCES businesses(id) ON DELETE SET NULL,
  channel_id                UUID REFERENCES channels(id) ON DELETE SET NULL,
  platform_type             TEXT NOT NULL DEFAULT 'naver',
  external_order_id         TEXT NOT NULL,                          -- 채널 원본 주문번호
  external_product_order_id TEXT,                                   -- 채널 원본 상품주문번호
  order_status              TEXT NOT NULL,                          -- paid, shipping, delivered, confirmed, cancelled, returned
  ordered_at                TIMESTAMPTZ NOT NULL,
  buyer_name                TEXT,
  buyer_phone               TEXT,
  buyer_email               TEXT,
  receiver_name             TEXT,
  receiver_phone            TEXT,
  receiver_address          TEXT,
  receiver_zipcode          TEXT,
  product_name              TEXT,
  option_info               TEXT,
  quantity                  INTEGER DEFAULT 1,
  unit_price                NUMERIC(12,0) DEFAULT 0,
  total_amount              NUMERIC(12,0) DEFAULT 0,
  shipping_fee              NUMERIC(12,0) DEFAULT 0,
  commission_amount         NUMERIC(12,0) DEFAULT 0,
  tracking_number           TEXT,
  shipping_company          TEXT,
  raw_data                  JSONB,                                  -- 원본 API 응답 전체
  is_processed              BOOLEAN DEFAULT false,                  -- ERP 전표 변환 여부
  ref_slip_id               UUID REFERENCES slips(id) ON DELETE SET NULL,
  memo                      TEXT,
  created_at                TIMESTAMPTZ DEFAULT now(),
  updated_at                TIMESTAMPTZ DEFAULT now(),

  UNIQUE(platform_type, external_product_order_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_channel_orders_business   ON channel_orders(business_id);
CREATE INDEX IF NOT EXISTS idx_channel_orders_channel    ON channel_orders(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_orders_status     ON channel_orders(order_status);
CREATE INDEX IF NOT EXISTS idx_channel_orders_ordered    ON channel_orders(ordered_at DESC);
CREATE INDEX IF NOT EXISTS idx_channel_orders_processed  ON channel_orders(is_processed);
CREATE INDEX IF NOT EXISTS idx_channel_orders_ext_order  ON channel_orders(external_order_id);

-- RLS 활성화
ALTER TABLE channel_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "channel_orders_select" ON channel_orders
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "channel_orders_insert" ON channel_orders
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "channel_orders_update" ON channel_orders
  FOR UPDATE USING (auth.role() = 'authenticated');

-- naver 채널의 platform_type 업데이트 (seed.sql에서 생성된 채널 기준)
UPDATE channels SET platform_type = 'naver' WHERE name ILIKE '%naver%' OR name ILIKE '%스마트스토어%';
