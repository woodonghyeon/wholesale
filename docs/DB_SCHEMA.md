# DB 스키마 상세

## 기본 테이블 (supabase/schema.sql — 25개)

| 번호 | 테이블 | 설명 |
|------|--------|------|
| 1 | businesses | 사업자 (본점/강남점/온라인) — 설정 페이지에서 CRUD |
| 2 | channels | 판매채널 — **business_id FK로 사업자에 종속** |
| 3 | warehouses | 창고 (business_id FK) |
| 4 | partners | 거래처 (supplier/customer/both) |
| 5 | products | 상품 (바코드, 매입가, 판매가, 안전재고, 세트여부) |
| 6 | bundle_items | 세트 상품 구성품 |
| 7 | inventory | 재고 (product × business × warehouse UNIQUE) |
| 8 | stock_logs | 재고 변동 이력 (log_type 8종) |
| 9 | stocktake_sessions | 재고 실사 세션 |
| 10 | stocktake_items | 실사 품목 (difference 생성 컬럼) |
| 11 | slips | 거래전표 (sale/purchase, slip_no UNIQUE) |
| 12 | slip_items | 전표 품목 |
| 13 | payments | 결제 기록 (receive/pay) |
| 14 | notes | 어음·수표 (receivable/payable) |
| 15 | cash_book | 현금출납장 |
| 16 | quotes | 견적서 (status: draft→sent→accepted/rejected/expired) |
| 17 | quote_items | 견적 품목 |
| 18 | purchase_orders | 발주서 (status: pending→partial→done/cancelled) |
| 19 | purchase_order_items | 발주 품목 (received_quantity 포함) |
| 20 | returns | 반품 (disposition: restock/discard/repair) |
| 21 | tax_invoices | 세금계산서 (issue/receive/amendment, hometax_synced) |
| 22 | partner_prices | 거래처×상품×채널 특별가 (UNIQUE 복합키, RLS 활성화) |
| 23 | regular_customers | 단골고객 (total_purchase, visit_count) |
| 24 | naver_orders | (레거시) 네이버 주문 — channel_orders로 대체됨 |
| 25 | activity_logs | 감사 로그 (RLS: 본인 로그만 조회) |

## channels 테이블 주요 컬럼

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID PK | |
| **business_id** | **UUID FK** | **사업자 종속 (add_business_to_channels.sql로 추가)** |
| name | TEXT | 채널명 |
| platform_type | TEXT | naver / 11st / auction / gmarket / coupang / own / offline |
| commission_rate | NUMERIC(5,2) | 판매 수수료율 (%) |
| payment_fee_rate | NUMERIC(5,2) | 결제 수수료율 (%) |
| shipping_fee | INTEGER | 기본 배송비 (원) |
| api_client_id / api_client_secret | TEXT | 플랫폼 연동 API 키 |
| sync_enabled | BOOLEAN | 주문 자동 동기화 여부 |
| last_synced_at | TIMESTAMPTZ | 마지막 동기화 시각 |

## products 테이블 주요 컬럼

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID PK | |
| business_id | UUID FK | 사업자 |
| barcode | TEXT | 바코드 (nullable, 인덱스) |
| name | TEXT | 상품명 |
| category | TEXT | 카테고리 (필기구/용지/노트 등) |
| unit | TEXT | 단위 (박스/개/권 등) |
| buy_price | NUMERIC | 매입가 |
| sell_price | NUMERIC | 판매가 |
| min_stock | INTEGER | 안전재고 수량 |
| is_bundle | BOOLEAN | 세트 상품 여부 |
| note | TEXT | 메모 |

## channel_orders 테이블 (supabase/channel_orders.sql — ✅ 실행 완료)

UNIQUE(platform_type, external_product_order_id) → upsert 기준

| 컬럼 | 타입 | 설명 |
|------|------|------|
| platform_type | TEXT | naver / 11st / coupang 등 |
| external_order_id | TEXT | 채널 원본 주문번호 |
| external_product_order_id | TEXT | 채널 원본 상품주문번호 (upsert 키) |
| order_status | TEXT | paid / shipping / delivered / confirmed / cancelled 등 |
| ordered_at | TIMESTAMPTZ | 주문 시각 |
| buyer_name / receiver_name | TEXT | 구매자 / 수령인 |
| product_name / option_info | TEXT | 상품명 / 옵션 |
| total_amount / shipping_fee | NUMERIC | 결제금액 / 배송비 |
| raw_data | JSONB | 원본 API 응답 전체 |
| is_processed | BOOLEAN | ERP 전표 변환 여부 |
| ref_slip_id | UUID FK | 연결된 거래전표 |

## 핵심 RPC

```sql
-- 재고 조정 (원자적: inventory UPSERT + stock_logs INSERT)
adjust_inventory(p_product_id, p_business_id, p_warehouse_id, p_quantity, p_note)
-- 매출 전표: p_quantity 음수 / 매입 전표: p_quantity 양수
```

## 멀티 테넌트 패턴

- 대부분의 테이블에 `business_id` FK 존재
- Zustand `selectedBusinessId`로 전역 필터링 (`'all'` 시 WHERE 절 생략)
- Zustand `selectedChannelId`로 채널 전역 필터링 (`'all'` 시 WHERE 절 생략)
- **사업자 전환 시 `selectedChannelId`가 `'all'`로 자동 초기화됨**
- **`channels` 테이블은 `business_id`로 사업자에 종속** — 채널 조회 시 반드시 `business_id` 필터 적용
- `channel_orders`의 business_id는 `businesses` 테이블 첫 번째 행으로 설정됨 (어댑터 내부 처리)

## DB 실행 현황

| 파일 | 상태 |
|------|------|
| `supabase/schema.sql` | ✅ 실행 완료 |
| `supabase/seed.sql` | ✅ 실행 완료 (사업자3, 채널4, 창고3, 거래처15, 상품25, 재고25) |
| `supabase/channel_orders.sql` | ✅ 실행 완료 |
| RLS DISABLE 쿼리 | ✅ 실행 완료 |
| `supabase/add_business_to_channels.sql` | ⚠️ **실행 필요** (channels에 business_id 추가) |

## RLS 주의사항

Supabase는 새 테이블 생성 시 RLS를 자동으로 활성화한다. `activity_logs`, `partner_prices` 외 모든 테이블은 RLS를 비활성화해야 한다.

```sql
-- activity_logs, partner_prices 제외 전체 테이블 RLS 비활성화
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT IN ('activity_logs', 'partner_prices')
  LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
```

## 도메인 용어 사전

| 한국어 | 영문 키 | 설명 |
|--------|---------|------|
| 거래명세표/전표 | slip | 매출·매입 거래 기록 단위 |
| 미수금 | receivable | 외상 매출 미회수금 |
| 미지급금 | payable | 외상 매입 미결제금 |
| 수불 | stock_ledger | 재고 입출고 이력 |
| 실사 | stocktake | 재고 실물 확인 프로세스 |
| 단가 | unit_price | 상품별 거래 가격 |
| 수수료 | commission | 채널 판매 수수료 |
| 사업자 | business | 개별 사업체 (본점/강남점/온라인) |
| 합포장 | combined_packing | 동일 수령인 주문 합치기 |
| 거래처 | partner | 공급업체/고객사 |
| 상품주문번호 | external_product_order_id | 채널별 개별 상품 단위 주문 ID |
| 마진율 | margin_rate | (판매가 - 매입가) / 판매가 × 100 |
