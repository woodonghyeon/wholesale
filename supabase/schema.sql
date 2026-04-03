-- ============================================================
-- 문구 도매 통합 관리 시스템 — DB 스키마
-- Supabase (PostgreSQL) 전용
-- ============================================================

-- UUID 확장
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. 사업자
-- ============================================================
CREATE TABLE IF NOT EXISTS businesses (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  business_no  TEXT,
  owner_name   TEXT,
  phone        TEXT,
  email        TEXT,
  address      TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. 채널 (판매 경로)
-- ============================================================
CREATE TABLE IF NOT EXISTS channels (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name               TEXT NOT NULL,
  commission_rate    NUMERIC(5,2) NOT NULL DEFAULT 0,   -- %
  payment_fee_rate   NUMERIC(5,2) NOT NULL DEFAULT 0,   -- %
  shipping_fee       INTEGER NOT NULL DEFAULT 0,         -- 원
  sort_order         INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. 창고
-- ============================================================
CREATE TABLE IF NOT EXISTS warehouses (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id  UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  address      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. 거래처
-- ============================================================
CREATE TABLE IF NOT EXISTS partners (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  partner_type  TEXT NOT NULL CHECK (partner_type IN ('supplier','customer','both')),
  phone         TEXT,
  email         TEXT,
  address       TEXT,
  business_no   TEXT,
  credit_limit  INTEGER NOT NULL DEFAULT 0,
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 5. 상품
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id  UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  barcode      TEXT,
  name         TEXT NOT NULL,
  category     TEXT,
  unit         TEXT NOT NULL DEFAULT '개',
  buy_price    INTEGER NOT NULL DEFAULT 0,
  sell_price   INTEGER NOT NULL DEFAULT 0,
  min_stock    INTEGER NOT NULL DEFAULT 0,
  is_bundle    BOOLEAN NOT NULL DEFAULT FALSE,
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_business_id ON products(business_id);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;

-- ============================================================
-- 6. 번들 구성품
-- ============================================================
CREATE TABLE IF NOT EXISTS bundle_items (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bundle_product_id     UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  component_product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity              INTEGER NOT NULL DEFAULT 1,
  UNIQUE(bundle_product_id, component_product_id)
);

-- ============================================================
-- 7. 재고
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  business_id   UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  warehouse_id  UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  quantity      INTEGER NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, business_id, warehouse_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_business_id ON inventory(business_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product_id ON inventory(product_id);

-- ============================================================
-- 8. 재고 이동 로그
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  business_id   UUID REFERENCES businesses(id) ON DELETE SET NULL,
  warehouse_id  UUID REFERENCES warehouses(id) ON DELETE SET NULL,
  log_type      TEXT NOT NULL CHECK (log_type IN (
                  'in','out','return_in','return_out',
                  'transfer_in','transfer_out','adjustment','bundle_out'
                )),
  quantity      INTEGER NOT NULL,
  ref_type      TEXT,
  ref_id        UUID,
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_logs_product_id ON stock_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_logs_created_at ON stock_logs(created_at);

-- ============================================================
-- 9. 재고 실사 세션
-- ============================================================
CREATE TABLE IF NOT EXISTS stocktake_sessions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id   UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  warehouse_id  UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','done')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stocktake_items (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id       UUID NOT NULL REFERENCES stocktake_sessions(id) ON DELETE CASCADE,
  product_id       UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  system_quantity  INTEGER NOT NULL DEFAULT 0,
  actual_quantity  INTEGER NOT NULL DEFAULT 0,
  difference       INTEGER GENERATED ALWAYS AS (actual_quantity - system_quantity) STORED,
  UNIQUE(session_id, product_id)
);

-- ============================================================
-- 10. 거래전표
-- ============================================================
CREATE TABLE IF NOT EXISTS slips (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slip_no             TEXT NOT NULL UNIQUE,
  slip_type           TEXT NOT NULL CHECK (slip_type IN ('sale','purchase')),
  business_id         UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  partner_id          UUID REFERENCES partners(id) ON DELETE SET NULL,
  channel_id          UUID REFERENCES channels(id) ON DELETE SET NULL,
  warehouse_id        UUID REFERENCES warehouses(id) ON DELETE SET NULL,
  slip_date           DATE NOT NULL,
  payment_type        TEXT NOT NULL CHECK (payment_type IN ('cash','credit','mixed')),
  supply_amount       INTEGER NOT NULL DEFAULT 0,
  tax_amount          INTEGER NOT NULL DEFAULT 0,
  total_amount        INTEGER NOT NULL DEFAULT 0,
  paid_amount         INTEGER NOT NULL DEFAULT 0,
  memo                TEXT,
  tax_invoice_issued  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_slips_business_id ON slips(business_id);
CREATE INDEX IF NOT EXISTS idx_slips_slip_date ON slips(slip_date);
CREATE INDEX IF NOT EXISTS idx_slips_slip_type ON slips(slip_type);
CREATE INDEX IF NOT EXISTS idx_slips_partner_id ON slips(partner_id);

CREATE TABLE IF NOT EXISTS slip_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slip_id         UUID NOT NULL REFERENCES slips(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity        INTEGER NOT NULL DEFAULT 1,
  unit_price      INTEGER NOT NULL DEFAULT 0,
  supply_amount   INTEGER NOT NULL DEFAULT 0,
  tax_amount      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_slip_items_slip_id ON slip_items(slip_id);

-- ============================================================
-- 11. 결제 기록
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slip_id         UUID REFERENCES slips(id) ON DELETE SET NULL,
  partner_id      UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  payment_type    TEXT NOT NULL CHECK (payment_type IN ('receive','pay')),
  payment_method  TEXT NOT NULL CHECK (payment_method IN ('cash','transfer','card','note')),
  amount          INTEGER NOT NULL DEFAULT 0,
  payment_date    DATE NOT NULL,
  memo            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_partner_id ON payments(partner_id);

-- ============================================================
-- 12. 어음·수표
-- ============================================================
CREATE TABLE IF NOT EXISTS notes (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id  UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  partner_id   UUID REFERENCES partners(id) ON DELETE SET NULL,
  note_type    TEXT NOT NULL CHECK (note_type IN ('receivable','payable')),
  amount       INTEGER NOT NULL DEFAULT 0,
  issue_date   DATE NOT NULL,
  due_date     DATE NOT NULL,
  bank         TEXT,
  note_no      TEXT,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','cleared','bounced')),
  memo         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notes_due_date ON notes(due_date);
CREATE INDEX IF NOT EXISTS idx_notes_status ON notes(status);

-- ============================================================
-- 13. 현금출납장
-- ============================================================
CREATE TABLE IF NOT EXISTS cash_book (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id  UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  cash_type    TEXT NOT NULL CHECK (cash_type IN ('in','out')),
  amount       INTEGER NOT NULL DEFAULT 0,
  category     TEXT NOT NULL,
  description  TEXT,
  cash_date    DATE NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_book_business_id ON cash_book(business_id);
CREATE INDEX IF NOT EXISTS idx_cash_book_cash_date ON cash_book(cash_date);

-- ============================================================
-- 14. 견적서
-- ============================================================
CREATE TABLE IF NOT EXISTS quotes (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_no       TEXT NOT NULL UNIQUE,
  business_id    UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  partner_id     UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  quote_date     DATE NOT NULL,
  valid_until    DATE,
  status         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','accepted','rejected','expired')),
  supply_amount  INTEGER NOT NULL DEFAULT 0,
  tax_amount     INTEGER NOT NULL DEFAULT 0,
  total_amount   INTEGER NOT NULL DEFAULT 0,
  memo           TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quote_items (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id       UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  product_id     UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity       INTEGER NOT NULL DEFAULT 1,
  unit_price     INTEGER NOT NULL DEFAULT 0,
  supply_amount  INTEGER NOT NULL DEFAULT 0,
  tax_amount     INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- 15. 발주서
-- ============================================================
CREATE TABLE IF NOT EXISTS purchase_orders (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_no       TEXT NOT NULL UNIQUE,
  business_id    UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  partner_id     UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  order_date     DATE NOT NULL,
  expected_date  DATE,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','partial','done','cancelled')),
  supply_amount  INTEGER NOT NULL DEFAULT 0,
  tax_amount     INTEGER NOT NULL DEFAULT 0,
  total_amount   INTEGER NOT NULL DEFAULT 0,
  memo           TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id            UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id          UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity            INTEGER NOT NULL DEFAULT 1,
  received_quantity   INTEGER NOT NULL DEFAULT 0,
  unit_price          INTEGER NOT NULL DEFAULT 0,
  supply_amount       INTEGER NOT NULL DEFAULT 0,
  tax_amount          INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- 16. 반품
-- ============================================================
CREATE TABLE IF NOT EXISTS returns (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id   UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  partner_id    UUID REFERENCES partners(id) ON DELETE SET NULL,
  product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  slip_id       UUID REFERENCES slips(id) ON DELETE SET NULL,
  quantity      INTEGER NOT NULL DEFAULT 1,
  reason        TEXT,
  disposition   TEXT CHECK (disposition IN ('restock','discard','repair')),
  status        TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received','inspecting','approved','rejected')),
  restock_done  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_returns_status ON returns(status);

-- ============================================================
-- 17. 세금계산서
-- ============================================================
CREATE TABLE IF NOT EXISTS tax_invoices (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  slip_id         UUID REFERENCES slips(id) ON DELETE SET NULL,
  partner_id      UUID REFERENCES partners(id) ON DELETE SET NULL,
  invoice_type    TEXT NOT NULL CHECK (invoice_type IN ('issue','receive','amendment')),
  invoice_no      TEXT,
  invoice_date    DATE NOT NULL,
  supply_amount   INTEGER NOT NULL DEFAULT 0,
  tax_amount      INTEGER NOT NULL DEFAULT 0,
  total_amount    INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','issued','cancelled')),
  hometax_synced  BOOLEAN NOT NULL DEFAULT FALSE,
  memo            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 18. 다단계 거래처×채널 특별가격
-- ============================================================
CREATE TABLE IF NOT EXISTS partner_prices (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id  UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  channel_id  UUID REFERENCES channels(id) ON DELETE SET NULL,
  unit_price  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(partner_id, product_id, channel_id)
);

CREATE INDEX IF NOT EXISTS idx_partner_prices_partner_id ON partner_prices(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_prices_product_id ON partner_prices(product_id);

-- ============================================================
-- 19. 단골고객
-- ============================================================
CREATE TABLE IF NOT EXISTS regular_customers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  phone           TEXT,
  email           TEXT,
  address         TEXT,
  memo            TEXT,
  total_purchase  INTEGER NOT NULL DEFAULT 0,
  visit_count     INTEGER NOT NULL DEFAULT 0,
  last_visit      DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 20. 네이버 주문 동기화
-- ============================================================
CREATE TABLE IF NOT EXISTS naver_orders (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_order_id   TEXT NOT NULL UNIQUE,
  channel_id          UUID REFERENCES channels(id) ON DELETE SET NULL,
  business_id         UUID REFERENCES businesses(id) ON DELETE SET NULL,
  order_status        TEXT,
  ordered_at          TIMESTAMPTZ,
  buyer_name          TEXT,
  buyer_phone         TEXT,
  receiver_name       TEXT,
  receiver_phone      TEXT,
  receiver_address    TEXT,
  total_amount        INTEGER NOT NULL DEFAULT 0,
  raw_data            JSONB,
  is_processed        BOOLEAN NOT NULL DEFAULT FALSE,
  ref_slip_id         UUID REFERENCES slips(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_naver_orders_ordered_at ON naver_orders(ordered_at);
CREATE INDEX IF NOT EXISTS idx_naver_orders_is_processed ON naver_orders(is_processed);

-- ============================================================
-- 21. 감사 로그
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type    TEXT NOT NULL,
  resource_type  TEXT NOT NULL,
  resource_id    UUID,
  description    TEXT NOT NULL,
  metadata       JSONB,
  ip_address     TEXT,
  user_agent     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action_type ON activity_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);

-- ============================================================
-- RPC: adjust_inventory
-- 재고 조정 + stock_logs 원자적 처리
-- ============================================================
CREATE OR REPLACE FUNCTION adjust_inventory(
  p_product_id   UUID,
  p_business_id  UUID,
  p_warehouse_id UUID,
  p_quantity     INTEGER,
  p_note         TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_log_type TEXT;
BEGIN
  -- 재고 upsert
  INSERT INTO inventory (product_id, business_id, warehouse_id, quantity, updated_at)
  VALUES (p_product_id, p_business_id, p_warehouse_id, GREATEST(0, p_quantity), NOW())
  ON CONFLICT (product_id, business_id, warehouse_id)
  DO UPDATE SET
    quantity   = GREATEST(0, inventory.quantity + p_quantity),
    updated_at = NOW();

  -- 로그 타입 결정
  v_log_type := CASE WHEN p_quantity >= 0 THEN 'adjustment' ELSE 'adjustment' END;

  -- stock_logs INSERT
  INSERT INTO stock_logs (product_id, business_id, warehouse_id, log_type, quantity, note)
  VALUES (p_product_id, p_business_id, p_warehouse_id, v_log_type, p_quantity, p_note);
END;
$$;

-- ============================================================
-- RLS (Row-Level Security)
-- ============================================================

-- activity_logs: 로그인한 사용자만 자신의 로그 조회
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_logs_select" ON activity_logs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "activity_logs_insert" ON activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- partner_prices: 로그인 사용자 전체 접근
ALTER TABLE partner_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "partner_prices_all" ON partner_prices
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
