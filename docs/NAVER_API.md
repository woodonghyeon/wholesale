# 네이버 Commerce API

## 인증 (2-step OAuth2)

```typescript
// Step 1: 토큰 발급
const timestamp = Date.now()
const hashed = bcrypt.hashSync(`${clientId}_${timestamp}`, clientSecret)
const clientSecretSign = Buffer.from(hashed).toString('base64')
// POST https://api.commerce.naver.com/external/v1/oauth2/token
// body: grant_type=client_credentials&client_id=...&timestamp=...&client_secret_sign=...&type=SELF
// → { access_token, expires_in: 10799 }

// Step 2: API 호출
Authorization: Bearer {access_token}
```

## ⚠️ .env.local bcrypt secret 이스케이프 필수

```
NAVER_COMMERCE_CLIENT_SECRET=\$2a\$04\$MzMDPN7vtvVb3aW5Pva8qe
```

`$2a` 등이 환경변수로 해석되어 `secretLength: 0` 오류 발생. 반드시 백슬래시 이스케이프 사용.

## 동기화 플로우

```
UI 동기화 버튼
  → POST /api/channels/sync-orders { days }
  → syncNaverOrders()
    1. channels 테이블에서 platform_type='naver' 채널 조회 (channel_id, business_id)
    2. businesses 테이블에서 첫 번째 사업자 조회 (FK 오류 방지 — UI selectedBusinessId 무시)
    3. fetchChangedIds(): 날짜 범위를 24h씩 분할 → last-changed-statuses API (KST 형식)
    4. fetchOrderDetails(): productOrderIds 배치 300개 → /query API
    5. mapNaverProductOrder(): Naver 응답 → MappedOrder
    6. supabase.upsert(channel_orders, { onConflict: 'platform_type,external_product_order_id' })
```

## Rate Limit 딜레이 (429 방지)

- 날짜 구간 사이: 600ms
- 페이지 사이: 300ms
- 배치 사이: 400ms

## API 엔드포인트

- 변경 주문 조회: `GET /external/v1/pay-order/seller/orders/last-changed-statuses`
  - 날짜 파라미터: KST 형식 필수 (`+09:00`)
  - 최대 범위: 24h (초과 시 400 오류)
- 주문 상세: `POST /external/v1/pay-order/seller/product-orders/query`
  - 배치 최대: 300개

## 관련 파일

- `lib/channels/naver/auth.ts` — OAuth2 토큰 발급 + 캐싱
- `lib/channels/naver/adapter.ts` — fetchChangedIds, syncNaverOrders
- `lib/channels/naver/mapper.ts` — Naver 응답 → MappedOrder
- `app/api/channels/sync-orders/route.ts` — POST 트리거
- `app/api/channels/debug-auth/route.ts` — ⚠️ 프로덕션 전 삭제 필요
