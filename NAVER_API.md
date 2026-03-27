# 네이버 커머스 API 연동 현황 및 기능 정의

> 마지막 업데이트: 2026-03-27
> 인증 방식: bcrypt 서명 (Client ID + timestamp → bcrypt.hash with Client Secret as salt)
> 기준 토큰 엔드포인트: `POST https://api.commerce.naver.com/external/v1/oauth2/token`

---

## 1. 인증 (Authentication)

| 항목 | 내용 |
|------|------|
| 방식 | Client Credentials (SELF 모드) |
| 서명 알고리즘 | `bcrypt.hash(clientId + "_" + timestamp, clientSecret)` → Base64 |
| 토큰 유효기간 | 약 1시간 (Access Token) |
| 구현 파일 | `lib/naver/auth.ts` |

**주의:** Client Secret 값이 `$2a$04$...` 형식의 bcrypt salt 자체입니다. 일반 HMAC-SHA256 방식이 아닙니다.

---

## 2. 현재 사용 가능한 API (✅ 확인됨)

### 2-1. 주문 조회
```
GET /external/v1/pay-order/seller/product-orders?from=<ISO8601>
```

| 파라미터 | 설명 |
|----------|------|
| `from` | 필수. 조회 시작일 (ISO 8601, e.g. `2026-03-01T00:00:00.000Z`) |
| `to` | 선택. 단, `from`과 **최대 24시간 이내**여야 함. 생략 시 현재까지 전체 조회 |

**조회 가능한 데이터:**
- 주문 ID, 결제일, 결제 금액
- 주문자 이름, 전화번호
- 상품명, 수량, 단가, 결제 금액
- 주문 상태 (아래 상태값 참조)

**주문 상태값 (productOrderStatus):**

| 상태 | 설명 |
|------|------|
| `PAYMENT_WAITING` | 결제 대기 |
| `PAYED` | 결제 완료 |
| `DELIVERING` | 배송 중 |
| `DELIVERED` | 배송 완료 |
| `PURCHASE_DECIDED` | 구매 확정 |
| `CANCEL_REQUEST` | 취소 요청 |
| `CANCELED` | 취소 완료 |
| `RETURN_REQUEST` | 반품 요청 |
| `RETURNED` | 반품 완료 |
| `EXCHANGE_REQUEST` | 교환 요청 |
| `EXCHANGED` | 교환 완료 |

**구현 파일:** `lib/naver/orders.ts`, `app/api/naver/orders/route.ts`

---

### 2-2. 반품·취소 조회
주문 API에서 반품/취소 상태만 필터링하여 제공합니다.

```
getNaverClaims(days) → 내부적으로 getNaverOrders() 후 상태 필터링
```

**조회 가능한 데이터:**
- 반품/취소 구분 (RETURN / CANCEL / EXCHANGE)
- 해당 주문의 상품명, 수량, 주문자 정보
- 클레임 발생일 (주문일 기준)

> ⚠️ 클레임 전용 엔드포인트(`/external/v1/pay-order/seller/claims` 등)는 현재 권한 없음(404).

**구현 파일:** `lib/naver/claims.ts`, `app/api/naver/claims/route.ts`

---

### 2-3. 상품 목록 (주문 기반 집계)
별도 상품 API 권한이 없어 주문 내역에서 상품명을 기준으로 집계합니다.

```
getNaverProducts() → 최근 90일 주문에서 상품별 판매가·판매량 집계
```

**조회 가능한 데이터:**
- 상품명 (주문에 등장한 상품 목록)
- 단가 (최근 주문 기준)
- 누적 판매 수량 (최근 90일)

> ⚠️ 직접 상품 API(`/external/v1/products`, `/external/v1/channel-products`)는 현재 권한 없음(404).

**구현 파일:** `lib/naver/products.ts`, `app/api/naver/products/route.ts`

---

## 3. 현재 권한 없는 API (❌ 404 반환)

| 엔드포인트 | 기능 |
|-----------|------|
| `/external/v1/products` | 상품 목록 직접 조회 |
| `/external/v1/channel-products` | 채널 상품 조회 |
| `/external/v1/products/origin-products` | 원상품 조회 |
| `/external/v1/pay-order/seller/claims` | 클레임 전용 조회 |
| `/external/v1/pay-order/seller/claim/return-requests` | 반품 요청 전용 조회 |
| `/external/v1/pay-order/seller/orders/inflow` | 신규 유입 주문 조회 |
| `/external/v1/smartstore/channels` | 스마트스토어 채널 정보 |

**권한 추가 방법:** 네이버 커머스 개발자 센터 → 내 애플리케이션 → API 권한 설정에서 필요한 scope 추가 신청

---

## 4. DB 동기화 기능

| 기능 | API 라우트 | 연결된 페이지 | 저장 테이블 |
|------|-----------|------------|------------|
| 주문 → 매출전표 저장 | `POST /api/naver/sync/orders` | 채널별 매출 | `slips`, `slip_items` |
| 반품 → 반품내역 저장 | `POST /api/naver/sync/claims` | 반품·불량 | `returns` |
| 상품 → 상품 등록 | `POST /api/naver/sync/products` | 상품 관리 | `products` |

### 중복 방지 규칙
- **주문:** `slips.memo = '[naver]{productOrderId}'`
- **반품:** `returns.note = '[naver]{productOrderId}'`
- **상품:** `products.note = '[naver]{originProductNo}'`

---

## 5. 향후 확장 가능한 기능 (권한 추가 시)

| 기능 | 필요 API | 활용 페이지 |
|------|---------|------------|
| 실시간 상품 재고 연동 | `/external/v1/products` | 재고 현황 |
| 상품별 옵션·가격 정확한 조회 | `/external/v1/channel-products` | 상품 관리, 가격표 |
| 반품 사유 상세 조회 | `/external/v1/pay-order/seller/claim/return-requests` | 반품·불량 |
| 배송 현황 추적 | `/external/v1/pay-order/seller/orders/{orderId}/delivery` | 거래 현황 |
| 정산 내역 조회 | 정산 API (별도 scope) | 현금출납, 미수금 |
| 톡톡 메시지 알림 | 네이버 톡톡 API (별도 앱) | 알림 |

---

## 6. 조회 한계 및 주의사항

1. **날짜 범위 제한:** `from`과 `to`를 동시에 쓸 경우 최대 24시간 이내만 가능.
   → 장기간 조회 시 `from`만 지정하거나 24시간 단위 페이지네이션 구현 필요.

2. **페이지네이션:** 응답에 `data.pagination` 포함됨. 현재는 단일 요청으로 처리 중.
   → 주문량이 많을 경우 `nextToken` 기반 페이지네이션 추가 필요.

3. **상품 정보 정확도:** 현재 상품 목록은 주문 기반 집계이므로 스마트스토어에 등록된 전체 상품이 아닌, 실제 판매된 상품만 표시됨.

4. **토큰 캐싱 없음:** 현재 매 API 호출마다 토큰을 재발급함.
   → 트래픽이 늘어나면 서버 메모리 또는 Redis에 토큰 캐싱 권장.
