# 문구 도매 통합 관리 시스템 — 전체 코드베이스 분석

> 작성일: 2026-03-29

---

## 1. 기술 스택

| 항목 | 기술 |
|------|------|
| 프레임워크 | Next.js 14.2.35 (App Router) + TypeScript 5 |
| DB / Auth | Supabase (PostgreSQL + Supabase Auth + Realtime) |
| UI | React 18 + Tailwind CSS 3.4.1 |
| 상태 관리 | Zustand 5.0.12 (businessStore, localStorage persist) |
| 폼 검증 | React Hook Form 7.72.0 + Zod 4.3.6 |
| 차트 | Recharts 3.8.1 |
| PDF 출력 | @react-pdf/renderer 4.3.2 |
| Excel | xlsx 0.18.5 |
| 알림 토스트 | sonner 2.0.7 |
| 스케줄링 | node-cron 4.2.1 |

---

## 2. 디렉토리 구조

```
.
├── app/
│   ├── (auth)/login/              # 로그인·회원가입 페이지
│   ├── (dashboard)/               # 보호된 대시보드 라우트 그룹 (24개 페이지)
│   │   ├── layout.tsx             # Sidebar + Header 공통 레이아웃
│   │   ├── dashboard/             # 메인 대시보드
│   │   ├── transactions/          # 거래전표 입력
│   │   ├── sales/                 # 매출 집계
│   │   ├── channel-sales/         # 채널별 매출
│   │   ├── purchase/              # 매입 집계
│   │   ├── inventory/             # 재고 관리
│   │   ├── stocktake/             # 재고 실사
│   │   ├── stock-ledger/          # 재고 원장 (일별/월별)
│   │   ├── products/              # 상품 관리
│   │   ├── price-list/            # 다단계 가격표
│   │   ├── partners/              # 거래처 관리
│   │   ├── partner-ledger/        # 거래처별 원장
│   │   ├── quotes/                # 견적서·발주서
│   │   ├── returns/               # 반품 관리
│   │   ├── cash/                  # 현금출납장
│   │   ├── receivables/           # 매출채권·매입채무
│   │   ├── notes/                 # 어음·수표
│   │   ├── tax/                   # 세금계산서
│   │   ├── customers/             # 단골고객
│   │   ├── reports/               # 연간 손익 리포트
│   │   ├── profit/                # 이익 분석
│   │   ├── quarterly/             # 분기별 집계
│   │   ├── alerts/                # 알림 센터
│   │   ├── logs/                  # 시스템 로그
│   │   ├── settings/              # 사업자·채널·창고 설정
│   │   └── data-migration/        # 데이터 내보내기·가져오기
│   ├── api/
│   │   ├── analytics/             # 고객분석·이익·지역·재고속도
│   │   ├── naver/                 # 스마트스토어 주문/상품/클레임/동기화
│   │   ├── pdf/                   # 견적서·가격표·전표 PDF 생성
│   │   ├── barcode/               # 바코드 상품 조회
│   │   ├── shipping/              # 배송 레이블
│   │   ├── telegram/              # 텔레그램 봇
│   │   └── server-logs/stream/    # SSE 실시간 로그
│   ├── layout.tsx                 # Root 레이아웃
│   └── page.tsx                   # / → /dashboard 리다이렉트
│
├── components/
│   ├── layout/
│   │   ├── Header.tsx             # 사업자 선택 드롭다운 + 로그아웃
│   │   └── Sidebar.tsx            # 7카테고리 네비게이션 (활성 카테고리 자동 펼침)
│   └── ui/
│       ├── Modal.tsx              # 재사용 모달 다이얼로그
│       ├── ConfirmDialog.tsx      # 삭제·확인 다이얼로그
│       └── PageHeader.tsx         # 페이지 제목 + 액션 버튼
│
├── lib/
│   ├── supabase/                  # 도메인별 데이터 액세스 모듈 (20+개)
│   │   ├── client.ts              # 브라우저용 Supabase 클라이언트
│   │   ├── server.ts              # 서버사이드 Supabase 클라이언트
│   │   ├── businesses.ts          # 사업자 CRUD
│   │   ├── partners.ts            # 거래처 CRUD
│   │   ├── products.ts            # 상품 CRUD + 중복 병합
│   │   ├── inventory.ts           # 재고 조회 + adjust RPC
│   │   ├── slips.ts               # 전표 CRUD + 관계 데이터
│   │   ├── sales.ts               # 매출 집계 쿼리
│   │   ├── purchases.ts           # 매입 집계 쿼리
│   │   ├── quotes.ts              # 견적서·발주서 CRUD
│   │   ├── returns.ts             # 반품 관리
│   │   ├── cashbook.ts            # 현금출납 엔트리
│   │   ├── notes.ts               # 어음·수표 관리
│   │   ├── payments.ts            # 결제 기록
│   │   ├── stocktake.ts           # 실사 세션 관리
│   │   ├── stock-ledger.ts        # 재고 로그 집계
│   │   ├── price-list.ts          # 거래처·채널별 가격
│   │   ├── partner-ledger.ts      # 거래처별 거래 내역
│   │   ├── channel-sales.ts       # 채널별 집계
│   │   ├── dashboard.ts           # 대시보드 통계 집계
│   │   ├── logs.ts                # 활동·인증 로그 + Realtime
│   │   ├── warehouses.ts          # 창고 CRUD
│   │   ├── channels.ts            # 채널 CRUD
│   │   └── customers.ts           # 단골고객 CRUD
│   ├── naver/
│   │   ├── auth.ts                # bcrypt 서명 토큰 인증 (1시간 캐시)
│   │   ├── orders.ts              # 주문 페치 + DB 매핑
│   │   ├── products.ts            # 주문에서 상품 추출
│   │   ├── claims.ts              # 반품·취소 추출
│   │   └── auto-sync.ts           # node-cron 자동 동기화 스케줄러
│   ├── excel/
│   │   ├── export.ts              # 9종 멀티시트 Excel 내보내기
│   │   └── import.ts              # Excel 데이터 가져오기
│   ├── telegram/
│   │   ├── index.ts               # 봇 초기화
│   │   └── reports.ts             # 리포트 메시지 생성
│   ├── types/index.ts             # 전체 TypeScript 타입 정의 (~425줄)
│   ├── utils/
│   │   ├── format.ts              # 금액·날짜 포맷, 전표번호 생성
│   │   ├── price.ts               # 가격 계산 유틸
│   │   └── profit.ts              # 이익 계산 유틸
│   └── server/
│       └── log-store.ts           # 서버사이드 로그 버퍼링
│
├── store/
│   └── businessStore.ts           # Zustand: 선택 사업자 ID (localStorage persist)
│
├── supabase/
│   ├── functions.sql              # adjust_inventory RPC + activity_logs + partner_prices
│   ├── seed.sql                   # 더미 데이터 100건
│   ├── naver_orders.sql           # 네이버 주문 동기화 테이블
│   └── shipping.sql               # 배송 레이블 스키마
│
├── middleware.ts                  # 인증 가드 + SSR 쿠키 관리
├── instrumentation.ts             # OpenTelemetry 훅
├── next.config.mjs
├── tailwind.config.ts
└── tsconfig.json
```

---

## 3. 데이터베이스 스키마

### 핵심 테이블 (16개)

| 테이블 | 설명 | 주요 컬럼 |
|--------|------|-----------|
| `businesses` | 다중 사업자 | id, name, business_no, owner_name, phone, email, address, sort_order |
| `partners` | 거래처 (공급/고객/양쪽) | id, name, partner_type, phone, credit_limit, note |
| `channels` | 판매 채널 | id, name, commission_rate, payment_fee_rate, shipping_fee, sort_order |
| `products` | 상품 SKU | id, business_id, barcode, name, category, unit, buy_price, sell_price, min_stock, is_bundle |
| `warehouses` | 창고 (사업자별) | id, business_id, name, address |
| `inventory` | 현재고 | id, product_id, business_id, warehouse_id, quantity — UNIQUE(product, business, warehouse) |
| `slips` | 거래전표 | id, slip_no, slip_type(sale/purchase), partner_id, channel_id, payment_type, supply_amount, tax_amount, total_amount |
| `slip_items` | 전표 품목 | id, slip_id, product_id, quantity, unit_price, supply_amount, tax_amount |
| `stock_logs` | 재고 이동 이력 | id, product_id, log_type(in/out/return_in/return_out/transfer/adjustment/bundle_out), quantity, ref_type, ref_id |
| `stocktake_sessions` | 재고 실사 세션 | id, business_id, warehouse_id, name, status(open/reviewing/done) |
| `stocktake_items` | 실사 품목 | id, session_id, product_id, system_quantity, actual_quantity, difference |
| `quotes` | 견적서 | id, quote_no, partner_id, status(draft/sent/accepted/rejected/expired), total_amount |
| `purchase_orders` | 발주서 | id, order_no, partner_id, status(pending/partial/done/cancelled) |
| `returns` | 반품 | id, partner_id, product_id, reason, disposition, status, restock_done |
| `notes` | 어음·수표 | id, note_type(receivable/payable), amount, issue_date, due_date, status(pending/cleared/bounced) |
| `cash_book` | 현금출납 | id, cash_type(in/out), amount, category, description, cash_date |
| `payments` | 결제 기록 | id, partner_id, payment_type(receive/pay), payment_method(cash/transfer/card/note), amount |
| `tax_invoices` | 세금계산서 | id, invoice_type(issue/receive/amendment), invoice_no, supply_amount, tax_amount, status, hometax_synced |
| `partner_prices` | 다단계 특별가격 | id, partner_id, product_id, channel_id, unit_price — UNIQUE(partner, product, channel) |
| `activity_logs` | 감사 로그 | id, user_id, action_type, resource_type, description, metadata(jsonb), ip_address, created_at |
| `naver_orders` | 네이버 주문 | id, external_order_id, order_status, ordered_at, raw_data(jsonb), is_processed, ref_slip_id |

### RPC 함수

```sql
adjust_inventory(
  p_product_id   uuid,
  p_business_id  uuid,
  p_warehouse_id uuid,
  p_quantity     integer,  -- 델타값 (+/-)
  p_note         text
)
-- 처리: GREATEST(0, 현재고 + delta) 보정
-- 부작용: stock_logs 자동 INSERT
```

---

## 4. 인증 흐름

```
HTTP 요청
  └→ middleware.ts
        ├─ /api/* → 통과 (인증 생략)
        ├─ 세션 없음 → /login 리다이렉트
        └─ 세션 있음 + /login 접근 → /dashboard 리다이렉트

로그인 성공
  └→ supabase.auth.signInWithPassword()
        └→ activity_logs INSERT (action='auth.login', ip, user_agent)

회원가입
  └→ supabase.auth.signUp()
        └→ activity_logs INSERT (action='auth.signup')
```

- 세션: Supabase SSR 쿠키 자동 관리
- 클라이언트: `lib/supabase/client.ts`의 `useSession()` 훅
- 서버: `lib/supabase/server.ts` (API 라우트에서 사용)

---

## 5. 상태 관리 (Zustand)

```typescript
// store/businessStore.ts
interface BusinessStore {
  selectedBusinessId: string  // 'all' | UUID
  setSelectedBusiness(id: string): void
}
// persist: localStorage 'business-store'
```

- Header에서 사업자 선택 → store 업데이트
- 모든 쿼리 함수가 `selectedBusinessId`로 필터링
- `'all'` 선택 시 전체 사업자 데이터 표시

---

## 6. 페이지별 상세 기능

### 6.1 대시보드 (`/dashboard`)
- KPI 카드: 이번달 매출·매입·이익, 재고금액, 저재고 상품 수
- 최근 6개월 매출 추이 (바차트, Recharts)
- 최근 거래 10건 테이블
- 재고 부족 배너 (안전재고 이하 상품 수)
- **네이버 스마트스토어 실시간 주문 섹션:**
  - 요약 (최근 30일: 총주문수/오늘/취소/반품)
  - 일별 매출 추이
  - TOP 5 상품
  - 최근 주문 5건

### 6.2 거래전표 (`/transactions`)
- 탭: 매출 | 매입
- 폼: 사업자, 거래처, 창고, 채널, 날짜, 결제방식 (현금/외상/혼합)
- 동적 품목 추가: 상품 선택 → 수량·단가 입력 → 공급가·세금 자동계산
- 세금계산서 체크 시 tax_invoices 자동 생성
- 전표 목록, 삭제, 상세 모달

### 6.3 매출 집계 (`/sales`)
- 탭1 전표별: 날짜·거래처·채널·창고·결제방식·금액
- 탭2 상품별: 상품명·카테고리·수량·공급가·합계 (매출순 정렬)
- 날짜 범위 필터

### 6.4 채널별 매출 (`/channel-sales`)
```
순수익 = 총매출 - 수수료 - 결제수수료 - 배송비
```

### 6.5 재고 관리 (`/inventory`)
- 상품×창고 격자 뷰
- 안전재고 이하 행: 주황색 하이라이트
- 조정 버튼 → 델타 입력 → `adjust_inventory()` RPC 호출 → 로그 기록

### 6.6 재고 실사 (`/stocktake`)
```
세션 생성 (open)
  → 품목별 실제수량 입력
  → 검토 (reviewing)
  → 차이 확인
  → adjust_inventory 일괄 적용
  → 완료 (done)
```

### 6.7 재고 원장 (`/stock-ledger`)
- 일별/월별 탭
- 컬럼: 날짜, 입고, 출고, 반품, 이동, 조정, 누계 잔량
- 상품·창고·날짜 필터

### 6.8 가격표 (`/price-list`)
- `partner_prices` 테이블 CRUD
- 거래처×채널별 특별가 설정
- 표준가 대비 차이% 표시
- 전표 입력 시 단가 자동 적용

### 6.9 견적서·발주서 (`/quotes`)
- 견적서: draft→sent→accepted|rejected|expired 워크플로우
- 발주서: pending→partial→done|cancelled, 입고수량 추적
- 양식 PDF 출력

### 6.10 알림 센터 (`/alerts`)
| 알림 종류 | 조건 |
|-----------|------|
| 저재고 | quantity ≤ min_stock |
| 어음 만기 | due_date < today |
| 채권 연체 | payment due_date < today |
| 반품 대기 | status = 'received' |
| 발주 대기 | status = 'pending' |

### 6.11 시스템 로그 (`/logs`)
- 탭1 활동 로그: action_type·resource_type·날짜 필터, metadata JSON 확장
- 탭2 인증 로그: 기기·브라우저·OS·IP 파싱
- 탭3 실시간 터미널: Supabase Realtime subscription → SSE → 자동 스크롤 콘솔

---

## 7. API 라우트 상세

### 네이버 스마트스토어 (`/api/naver/*`)

| 엔드포인트 | 메서드 | 기능 |
|-----------|--------|------|
| `/api/naver/orders` | GET | 최근 N일 주문 페치 (24h 창 + 중복제거) |
| `/api/naver/analytics` | GET | 대시보드용 집계 (요약+일별+TOP상품+최근주문) |
| `/api/naver/products` | GET | 주문에서 상품 목록 추출 |
| `/api/naver/claims` | GET | 반품·취소·교환 클레임 집계 |
| `/api/naver/stats` | GET | analytics 별칭 |
| `/api/naver/sync/orders` | POST | 주문 DB 동기화 (node-cron 호출) |
| `/api/naver/test` | GET | API 연결 테스트 |

**인증 방식 (bcrypt 서명):**
```
timestamp = Date.now()
signature = Base64(bcrypt.hash(`${clientId}_${timestamp}`, clientSecret))
Authorization: Bearer {clientId}:{timestamp}:{signature}
```
토큰 1시간 캐시, 만료 60초 전 자동 갱신

### PDF 생성 (`/api/pdf/*`)
- `/api/pdf/quote?id=<id>&type=quote|order` — 견적서·발주서 HTML→PDF
- `/api/pdf/price-list` — 채널×상품 가격표 A4 레이아웃
- `/api/pdf/slip?id=<id>` — 영수증 스타일 전표

### 분석 (`/api/analytics/*`)
- `customers` — 거래처별 매출 순위
- `profit` — 12개월 월별 이익 추이
- `regions` — 지역별 분포 (플레이스홀더)
- `stock-velocity` — 일별 판매속도 기반 재고 고갈 예측일 계산

---

## 8. 핵심 데이터 흐름

### 전표 입력 흐름
```
사용자 폼 입력
  → Zod 스키마 검증
  → createSlip(header + items)
  → Supabase: slips INSERT → slip_items INSERT
  → logActivity('create', 'slip', ...)
  → (세금계산서 체크 시) tax_invoices INSERT
  → UI 목록 새로고침
```

### 재고 조정 흐름
```
Adjust 버튼 클릭
  → 델타값 + 메모 입력
  → adjust_inventory(product, business, warehouse, delta, note) RPC
  → RPC: inventory UPDATE (GREATEST(0, qty+delta))
  → RPC: stock_logs INSERT
  → logActivity('adjust', 'inventory', ...)
  → 재고 그리드 새로고침
```

### 네이버 주문 동기화 흐름
```
대시보드 로드 / 수동 동기화
  → /api/naver/stats 호출
  → getNaverAccessToken() → bcrypt 서명 토큰 발급 (캐시)
  → getNaverOrders(7일) + getNaverOrdersLastHours(24h)
  → 중복 제거 (productOrderId 기준)
  → 집계: 일별/채널별/TOP상품/최근주문
  → 대시보드 렌더링

(자동) node-cron → /api/naver/sync/orders
  → 주문 fetch → naver_orders TABLE upsert
  → is_processed 플래그 관리
```

---

## 9. Excel 내보내기·가져오기

### 내보내기 (`lib/excel/export.ts`)
- 9종 멀티시트: partners, products, inventory, slips, slip_items, cash, notes, payments, stock_logs
- 날짜 범위 필터 (시계열 데이터용)
- 컬럼 자동 너비 조정
- 파일명: `wholesale_export_YYYY-MM-DD.xlsx`

### 가져오기 (`lib/excel/import.ts`)
- Excel 파일 파싱
- 컬럼 → DB 필드 매핑
- 배치 upsert + 행 단위 에러 피드백

---

## 10. TypeScript 타입 구조 (`lib/types/index.ts`, ~425줄)

```typescript
// 열거형
SlipType          // 'sale' | 'purchase'
LogType           // 'in' | 'out' | 'return_in' | 'return_out' | 'transfer_in' | 'transfer_out' | 'adjustment' | 'bundle_out'
PaymentMethod     // 'cash' | 'transfer' | 'card' | 'note'
PaymentType       // 'cash' | 'credit' | 'mixed'
PartnerType       // 'supplier' | 'customer' | 'both'

// 엔티티
Business, Channel, Warehouse, Partner, Staff
Product, ProductPrice, BundleItem
Inventory, StockLog, StocktakeSession, StocktakeItem
Slip, SlipItem, Payment, Note, CashBook
Quote, QuoteItem, PurchaseOrder, PurchaseOrderItem
Return, RegularCustomer, TaxInvoice
ChannelOrder, ChannelOrderItem, SalesTarget
```

---

## 11. 환경 변수

```env
# Supabase (필수)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# 네이버 커머스 API (스마트스토어 연동 시 필수)
NAVER_COMMERCE_CLIENT_ID=xxxxx
NAVER_COMMERCE_CLIENT_SECRET=$2a$04$...

# 텔레그램 봇 (선택)
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_CHAT_ID=123456789
```

---

## 12. 구현 현황

### 완료 (✅)
- 사업자·채널·창고·거래처·상품 CRUD
- 거래전표 (매출·매입) 입력 및 집계
- 재고 관리 (조회·조정·실사·원장)
- 견적서·발주서 워크플로우
- 반품 관리
- 현금출납·어음·수표·세금계산서
- 다단계 가격표 (거래처×채널)
- 채널별 순수익 계산
- 연간·분기 손익 리포트
- 알림 센터 (5종)
- 시스템 감사 로그 + 실시간 터미널
- Excel 9종 내보내기
- 네이버 스마트스토어 API 연동 (수동)
- PDF 출력 (견적서·전표·가격표)
- 데이터 마이그레이션

### 부분 구현 (⚠️)
| 기능 | 상태 |
|------|------|
| 네이버 자동 동기화 | node-cron 코드 존재, 실행 미설정 |
| Excel 가져오기 | 내보내기만 완성, 가져오기 검증 미완 |
| 텔레그램 봇 알림 | 스켈레톤만 존재 |

### 미구현 (❌)
| 기능 | 우선순위 |
|------|---------|
| 쿠팡/자사몰 채널 연동 | 높음 |
| 홈택스 세금계산서 연동 | 높음 |
| 영업사원 실적 관리 | 중간 |
| CS/AS 고객서비스 모듈 | 중간 |
| 바코드 스캐너 HID 연동 | 중간 |
| OCR 상품 인식 | 낮음 |
| 이중 인증 (MFA) | 낮음 |

---

## 13. 시드 데이터 현황

- 사업자: 3개 (본점, 강남점, 온라인)
- 채널: 4개 (네이버, 쿠팡, 오프라인, 자사몰)
- 창고: 3개 (사업자별 1개)
- 거래처: 17개 (공급업체 5, 고객사 10, 양쪽 2)
- 상품: 25개 (필기구, 용지, 노트, 바인더, 메모, 파일, 사무용품, 접착제)
- 더미 거래 데이터: 약 100건

---

## 14. 성능 최적화 현황

### 적용됨
- `Promise.all()` 병렬 쿼리 (대시보드)
- Zustand 클라이언트 캐시 (사업자 선택 상태)
- `activity_logs` 인덱스: `created_at`, `action_type`, `user_id`
- `partner_prices` 인덱스: `partner_id`, `product_id`
- stock_logs 조회 LIMIT 300

### 개선 여지
- 거래처·상품·사업자 목록 캐싱 (변경 빈도 낮음)
- 전표 목록 페이지네이션 (현재 전체 페치)
- 대시보드 월별 통계 6쿼리 → CTE 1쿼리로 통합
- 재고 스냅샷 증분 방식 도입

---

## 15. 보안 현황

### 적용됨
- Supabase Auth (이메일/패스워드)
- RLS (Row-Level Security): activity_logs, partner_prices
- SSR 세션 기반 인증 (쿠키)
- NEXT_PUBLIC vs 비공개 환경변수 분리
- Zod 입력 검증
- 전체 변경 감사 로그

### 개선 필요
- API 라우트 레이트 리미팅
- Description 필드 HTML 새니타이징
- 이중 인증 (MFA)
- Naver API 키 암호화 저장

---

*이 문서는 2026-03-29 기준 코드베이스 전체 분석 결과입니다.*
