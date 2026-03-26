# Cursor 프롬프트 모음 — 문구 도매 통합 관리 시스템
# 처음부터 전체 구축 버전

이 파일의 프롬프트를 순서대로 Cursor 채팅창에 붙여넣어 사용한다.
각 STEP은 이전 STEP이 완료된 후 진행한다.

---

## ── STEP 0 ── Supabase 설정 (Cursor 아님 — Supabase 대시보드 SQL 에디터)

> .cursorrules 파일의 "데이터베이스 스키마" → "RPC 함수" → "RLS 설정" → "Seed 데이터" 순서로
> Supabase SQL 에디터에서 직접 실행한다.
>
> ⚠️ RLS 미설정 시 누구나 DB 전체 조회 가능 — 반드시 실행 후 개발 시작

---

## ── STEP 1 ── 프로젝트 초기화

```
Next.js 14 App Router + TypeScript + Tailwind CSS 프로젝트를 초기화해줘.

설치 패키지:
- @supabase/supabase-js @supabase/ssr
- zustand
- react-hook-form @hookform/resolvers zod
- recharts
- date-fns
- sonner
- xlsx

.env.local 파일:
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

tsconfig.json에 path alias 설정:
- @/* → ./*
```

---

## ── STEP 2 ── Supabase 클라이언트 + 타입 정의

```
/lib/supabase/ 폴더에 아래 파일을 만들어줘.

1. client.ts — 브라우저용 Supabase 클라이언트
2. server.ts — 서버 컴포넌트용 (SSR 쿠키 방식)
3. middleware.ts — 세션 갱신 미들웨어 헬퍼
4. types.ts — .cursorrules의 모든 테이블 TypeScript Row 타입 정의

types.ts에 포함할 타입:
Business, Channel, Warehouse, Partner, Staff,
Product, ProductPrice, BundleItem,
Inventory, StockLog, StocktakeSession, StocktakeItem,
Slip, SlipItem, Payment, Note, CashBook,
Quote, QuoteItem, PurchaseOrder, PurchaseOrderItem,
Return, RegularCustomer, RegularCustomerItem,
TaxInvoice, ChannelOrder, ChannelOrderItem,
SalesTarget, ProductDefaultPartner

SlipType: 'sale' | 'purchase'
LogType: 'in' | 'out' | 'return_in' | 'return_out' | 'transfer_in' | 'transfer_out' | 'adjustment' | 'bundle_out'
PaymentMethod: 'cash' | 'transfer' | 'card' | 'note'
```

---

## ── STEP 3 ── 로그인·인증·미들웨어

```
Supabase Auth를 사용한 인증 기능을 구현해줘.

1. /app/(auth)/login/page.tsx
   - 이메일 + 비밀번호 로그인 폼
   - React Hook Form + Zod 유효성 검사
   - 로그인 성공 시 /dashboard 리다이렉트
   - 에러 메시지 한국어 표시
   - 로딩 중 버튼 비활성화

2. /middleware.ts
   - 미인증 사용자 → /login 리다이렉트
   - 로그인 상태에서 /login 접근 → /dashboard 리다이렉트

3. 로그아웃 버튼 컴포넌트 /components/auth/LogoutButton.tsx
```

---

## ── STEP 4 ── 전역 상태 + 공통 레이아웃

```
아래를 구현해줘.

1. /store/businessStore.ts (Zustand)
   - selectedBusinessId: string ('all' 또는 특정 business uuid)
   - setSelectedBusiness 액션
   - persist 미들웨어로 localStorage 저장

2. /store/warehouseStore.ts (Zustand)
   - selectedWarehouseId: string | null
   - setSelectedWarehouse 액션

3. /app/(dashboard)/layout.tsx
   왼쪽 사이드바 (너비 240px) + 상단 헤더 구성.

   헤더:
   - 사업자 선택 드롭다운 (전체 + 각 사업자)
   - 알림 아이콘 (재고 부족 수 배지)
   - 로그아웃 버튼

   사이드바 메뉴:
   - 대시보드 (/dashboard)
   ─── 거래 ───
   - 거래 입력 (/transactions) ← 거래명세표 매출·매입 핵심
   - 매출 현황 (/sales)
   - 구매 현황 (/purchase)
   ─── 재고 ───
   - 재고 관리 (/inventory)
   - 재고 실사 (/stocktake)
   ─── 관리 ───
   - 상품 관리 (/products)
   - 거래처 관리 (/partners)
   - 영업사원 (/staff)
   ─── 문서 ───
   - 견적서·발주서 (/quotes)
   - 반품·불량 (/returns)
   - 번들 상품 (/bundles)
   - 정기 고객 (/customers)
   ─── 재무 ───
   - 현금 출납 (/cash)
   - 세금계산서 (/tax)
   ─── 기타 ───
   - 보고서 (/reports)
   - 알림 센터 (/alerts)
   - 설정 (/settings)

   모바일: 사이드바 햄버거 메뉴로 전환
   Tailwind 스타일링
```

---

## ── STEP 5 ── 기준 정보 설정 페이지

```
/app/(dashboard)/settings/page.tsx를 만들어줘.

탭 구성:

1. 사업자 관리
   - businesses 테이블 목록·등록·수정·삭제
   - 필드: 사업자명, 사업자등록번호, 대표자명, 주소, 전화, 이메일

2. 채널·수수료 설정
   - channels 테이블 목록·수정
   - 필드: 채널명, 플랫폼수수료율, 결제수수료율, 기본배송비
   - 수정 즉시 이익 계산에 반영

3. 창고 관리
   - warehouses 테이블 목록·등록·수정·삭제
   - 필드: 창고명, 사업자, 주소, 비고

4. 카테고리 관리
   - data/product-categories.json 기반
   - 카테고리 추가·삭제 (API Route로 파일 업데이트)

5. 엑셀 가져오기
   - .xlsx 파일 업로드 (drag & drop + 파일 선택)
   - 가져오기 유형: 상품목록 / 거래처 / 재고수량
   - 컬럼 매핑 UI: 엑셀 첫 행 헤더 읽어 DB 컬럼과 연결
   - 미리보기 테이블 (첫 5행)
   - 중복 처리: 덮어쓰기 / 건너뛰기 선택
   - 결과: 성공N건 / 실패N건 / 건너뜀N건

/lib/supabase/settings.ts에 쿼리 함수 분리.
```

---

## ── STEP 6 ── 상품 관리

```
/app/(dashboard)/products/page.tsx와 관련 컴포넌트를 만들어줘.

1. 상품 목록 테이블
   - 컬럼: 바코드, 상품명, 카테고리, 단위, 매입단가, 판매단가, 최소재고, 사업자, 액션
   - 검색: 상품명·바코드 실시간 검색
   - 필터: 카테고리, 사업자
   - 페이지네이션 20행

2. 상품 등록·수정 모달
   - 필드: 바코드, 상품명, 카테고리(셀렉트), 단위, 매입단가, 판매단가,
           최소재고, 사업자(셀렉트), 비고
   - React Hook Form + Zod

3. 거래처별·등급별 특수단가 설정 (상품 상세 탭)
   - product_prices 테이블 CRUD
   - 거래처 선택 + 단가 입력
   - 적용 우선순위 안내 표시

4. 상단 요약 카드
   - 전체 상품 수, 재고 부족 상품 수, 이번달 입출고 건수

/lib/supabase/products.ts에 함수 분리:
- getProducts(params)
- createProduct(data)
- updateProduct(id, data)
- getProductPrices(productId)
- upsertProductPrice(data)

공통 컴포넌트 /components/ui/ProductSearchInput.tsx:
- props: businessId?, onSelect(product), excludeBundles?
- 입력 시 /api/products?q=&businessId= 호출 (debounce 300ms)
- 드롭다운: 상품명 + 바코드 + 현재고 표시
- 키보드 방향키 + Enter 선택
- 이후 모든 상품 선택 UI에서 이 컴포넌트 사용
```

---

## ── STEP 7 ── 거래처·영업사원 관리

```
거래처와 영업사원 관리 페이지를 만들어줘.

1. /app/(dashboard)/partners/page.tsx
   - 거래처 목록 테이블
   - 컬럼: 거래처명, 구분(공급/고객/양방), 연락처, 이메일, 외상한도,
           미수금(계산값), 미지급금(계산값), 최근거래일, 액션
   - 미수금 = 해당 거래처 매출 slips 합계 - payments(receive) 합계
   - 미지급금 = 해당 거래처 매입 slips 합계 - payments(pay) 합계
   - 거래처 등록·수정 모달
   - 거래처 상세 클릭 시 사이드 패널: 거래 이력·단가 변동 차트

2. /app/(dashboard)/staff/page.tsx
   - 영업사원 목록: 이름, 사업자, 전화, 단가등급, 상태
   - 등록·수정 모달

/lib/supabase/partners.ts, /lib/supabase/staff.ts에 함수 분리.
```

---

## ── STEP 8 ── 재고 관리 + 바코드 입출고

```
/app/(dashboard)/inventory/page.tsx와 관련 컴포넌트를 만들어줘.

1. 재고 목록 테이블
   - 컬럼: 바코드, 상품명, 카테고리, 창고, 사업자, 현재고, 최소재고, 상태(정상/주의/부족), 액션
   - 현재고 <= 최소재고: 행 배경 빨간색
   - 검색·사업자·창고 필터
   - 페이지네이션 20행

2. 바코드 스캔 입출고 모달 (입고/출고 버튼 클릭 시)
   - 바코드 입력창 (autoFocus, Enter 감지)
   - 스캔 → 상품 조회 → 상품명·현재고 표시
   - 수량 입력 → 거래처 선택(선택) → 단가 입력(기본값 자동)
   - 채널 선택 (출고 시)
   - 창고 선택
   - 저장: process_stock_in 또는 process_stock_out RPC 호출
   - 바코드 없는 상품: "등록되지 않은 바코드" 오류
   - 재고 부족: RPC 에러 sonner로 표시

3. 재고 조정 버튼 (행별)
   - 실제 수량 입력 + 사유 메모 (필수)
   - process_stock_adjustment RPC 호출

4. 상단 요약 카드 3개
   - 전체 상품 수, 재고 부족 수, 오늘 입출고 건수

/lib/supabase/inventory.ts에 함수 분리.
```

---

## ── STEP 9 ── 거래 입력 (거래명세표 — 핵심)

```
/app/(dashboard)/transactions/page.tsx를 만들어줘.
이 페이지가 시스템의 핵심으로, 매출·매입 거래를 입력하는 화면이다.

1. 거래 목록 (상단)
   - 탭: 전체 / 매출 / 매입
   - 컬럼: 전표번호, 날짜, 유형, 거래처, 품목수, 공급가액, 세액, 합계, 담당자, 세금계산서, 액션
   - 기간 필터 (오늘/이번주/이번달/직접설정)
   - 사업자·거래처 필터

2. 거래 입력 버튼 → 거래 입력 모달 (전체화면 모달 권장)

   거래 입력 모달 구성:
   [헤더]
   - 구분 선택: 매출 / 매입 (토글)
   - 전표날짜, 거래처 검색·선택, 사업자, 창고, 담당 영업사원
   - 결제방법: 현금 / 외상 / 혼합
   - 현금수령액 (혼합 시 입력)

   [품목 입력 테이블]
   - 행 추가 버튼 또는 바코드 스캔으로 행 추가
   - 각 행: 상품 검색(ProductSearchInput), 수량, 단가, 금액(자동계산), 비고
   - 단가는 거래처별 특수단가 → 기본 판매단가 자동 적용 (수동 수정 가능)
   - 행 삭제 버튼

   [합계 표시]
   - 공급가액 합계, 세액 (공급가액 × 10%), 총합계
   - 세금계산서 발행 여부 체크박스

   [저장 로직]
   - slips 테이블에 헤더 INSERT
   - slip_items 테이블에 품목 INSERT
   - process_stock_out (매출) 또는 process_stock_in (매입) RPC 호출 (품목별)
   - 결제방법이 '현금'이면 payments 테이블에도 INSERT
   - 전표번호 자동 생성: 매출=S-YYYYMMDD-NNNN, 매입=P-YYYYMMDD-NNNN

3. 거래 상세 보기·수정·삭제 (미확정 건만)
4. 거래명세표 PDF 미리보기 버튼

/lib/supabase/slips.ts에 함수 분리:
- getSlips(params)
- createSlip(header, items) — 트랜잭션 처리
- updateSlip(id, data)
- deleteSlip(id)
```

---

## ── STEP 10 ── 매출 현황·미수금 관리

```
/app/(dashboard)/sales/page.tsx를 만들어줘.

탭 구성:

1. 매출 현황
   - 기간·사업자·거래처·채널 필터
   - 테이블: 날짜, 거래처, 품목수, 공급가액, 세액, 합계, 결제방법, 미수잔액
   - 거래처별 매출 합계 요약 카드

2. 미수금 현황 (외상매출금)
   - 거래처별 미수금 목록
   - 컬럼: 거래처명, 누적 매출, 수금액, 미수잔액, 최근 거래일
   - 미수잔액 오름차순 정렬 (큰 금액 위로)
   - 외상한도 초과 거래처 빨간 강조

3. 수금 입력
   - 거래처 선택 + 수금금액 + 수금방법 + 날짜
   - payments 테이블에 INSERT (payment_type='receive')
   - 수금 즉시 미수잔액 갱신

4. 매출 원장 (거래처 클릭 시)
   - 해당 거래처 매출·수금 전체 이력
   - 잔액 누적 표시

/lib/supabase/sales.ts에 함수 분리.
```

---

## ── STEP 11 ── 구매 현황·미지급금 관리

```
/app/(dashboard)/purchase/page.tsx를 만들어줘.
STEP 10(매출/미수금)과 동일한 구조로, 매입/미지급금 버전으로 만들어줘.

탭 구성:

1. 매입 현황
   - 기간·사업자·거래처 필터
   - 테이블: 날짜, 거래처, 품목수, 공급가액, 세액, 합계, 결제방법, 미지급잔액

2. 미지급금 현황 (외상매입금)
   - 거래처별 미지급금 목록
   - 컬럼: 거래처명, 누적 매입, 지급액, 미지급잔액, 최근 거래일

3. 지급 입력
   - payments 테이블에 INSERT (payment_type='pay')

4. 매입 원장

/lib/supabase/purchase.ts에 함수 분리.
```

---

## ── STEP 12 ── 매출 대시보드

```
/app/(dashboard)/dashboard/page.tsx를 만들어줘. Recharts 사용.

1. 상단 요약 카드 (사업자 필터 적용)
   - 오늘 매출 합계
   - 이번달 매출 합계
   - 이번달 이익 합계 + 이익률
   - 미수금 총액 (클릭 시 /sales 이동)
   - 재고 부족 상품 수 (클릭 시 /alerts 이동)
   - 이번달 매출 목표 달성률 (프로그레스 바)

2. 차트
   - 최근 30일 일별 매출 추이 (LineChart)
   - 채널별 매출 비중 이번달 (PieChart)
   - 최근 6개월 매출 vs 이익 비교 (BarChart)

3. 베스트셀러 TOP 10 (이번달 출고수량 기준)
   - 상품명, 출고수량, 매출액, 이익률

4. 최근 거래 10건 (slips 테이블)

5. 입고 예정 D-7 이내 목록 (purchase_orders)

모든 집계: slips + slip_items + channels 테이블 기반
사업자 전체/개별 전환 지원
```

---

## ── STEP 13 ── 이익 계산 페이지

```
/app/(dashboard)/profit/page.tsx를 만들어줘.

1. 상품별 채널별 이익 계산 테이블
   - 컬럼: 상품명, 매입단가, 판매단가, 채널, 플랫폼수수료, 결제수수료, 배송비, 실이익, 이익률
   - 이익률 < 10%: 빨간 텍스트
   - 이익률 >= 30%: 초록 텍스트
   - 사업자·번들 포함 여부 필터

2. 손익분기 계산기 (우측 패널)
   - 매입단가 입력
   - 채널 선택 (channels 테이블에서 조회)
   - 목표이익률 슬라이더 (0~50%)
   - 결과: 최소 판매가 실시간 계산

수수료율은 channels 테이블에서 조회 (하드코딩 금지)
/lib/utils/profit.ts에 계산 함수 분리
```

---

## ── STEP 14 ── 입고 예정 · 견적서

```
아래 두 페이지를 만들어줘.

1. /app/(dashboard)/quotes/page.tsx — 견적서·발주서

   탭: 견적서 / 발주서

   견적서 기능:
   - 목록: 견적번호, 날짜, 거래처, 합계, 상태(초안/발송/채택/거절/만료)
   - 등록 모달: STEP 9 거래 입력과 유사한 품목 입력 테이블
   - 견적서 → 거래명세표 변환 버튼 (slip 자동 생성)
   - PDF 출력 버튼

2. /app/(dashboard)/purchase-orders/page.tsx — 입고 예정

   목록:
   - D-day 컬럼: D-3 이하 빨간 배지, D-7 이하 주황 배지, 지남 회색
   - 컬럼: 거래처, 예정일, D-day, 품목수, 상태, 액션

   등록 모달:
   - 거래처·예정일·창고·품목 입력 (ProductSearchInput 사용)

   실입고 처리:
   - 실제 입고 수량 확인·수정 가능
   - 저장: process_stock_in RPC 호출 + purchase_order_items.received_quantity 업데이트
   - 전량 완료 시 status='done'

/lib/supabase/quotes.ts, /lib/supabase/purchaseOrders.ts에 함수 분리.
```

---

## ── STEP 15 ── 반품·불량 관리

```
/app/(dashboard)/returns/page.tsx를 만들어줘.

1. 반품 접수 모달
   - 상품 검색 (ProductSearchInput)
   - 수량, 반품사유(단순변심/불량/오배송/기타)
   - 처리방법(재입고 가능/폐기/공급사 반품)
   - 거래처 연결 (선택)
   - 원거래 연결 (ref_slip_id, 선택)
   - 메모

2. 저장 로직
   - returns 테이블 INSERT
   - disposition='restock': process_stock_return_in RPC 즉시 호출, restock_done=true

3. 반품 목록
   - 상태 탭: 전체 / 접수 / 검수중 / 완료
   - 컬럼: 접수일, 상품명, 수량, 사유, 처리방법, 상태, 재입고여부
   - 상태 변경 버튼 (접수 → 검수중 → 완료)

4. 상단 통계 카드
   - 이번달 반품 건수, 반품 수량, 불량 비율(%), 재입고 건수

/lib/supabase/returns.ts에 함수 분리.
```

---

## ── STEP 16 ── 번들 상품 관리

```
/app/(dashboard)/bundles/page.tsx를 만들어줘.

1. 번들 상품 생성 모달
   - 번들 상품명 입력 (products.is_bundle=true로 등록)
   - 구성품 추가: ProductSearchInput + 수량 (여러 행 추가 가능)
   - bundle_items 테이블에 저장

2. 번들 목록
   - 번들명, 구성품 요약, 판매 가능 여부
   - 판매 가능: 모든 구성품 재고 >= 1 이상
   - 부족 구성품명 표시

3. 번들 출고 처리
   - 수량 입력
   - process_bundle_out RPC 호출 (단일 트랜잭션)

/lib/supabase/bundles.ts에 함수 분리.
```

---

## ── STEP 17 ── 정기 구매 고객

```
/app/(dashboard)/customers/page.tsx를 만들어줘.

1. 고객 등록 모달
   - 거래처 연결 (partners.id), 채널, 주문 주기(일), 메모
   - 주요 주문 상품: ProductSearchInput + 평소수량 + 평소단가 (여러 행)

2. 고객 목록
   - 컬럼: 거래처명, 채널, 주문주기, 마지막주문일, 다음주문예정일, 상태
   - 다음주문예정일 = 마지막주문일 + 주문주기
   - D-3 이내 또는 지난 고객: 상단 정렬 + 강조

3. 주문 복사 출고 모달
   - 기본 주문 상품 목록 불러오기
   - 수량 수정 가능, 체크박스 선택
   - 출고 처리: process_stock_out RPC 호출 (선택 항목별)
   - last_order_date = 오늘 업데이트
   - sonner: "출고 처리 완료 (N건)"

/lib/supabase/customers.ts에 함수 분리.
```

---

## ── STEP 18 ── 현금 출납 + 어음 관리

```
/app/(dashboard)/cash/page.tsx를 만들어줘.

탭 구성:

1. 현금 출납장
   - 수입/지출 입력 폼: 날짜, 구분(수입/지출), 금액, 분류, 설명
   - cash_book 테이블 CRUD
   - 일별 목록 테이블: 날짜, 구분, 분류, 설명, 금액, 잔액(누적)
   - 기간별 합계 카드 (수입합계, 지출합계, 잔액)

2. 받을 어음 관리
   - notes 테이블 (note_type='receivable')
   - 목록: 발행인(거래처), 어음번호, 발행일, 만기일, 금액, 상태
   - D-30 이내 만기 어음 강조 표시
   - 상태 변경: pending → cleared / bounced

3. 지급 어음 관리
   - notes 테이블 (note_type='payable')
   - 동일 구조

/lib/supabase/cash.ts, /lib/supabase/notes.ts에 함수 분리.
```

---

## ── STEP 19 ── 세금계산서

```
/app/(dashboard)/tax/page.tsx를 만들어줘.

1. 세금계산서 목록
   - 탭: 발행 / 수취
   - 컬럼: 발행일, 거래처, 공급가액, 세액, 합계, 상태, 국세청 연동 여부
   - 기간·거래처 필터

2. 세금계산서 발행 모달
   - 거래처 선택, 공급가액 입력 (또는 slips에서 연결)
   - 세액 자동 계산 (공급가액 × 10%)
   - 발행 유형: 건별 / 합계
   - 저장: tax_invoices 테이블 INSERT

3. 분기별 집계 탭
   - 분기별 매출/매입 세금계산서 공급가액·세액 합계
   - Excel 내보내기 버튼

4. 국세청 홈택스 연동 안내
   - hometax_synced=false 건 목록
   - "홈택스 연동 예정" 안내 배너 (API 연동은 추후 모듈로 추가)

/lib/supabase/taxInvoices.ts에 함수 분리.
```

---

## ── STEP 20 ── 재고 실사

```
/app/(dashboard)/stocktake/page.tsx를 만들어줘.

1. 실사 세션 목록
   - 컬럼: 세션명, 사업자, 창고, 상태, 시작일, 완료일
   - "새 실사 시작" 버튼

2. 새 실사 시작 모달
   - 세션명 입력, 사업자·창고 선택
   - 시작 시 현재 재고 전량 snapshot (stocktake_items에 system_quantity 기록)

3. /app/(dashboard)/stocktake/[sessionId]/page.tsx
   - 실사 진행 화면
   - 바코드 스캔으로 실물 수량 입력 (StockScanModal 방식)
   - 상태 탭: 전체 / 미입력 / 차이있음 / 일치
   - 차이 요약 카드: 플러스 차이 합계 / 마이너스 차이 합계
   - "조정 반영" 버튼: 차이 있는 항목 일괄 process_stock_adjustment RPC 호출
   - 조정 후 session.status='done'

/lib/supabase/stocktake.ts에 함수 분리.
```

---

## ── STEP 21 ── 보고서·출력

```
/app/(dashboard)/reports/page.tsx를 만들어줘.

카드 그리드 형태로 보고서 목록 표시. 각 카드 클릭 시 조건 입력 후 다운로드.

1. 재고 현황 보고서 (Excel)
   - 현재 재고 전체 목록
   - 컬럼: 바코드, 상품명, 카테고리, 사업자, 창고, 현재고, 최소재고, 매입단가, 재고금액
   - 재고 부족 행 빨간 배경

2. 매출 보고서 (Excel, 3개 시트)
   - 시트1: 일별 매출 요약 (날짜, 매출, 이익, 건수)
   - 시트2: 상품별 매출 (상품명, 출고수량, 매출액, 이익액, 이익률)
   - 시트3: 거래처별 매출 (거래처명, 매출액, 수금액, 미수잔액)

3. 매입 보고서 (Excel)
   - 거래처별 매입 현황, 미지급금 현황

4. 미수금 현황 보고서 (Excel)
   - 거래처별 미수금 잔액 목록

5. 이익 분석 보고서 (Excel)
   - 상품별 채널별 이익률 분석

6. 거래처 원장 (Excel)
   - 거래처 선택 + 기간 설정
   - 매출·수금 전체 이력

조건 입력: 사업자, 기간(시작일~종료일)
다운로드: xlsx 파일 Content-Disposition 헤더로 파일명 지정
xlsx 라이브러리 사용 (utils.book_new, utils.aoa_to_sheet, writeFile)
```

---

## ── STEP 22 ── 알림 센터

```
/app/(dashboard)/alerts/page.tsx를 만들어줘.

탭 구성:

1. 재고 부족
   - inventory.quantity <= products.min_stock 상품 목록
   - 컬럼: 상품명, 사업자, 창고, 현재고, 최소재고, 부족량, 입고 예정일
   - "발주서 생성" 버튼 → /purchase-orders 로 해당 상품 미리 선택

2. 입고 임박 (D-7 이내)
   - purchase_orders 중 D-7 이내 항목
   - D-3 이하 빨간 배지

3. 미수금 위험 거래처
   - 외상한도(partners.credit_limit) 초과 거래처
   - 미수잔액 큰 순 정렬

4. 어음 만기 임박 (D-30 이내)
   - notes 테이블 만기일 기준

5. 반품 미처리 (status='received' 오래된 순)

DashboardShell 헤더 알림 아이콘 배지에 재고부족 수 실시간 표시.
/app/api/alerts/summary/route.ts: 각 알림 수 집계 API.
```

---

## ── STEP 23 ── 거래명세표 PDF 출력

```
거래명세표 PDF 출력 기능을 구현해줘.

1. /components/print/SlipPrintView.tsx
   - 인쇄용 A4 레이아웃 컴포넌트
   - 상단: 공급자(사업자) 정보, 수신: 거래처 정보, 전표번호·날짜
   - 품목 테이블: 품목명, 규격, 단위, 수량, 단가, 금액
   - 하단: 공급가액 합계, 세액, 총합계
   - Tailwind print: 클래스 활용

2. /app/api/reports/slip-pdf/[id]/route.ts
   - GET: slips + slip_items + 거래처 + 사업자 정보 조회
   - HTML → PDF 변환 후 Content-Disposition: attachment 반환
   - (간소화 버전: 브라우저 window.print() 활용도 가능)

3. 거래 목록에서 각 행의 "인쇄" 버튼 클릭 시 PDF 미리보기 모달 표시
   - 모달 내 "인쇄" / "PDF 저장" 버튼
```

---

## ── STEP 24 ── 모바일 최적화 (PWA)

```
전체 시스템을 모바일에서도 잘 동작하도록 최적화해줘.

1. PWA 설정
   - /public/manifest.json 생성 (앱 이름, 아이콘, 시작 URL)
   - next.config.mjs에 PWA 설정
   - 홈화면 추가 안내 배너 (최초 접속 시)

2. 모바일 핵심 기능 최적화
   - 바코드 스캔 모달: 카메라 OCR 연동 (모바일에서 카메라 버튼 표시)
   - 거래 입력: 모바일에서 바텀 시트 형태로 전환
   - 테이블: 모바일에서 카드 뷰로 전환
   - 버튼 최소 높이 44px
   - 폰트 최소 14px

3. 모바일 전용 간소 대시보드
   - 핵심 지표만 카드로 표시
   - 빠른 입고/출고 버튼 (플로팅)
   - 재고 조회 + 바코드 스캔

Tailwind sm: / md: 반응형 클래스 활용.
```

---

## ── 공통 프롬프트 ──

### 버그 수정

```
아래 에러가 발생했어. 원인을 분석하고 수정해줘.

[파일 경로]:
[에러 메시지]:
[어떤 동작을 했을 때 발생]:

수정할 때 다른 파일에 영향 가지 않게 최소한으로만 변경해줘.
```

### 리팩토링

```
[파일명] 파일을 리팩토링해줘.
- 중복 코드 함수로 분리
- 타입 정의 누락된 곳 추가
- 500줄 넘으면 컴포넌트 분리
기존 동작은 절대 바뀌면 안 돼.
```

### 페이지 모바일 최적화

```
[페이지명] 페이지를 모바일에서도 잘 보이게 반응형으로 수정해줘.
- 테이블: 모바일에서 가로 스크롤 또는 카드 뷰
- 버튼 최소 높이 44px
- 폰트 최소 14px
- 모달: 모바일에서 바텀 시트
Tailwind sm: / md: 활용.
```

---

## ── 향후 모듈 추가 (운영 안정 후) ──

| 모듈 | 설명 | 연동 |
|------|------|------|
| M1 — 쇼핑몰 주문 수집 | 스마트스토어·쿠팡 주문 자동 수집 | 네이버/쿠팡 Open API |
| M2 — 카카오 알림톡 | 거래명세표 카카오톡 전송 | 카카오 비즈메시지 API |
| M3 — 문자 발송 | 거래처별 SMS/LMS 발송 | 나이스 문자 API 등 |
| M4 — 홈택스 연동 | 전자세금계산서 국세청 자동 발행 | 국세청 API |
| M5 — 실시간 계좌 조회 | 은행 계좌·카드 내역 자동 연동 | 오픈뱅킹 API |
| M6 — AI 수요 예측 | 과거 데이터로 발주량 자동 추천 | 데이터 6개월+ 필요 |
| M7 — 자동 발주 | 최소재고 도달 시 발주서 자동 생성 | 이메일 발송 연동 |
