# 구현 상세

## 인프라 / 공통

- **인증**: 로그인(`/login`), 회원가입(`/signup`) — Supabase Auth
- **미들웨어**: 전체 라우트 인증 가드 (`middleware.ts`) — 공개: /login, /signup, /api/*
- **레이아웃**: `app/(dashboard)/layout.tsx` — Sidebar + Header
- **상태관리**: `store/businessStore.ts` — Zustand persist
  - `selectedBusinessId`: 선택된 사업자 (`'all'` 또는 UUID)
  - `selectedChannelId`: 선택된 채널 (`'all'` 또는 UUID) — 사업자 전환 시 자동 초기화
- **헤더**: 2단 구조 — 1행: 사업자 세그먼트 / 2행: 채널 세그먼트 (사업자 선택 시만)

---

## 대시보드 (`/dashboard`)

- KPI 4개 카드: 이달 매출, 매입, 이익, 저재고 수
- 최근 6개월 매출 Recharts 바차트
- 최근거래 10건 목록

---

## 거래전표 (`/transactions`)

- 전표 목록: 구분(매출/매입/전체) 세그먼트, 날짜 범위, 키워드 필터
- KPI 요약: 매출 합계 · 매입 합계 · 미수금 잔액
- **SlipFormModal**: 매출/매입 토글, 사업자·거래처·채널·창고·결제방식 선택
  - 채널 드롭다운은 선택된 사업자의 채널만 (`filteredChannels` 적용)
  - 품목 동적 추가/삭제, 상품 선택 시 단가 자동 세팅
  - 공급가액·부가세·합계 실시간 계산
  - 저장 시 `slip_no` 자동 채번 + `adjust_inventory` RPC로 재고 반영
- **SlipDetailModal**: 기본정보·품목·금액 요약·미수금 표시·삭제(2-step)
- DB: `lib/supabase/slips.ts` — `fetchSlips`, `fetchSlipWithItems`, `createSlip`, `deleteSlip`

---

## 통합 주문 (`/orders`) — 네이버 스마트스토어

- KPI 5개: 30일 총 주문 · 결제완료 · 배송중 · 배송완료 · 취소/반품
- 상태 세그먼트 필터, 채널별 필터 드롭다운, 날짜 범위 필터 (기본 90일)
- 3가지 뷰 모드: 표(12컬럼) / 목록(좌측 상태 컬러바) / 카드(4열 그리드)
- 페이지네이션: 10 / 50 / 100개씩, 스마트 페이지 번호
- 슬라이드 상세 패널: 상품·구매자·수령인·배송·처리상태
- DB: `lib/supabase/orders.ts` — `fetchChannelOrders`, `fetchOrderStats`, `markOrderProcessed`

---

## 매출 집계 (`/sales`)

- 필터: 날짜 범위 + 빠른 선택(이번달/3개월/6개월/올해) + 결제방식 + 초기화
- KPI 4개: 매출 합계 · 전표 건수 · 공급가액(부가세 제외) · 미수금
- 6개월 추이 바차트: 매출(파랑) + 매입(회색)
- 거래처별 매출 상위: 순위 + 점유율 프로그레스 바 + 건수
- 채널별 매출: 채널 색상 구분 + 점유율 프로그레스 바 + 건수
- 매출 전표 목록: 키워드 검색 + 페이지네이션 + 클릭 시 SlipDetailModal
- DB: `lib/supabase/sales.ts` — `fetchSalesKPI`, `fetchMonthlySales`, `fetchPartnerSales`, `fetchChannelSalesAgg`, `fetchSalesSlips`, `fetchChannelMonthlyBreakdown`

---

## 채널별 매출 (`/channel-sales`)

- 필터: 날짜 범위 + 채널 드롭다운 + 빠른 기간 선택 + 초기화
- KPI 4개: 총 매출(전 채널) · 활성 채널 수 · 최고 채널명 · 건당 평균
- 채널별 6개월 그룹 바차트: 채널마다 고유 색상
- 채널 점유율 테이블: 색상 닷 + 프로그레스 바 + 점유율% + 건수 / 행 클릭 시 채널 필터 토글
- 매출 전표 목록: 채널 색상 닷 인디케이터
- DB: `lib/supabase/sales.ts` 재사용 — `fetchChannelSalesAgg`, `fetchChannelMonthlyBreakdown`, `fetchSalesSlips`

---

## 매입 집계 (`/purchase`)

- 필터: 날짜 범위 + 결제방식 + 빠른 기간 선택 + 초기화
- KPI 4개: 매입 합계(주황) · 전표 건수 · 공급가액 · 미지급금
- 6개월 매입 추이 바차트: 주황색 단일 바
- 거래처별 매입 상위: 순위 + 점유율 프로그레스 바 + 건수 (최대 7개)
- 매입 전표 목록: 키워드 검색 + 페이지네이션 + SlipDetailModal
- DB: `lib/supabase/purchase.ts` — `fetchPurchaseKPI`, `fetchMonthlyPurchases`, `fetchPartnerPurchases`, `fetchPurchaseSlips`

---

## 상품 관리 (`/products`)

- KPI 4개: 전체 상품 수 · 카테고리 수 · 세트 상품 수 · 평균 마진율
- 전체/단일/세트 세그먼트 필터, 카테고리 드롭다운, 키워드 검색
- 3가지 뷰 모드 + 페이지네이션 (10/50/100)
- **ProductFormModal**: 사업자·상품명·바코드·카테고리·단위·가격·안전재고·세트여부·메모
  - `<datalist>` 자동완성, 실시간 마진율 표시, 2-step 삭제
- DB: `lib/supabase/products.ts` — `fetchProducts`, `fetchCategories`, `createProduct`, `updateProduct`, `deleteProduct`

---

## 재고 관리 (`/inventory`)

- KPI 4개: 총 SKU 수 · 재고 자산(매입가) · 저재고 경고 수 · 운영 창고 수
- 창고/카테고리 드롭다운 필터, 저재고만 보기 토글, 키워드 검색
- 3가지 뷰 모드 (카드: 재고 프로그레스 바)
- **InventoryAdjustModal**: 재고 조정 탭 + 변동 이력 탭 (`stock_logs` 최근 20건)
- DB: `lib/supabase/inventory.ts` — `fetchInventory`, `fetchInventoryStats`, `adjustInventoryDirect`, `fetchStockLogs`, `fetchWarehouses`

---

## 설정 (`/settings`)

- **사업자 관리**: 목록 테이블 + 모달(이름/사업자번호/대표자/연락처/이메일/주소) + 2-step 삭제
- **채널 관리**: 상단 탭으로 사업자 전환 → 해당 사업자 채널만 표시
  - 플랫폼 선택(네이버/11번가/옥션/G마켓/쿠팡/자사몰/오프라인/기타) 시 채널명 자동 입력
  - 판매수수료 / 결제수수료 / 기본배송비 입력
  - `business_id` 필수

---

## 거래처 관리 (`/partners`)

- KPI 4개: 전체 거래처 수 · 공급업체 수 · 고객사 수 · 총 신용한도
- 유형 세그먼트 필터: 전체 / 공급업체 / 고객사 / 양방향 (탭 전환 시 키워드 자동 초기화)
- 키워드 검색: 거래처명 · 전화 · 이메일 · 사업자번호
- 3가지 뷰 모드: 표(7컬럼) / 목록(컬러바) / 카드(4열 그리드)
- 페이지네이션: 10 / 50 / 100개씩, 스마트 페이지 번호
- **PartnerFormModal**: 등록·수정·삭제(2-step 확인). 삭제 진행 중 backdrop 차단
- 거래처 유형: `supplier` (공급업체) / `customer` (고객사) / `both` (양방향)
- `business_id` 없음 — 전 사업자 공유
- DB: `lib/supabase/partners.ts` — `fetchPartners`, `createPartner`, `updatePartner`, `deletePartner`
- 뷰 컴포넌트: `PartnerTableView`, `PartnerListView`, `PartnerCardView`

---

## 미구현 페이지

| 경로 | 기능 |
|------|------|
| /stocktake, /stock-ledger | 재고 실사·수불 |
| /price-list | 가격표 |
| /partner-ledger | 거래처 원장 |
| /quotes, /returns, /tax | 견적서·반품·세금계산서 |
| /cash, /receivables, /notes | 현금출납·채권채무·어음수표 |
| /reports, /quarterly, /customers | 손익리포트·분기집계·단골고객 |
| /alerts, /logs | 알림센터·시스템로그 |

## v2 로드맵

- 11번가 / 옥션 / 쿠팡 어댑터
- 합포장 처리, 배송정보 일괄 전송
- 주문 → 거래전표 자동 변환 (`markOrderProcessed` 연동)

## v3 로드맵

- 바코드 리더기(Cone-3000) HID 연동
- 상품 정보 채널별 게시/수정
- 통합 CS 수집 + AI 답변 초안
