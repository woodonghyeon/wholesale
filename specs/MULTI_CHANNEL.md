# 다중 채널 통합 관리 — 상세 스펙

> v2 스프린트 핵심 기능

---

## 1. 개요

네이버 스마트스토어(기존), 11번가, 옥션, 자사몰 등 여러 판매 채널을
하나의 인터페이스에서 통합 관리한다.

### 대상 채널 & API

| 채널 | API | 인증 방식 | 비고 |
|------|-----|-----------|------|
| 네이버 스마트스토어 | Commerce API v2 | bcrypt 서명 (구현 완료) | `lib/naver/` |
| 11번가 | OpenAPI v2 | API Key + Secret | REST |
| 옥션 (G마켓 포함) | ESM Plus API | IAM 인증 | SOAP→REST 래핑 필요 |
| 자사몰 | 자체 DB | Supabase 직접 | 별도 API 불필요 |

---

## 2. DB 스키마 확장

### 기존 `channels` 테이블 확장
```sql
ALTER TABLE channels ADD COLUMN IF NOT EXISTS
  platform_type TEXT CHECK (platform_type IN ('naver', '11st', 'auction', 'gmarket', 'coupang', 'own', 'offline')),
  api_client_id TEXT,
  api_client_secret TEXT,       -- 암호화 저장 권장
  api_endpoint TEXT,
  sync_enabled BOOLEAN DEFAULT false,
  last_synced_at TIMESTAMPTZ;
```

### 새 테이블: `channel_orders` (통합 주문)
```sql
CREATE TABLE channel_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id),
  channel_id UUID REFERENCES channels(id),
  platform_type TEXT NOT NULL,
  external_order_id TEXT NOT NULL,           -- 채널 원본 주문번호
  external_product_order_id TEXT,            -- 채널 원본 상품주문번호
  order_status TEXT NOT NULL,                -- placed, paid, shipping, delivered, cancelled, returned
  ordered_at TIMESTAMPTZ NOT NULL,
  buyer_name TEXT,
  buyer_phone TEXT,
  buyer_email TEXT,
  receiver_name TEXT,
  receiver_phone TEXT,
  receiver_address TEXT,
  receiver_zipcode TEXT,
  product_name TEXT,
  option_info TEXT,
  quantity INTEGER DEFAULT 1,
  unit_price NUMERIC(12,0) DEFAULT 0,
  total_amount NUMERIC(12,0) DEFAULT 0,
  shipping_fee NUMERIC(12,0) DEFAULT 0,
  commission_amount NUMERIC(12,0) DEFAULT 0,
  tracking_number TEXT,
  shipping_company TEXT,
  raw_data JSONB,                            -- 원본 API 응답 전체
  is_processed BOOLEAN DEFAULT false,        -- ERP 전표 변환 여부
  ref_slip_id UUID REFERENCES slips(id),     -- 연결된 전표
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(channel_id, external_order_id, external_product_order_id)
);

CREATE INDEX idx_channel_orders_business ON channel_orders(business_id);
CREATE INDEX idx_channel_orders_status ON channel_orders(order_status);
CREATE INDEX idx_channel_orders_ordered ON channel_orders(ordered_at);
CREATE INDEX idx_channel_orders_processed ON channel_orders(is_processed);
```

---

## 3. 아키텍처

### 채널 어댑터 패턴
```
lib/channels/
  types.ts              # 공통 인터페이스 정의
  adapter.ts            # ChannelAdapter 추상 클래스
  naver/
    auth.ts             # (기존 lib/naver/auth.ts 이동)
    adapter.ts          # NaverAdapter implements ChannelAdapter
    mapper.ts           # API 응답 → channel_orders 매핑
  11st/
    auth.ts
    adapter.ts
    mapper.ts
  auction/
    auth.ts
    adapter.ts
    mapper.ts
  registry.ts           # 채널 타입 → 어댑터 매핑
```

### 공통 인터페이스
```typescript
// lib/channels/types.ts

interface ChannelAdapter {
  // 인증
  authenticate(): Promise<string>;  // 토큰 반환

  // 주문
  fetchOrders(params: OrderFetchParams): Promise<ChannelOrder[]>;
  fetchOrderDetail(orderId: string): Promise<ChannelOrder>;
  updateOrderStatus(orderId: string, status: string): Promise<void>;

  // 배송
  registerShipping(orderId: string, info: ShippingInfo): Promise<void>;
  registerShippingBulk(items: ShippingBulkItem[]): Promise<BulkResult>;

  // 상품 (v3)
  fetchProducts(): Promise<ChannelProduct[]>;
  updateProduct(productId: string, data: Partial<ChannelProduct>): Promise<void>;

  // CS (v3)
  fetchInquiries(params: InquiryFetchParams): Promise<ChannelInquiry[]>;
  replyInquiry(inquiryId: string, content: string): Promise<void>;
}

interface OrderFetchParams {
  fromDate: Date;
  toDate: Date;
  status?: string;
  pageSize?: number;
  pageToken?: string;
}

interface ShippingInfo {
  trackingNumber: string;
  shippingCompany: string;  // 'cj', 'hanjin', 'logen', 'lotte', ...
}
```

### 어댑터 레지스트리
```typescript
// lib/channels/registry.ts

const adapters: Record<string, () => ChannelAdapter> = {
  naver: (config) => new NaverAdapter(config),
  '11st': (config) => new ElevenStAdapter(config),
  auction: (config) => new AuctionAdapter(config),
};

export function getAdapter(channel: Channel): ChannelAdapter {
  const factory = adapters[channel.platform_type];
  if (!factory) throw new Error(`지원하지 않는 채널: ${channel.platform_type}`);
  return factory({
    clientId: channel.api_client_id,
    clientSecret: channel.api_client_secret,
    endpoint: channel.api_endpoint,
  });
}
```

---

## 4. API 라우트

### 통합 주문 수집
```
POST /api/channels/sync-orders
Body: { channelId?: string }  // 생략 시 전체 sync_enabled 채널
Response: { synced: number, errors: string[] }
```

### 주문 목록 조회
```
GET /api/channels/orders?status=paid&from=2026-01-01&to=2026-03-30&channel=naver
Response: { orders: ChannelOrder[], total: number }
```

### 배송 등록
```
POST /api/channels/shipping
Body: { orders: [{ orderId, trackingNumber, shippingCompany }] }
Response: { success: number, failed: { orderId, error }[] }
```

---

## 5. 페이지 UI

### 채널 설정 (`/settings` 탭 확장)
- 채널별 API 키 입력 폼
- 연결 테스트 버튼
- 동기화 on/off 토글
- 마지막 동기화 시간 표시

### 통합 주문 현황 (`/orders` — 새 페이지)
- 상단: 채널별 주문 수 요약 카드 (세그먼트 컨트롤로 전환)
- 필터: 채널, 주문상태, 날짜범위, 검색(주문번호/구매자)
- 테이블: 주문번호, 채널 아이콘, 상품명, 수량, 금액, 상태 뱃지, 수령인
- 벌크 액션: 선택 주문 → 배송등록 / 엑셀 다운 / 합포장
- 주문 클릭 → 사이드 패널 상세 (macOS inspector 스타일)

---

## 6. 네이버 기존 코드 마이그레이션

기존 `lib/naver/`와 `app/api/naver/` 코드를 새 어댑터 패턴으로 이동:

1. `lib/naver/auth.ts` → `lib/channels/naver/auth.ts` (그대로)
2. `lib/naver/orders.ts` → `lib/channels/naver/adapter.ts`의 `fetchOrders()` 구현
3. `naver_orders` 테이블 → `channel_orders`로 데이터 마이그레이션
4. 기존 API 라우트는 하위호환 유지 후 점진 제거
