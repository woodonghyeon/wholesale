# 주문 관리 — 상세 스펙

> 여러 채널의 주문을 통합 수집하여 전체 주문 현황 한눈에 관리

---

## 1. 통합 주문 수집

### 수집 흐름
```
자동 동기화 (node-cron, 10분 간격)
  └→ sync_enabled인 모든 채널 순회
       └→ getAdapter(channel).fetchOrders({ fromDate: lastSyncedAt })
            └→ channel_orders UPSERT (external_order_id 기준 중복 제거)
            └→ channels.last_synced_at UPDATE
            └→ 신규 주문 수 집계 → 텔레그램 알림 (선택)

수동 동기화
  └→ 통합 주문 페이지 "동기화" 버튼
       └→ POST /api/channels/sync-orders
```

### 주문 상태 매핑 (채널별 → 통합)

| 통합 상태 | 네이버 | 11번가 | 옥션 |
|-----------|--------|--------|------|
| `placed` | PAYED | 주문접수 | OrderReceived |
| `paid` | PAYED | 결제완료 | PaymentComplete |
| `preparing` | - | 상품준비중 | Preparing |
| `shipping` | DELIVERED | 배송중 | Shipping |
| `delivered` | - | 배송완료 | Delivered |
| `cancelled` | CANCELLED | 취소완료 | Cancelled |
| `returned` | RETURNED | 반품완료 | Returned |
| `exchanged` | EXCHANGED | 교환완료 | Exchanged |

---

## 2. 주문 엑셀 다운로드

### 기본 양식
```
주문번호 | 채널 | 주문일시 | 상품명 | 옵션 | 수량 | 결제금액 |
수령인 | 연락처 | 우편번호 | 주소 | 배송메모 | 송장번호
```

### 커스텀 양식
- 사용자가 컬럼 순서·포함 여부 설정 가능
- 양식 프리셋 저장 (예: "CJ대한통운 양식", "한진택배 양식")
- 설정 저장: `user_export_presets` 테이블 or localStorage

### 양식 프리셋 DB (선택)
```sql
CREATE TABLE export_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  columns JSONB NOT NULL,          -- [{ key, label, width }]
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 3. 합포장 처리

### 로직
동일 수령인(이름 + 연락처 + 주소) 주문을 묶어서 하나의 배송건으로 처리.

```typescript
interface CombinedPackage {
  receiver: { name: string; phone: string; address: string; zipcode: string };
  orders: ChannelOrder[];
  totalQuantity: number;
  totalAmount: number;
  channels: string[];  // 어떤 채널에서 온 주문인지
}

function combineOrders(orders: ChannelOrder[]): CombinedPackage[] {
  const key = (o) => `${o.receiver_name}|${o.receiver_phone}|${o.receiver_address}`;
  const groups = groupBy(orders, key);
  return Object.values(groups).map(group => ({
    receiver: { ... },
    orders: group,
    totalQuantity: sum(group, 'quantity'),
    totalAmount: sum(group, 'total_amount'),
    channels: uniq(group.map(o => o.platform_type)),
  }));
}
```

### UI
- 주문 목록에서 "합포장" 모드 토글
- 합포장 가능 건수 뱃지 표시
- 합포장 그룹 카드 뷰: 수령인별 묶음 표시
- 송장번호 한 번 입력 → 그룹 내 모든 주문에 적용

---

## 4. 배송 정보 관리

### 대량 배송 등록
```
1. 주문 선택 (체크박스) or 전체 선택
2. 택배사 선택 (CJ대한통운, 한진, 롯데, 우체국, ...)
3. 방법 선택:
   a) 직접 입력: 주문별 송장번호 입력 필드
   b) 엑셀 업로드: 주문번호-송장번호 매핑 파일
   c) API 자동: (향후) 택배사 API 연동
4. "일괄 전송" → 각 채널 API에 배송정보 등록
```

### 채널 배송 API
```typescript
// 각 어댑터의 registerShippingBulk 구현
interface ShippingBulkItem {
  orderId: string;
  trackingNumber: string;
  shippingCompany: ShippingCompanyCode;
}

type ShippingCompanyCode =
  | 'CJGLS'       // CJ대한통운
  | 'HANJIN'      // 한진택배
  | 'LOTTE'       // 롯데택배
  | 'LOGEN'       // 로젠택배
  | 'EPOST'       // 우체국택배
  | 'KGB'         // KGB택배
  | 'DAESIN'      // 대신택배
  | 'CHUNIL';     // 천일택배
```

### 배송 상태 추적
- `channel_orders.tracking_number`, `shipping_company` 필드
- 주문 상세에서 송장번호 클릭 → 해당 택배사 추적 페이지 링크
- (향후) 택배 추적 API로 실시간 상태 업데이트

---

## 5. 통합 주문 페이지 UI 상세

### 상단 요약 영역
```
┌──────────────────────────────────────────────┐
│  전체 127건  │  신규 23건  │  배송준비 45건  │  배송중 31건  │
│  [네이버 56] [11번가 38] [옥션 33]                           │
└──────────────────────────────────────────────┘
```

### 필터 바
- 세그먼트 컨트롤: 전체 | 네이버 | 11번가 | 옥션 | 자사몰
- 상태 필터: 신규·결제완료·배송준비·배송중·배송완료·취소·반품
- 날짜: 오늘 | 3일 | 7일 | 30일 | 커스텀
- 검색: 주문번호, 수령인, 상품명

### 테이블 컬럼
```
□ | 채널 | 주문번호 | 주문일시 | 상품명 | 옵션 | 수량 |
결제금액 | 수령인 | 상태 | 송장번호 | 액션
```

### 벌크 액션 바 (선택 시 하단 고정)
```
┌──────────────────────────────────────────────┐
│  12건 선택  │  [배송등록]  [합포장]  [엑셀다운]  [취소]  │
└──────────────────────────────────────────────┘
```

### 주문 상세 사이드 패널 (macOS Inspector 스타일)
- 우측 슬라이드인 패널 (w-[400px])
- 섹션: 주문정보, 상품정보, 배송정보, 결제정보, 메모
- 인라인 편집 가능 (메모, 배송정보)
