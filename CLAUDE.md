# 도매 통합 관리 시스템

Next.js 14 App Router · TypeScript · Tailwind CSS · Supabase · Zustand 5

## 명령어
```
npm run dev      # 개발 서버
npm run build    # 빌드
npm run lint     # 린트
```

---

## 절대 규칙 (모든 작업에 적용)

### 1. 사업자 필터
모든 DB 쿼리는 `selectedBusinessId`로 필터링해야 한다.
```ts
import { useBusinessStore } from '@/store/businessStore'
const { selectedBusinessId } = useBusinessStore()
// 'all'이면 필터 생략, UUID면 .eq('business_id', selectedBusinessId)
```

### 2. 재고 변경은 RPC만
재고 직접 UPDATE 금지. 반드시 RPC 호출:
```ts
import { adjustInventory } from '@/lib/supabase/inventory'
await adjustInventory(productId, businessId, warehouseId, delta, note)
// delta: 양수=입고, 음수=출고. GREATEST(0, qty+delta) 자동 보정
```

### 3. 감사 로그 필수
모든 CRUD 후 반드시 호출:
```ts
import { logActivity } from '@/lib/supabase/logs'
await logActivity('create' | 'update' | 'delete' | 'adjust', 'slip' | 'product' | ..., id, '설명')
```

### 4. 단가 결정 우선순위
`resolvePrice()` 사용 — 직접 계산 금지:
```
partner 특수단가 > grade 등급단가 > quantity 수량단가 > 상품 기본가
```
```ts
import { resolvePrice } from '@/lib/utils/price'
```

### 5. 이익 계산
`calcProfit()` 사용 — 직접 계산 금지:
```
실이익 = 판매가 - 매입가 - 플랫폼수수료 - 결제수수료 - 배송비
```
```ts
import { calcProfit, calcProfitRate } from '@/lib/utils/profit'
```

---

## 코드 패턴

### 새 DB 모듈 (`lib/supabase/xxx.ts`)
```ts
import { createClient } from './client'
import { logActivity } from './logs'

export async function getXxx(businessId?: string) {
  const supabase = createClient()
  let q = supabase.from('xxx').select('*')
  if (businessId && businessId !== 'all') q = q.eq('business_id', businessId)
  const { data, error } = await q
  if (error) throw new Error('xxx 조회 실패: ' + error.message)
  return data ?? []
}
```

### 새 페이지 (`app/(dashboard)/xxx/page.tsx`)
```ts
'use client'
import { useBusinessStore } from '@/store/businessStore'
import PageHeader from '@/components/ui/PageHeader'
// useEffect → fetch → useState 패턴
```

### 전표 생성 흐름
```
createSlip(header) → slip_items INSERT → adjustInventory(±qty)
→ (세금계산서 옵션 시) tax_invoices INSERT → logActivity
```

### 에러 핸들링
```ts
import { toast } from 'sonner'
try { ... } catch (e) {
  toast.error(e instanceof Error ? e.message : '오류 발생')
}
```

### 금액·날짜 포맷
```ts
import { formatMoney, formatDate, generateSlipNo } from '@/lib/utils/format'
// formatMoney(1234567) → "1,234,567"
// generateSlipNo('sale', seq) → "S-20260329-0001"
```

---

## 환경변수
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NAVER_COMMERCE_CLIENT_ID       # 스마트스토어 (선택)
NAVER_COMMERCE_CLIENT_SECRET   # 스마트스토어 (선택)
TELEGRAM_BOT_TOKEN             # 텔레그램 (선택)
```
Supabase 미설정 시 middleware가 인증을 자동 건너뜀 (개발 편의)

---

## 경로 별칭 (`@/`)
```
@/lib/types           → 전체 타입 정의 (~425줄)
@/lib/supabase/       → 도메인별 DB 모듈 (20+개)
@/lib/utils/          → format, price, profit
@/store/businessStore → 전역 사업자 상태
@/components/ui/      → Modal, ConfirmDialog, PageHeader
@/supabase/functions.sql → adjust_inventory RPC + activity_logs + partner_prices
```

---

## 주의사항

- `slip_type`: `'sale'` | `'purchase'` (sale=매출, purchase=매입)
- `partner_type`: `'supplier'` | `'customer'` | `'both'`
- `stocktake` 흐름: `open → reviewing → done` (done 전에 adjust_inventory 일괄 적용)
- `quote` 흐름: `draft → sent → accepted|rejected|expired`
- `purchase_order` 흐름: `pending → partial → done|cancelled`
- `stock_logs.log_type`: `in|out|return_in|return_out|transfer_in|transfer_out|adjustment|bundle_out`
- `partner_prices`: 거래처×채널별 특별가 (functions.sql 재실행 필요 — 아직 미완)
- API 라우트(`/api/*`)는 middleware 인증 제외
- 재고 그리드: `quantity ≤ min_stock` 행은 주황색 하이라이트 적용

---

## 채널 연동 시스템 (구현 완료)

### 관련 파일
```
lib/channels/types.ts              # PlatformProduct, SyncPayload, ChannelAdapter 인터페이스
lib/channels/adapters/naver.ts     # NaverChannelAdapter (getProduct, syncProduct, listProducts)
lib/channels/sync.ts               # syncProductToAllChannels(productId, businessId, options)
lib/naver/auth.ts                  # getNaverAccessToken(businessId) — 토큰 캐시 포함
app/(dashboard)/channel-sync/      # 채널 연동 관리 페이지
app/(dashboard)/products/          # 상품 모달 [옵션 관리] [채널 연동] 탭
app/api/channels/mappings/         # GET(전체 or product_id별) / POST(upsert) / DELETE
app/api/channels/sync/             # POST — 상품 동기화 실행
app/api/channels/preview/          # GET — 플랫폼 현황 미리보기
app/api/channels/platform-products/ # GET — 플랫폼 상품 목록 조회 (일괄 연동용)
```

### DB 테이블
```
product_option_groups        # 옵션 그룹 (색상, 사이즈 등)
product_option_values        # 옵션 값 (빨강, S/M/L 등)
product_option_combinations  # 옵션 조합 (빨강+S, 빨강+M 등)
channel_product_mappings     # 상품 ↔ 채널 매핑 (last_sync_status, channel_price, channel_name 포함)
channel_sync_logs            # 동기화 이력 로그
```
> 마이그레이션 파일: `channel_option_migration.sql`, `channel_price_migration.sql` (모두 실행 완료)

### 채널별 가격 설정 (`channel_price`)
- `channel_product_mappings.channel_price` — 채널 전용 판매가 (NULL이면 상품 기본가 사용)
- `channel_product_mappings.channel_name` — 채널 전용 상품명 (NULL이면 상품명 그대로)
- 동기화 가격 우선순위: `channel_price` > `product.sell_price`
- UI: `/channel-sync` → 각 매핑 행 "기본가" 버튼 클릭 → 인라인 입력 → Enter 저장
- API: `PATCH /api/channels/mappings` `{ id, channel_price, channel_name }`

### 네이버 Commerce API 핵심 엔드포인트
```
POST /external/v1/oauth2/token                    # 토큰 발급
POST /external/v1/products/search                 # 상품 목록 조회 (body:{} 면 전체)
GET  /external/v1/products/origin-products/{id}   # 단건 조회
PUT  /external/v1/products/origin-products/{id}   # 가격/재고 업데이트 (Read-Modify-Write)
```
> ⚠️ 상품 **목록** 조회는 반드시 `POST /search` 사용 (GET list 엔드포인트 없음)

### 채널 설정 방법
1. `/settings` → 판매채널 → 수정 → **플랫폼 유형** 선택 (naver/coupang/11st/gmarket/own)
2. `/products` → 상품 선택 → [채널 연동] 탭 → 개별 매핑
3. `/channel-sync` → 채널 탭 선택 → [📥 일괄 연동] 으로 플랫폼 상품 일괄 매핑

### 사업자별 API 키 저장
`api_credentials` 테이블: `{ business_id, provider, credentials(jsonb), is_active }`
네이버: `credentials.client_id`, `credentials.client_secret`
env 폴백: `NAVER_COMMERCE_CLIENT_ID`, `NAVER_COMMERCE_CLIENT_SECRET`

### PlatformType 허용값
`'naver' | 'coupang' | '11st' | 'gmarket' | 'auction' | 'own' | 'offline'`

---

## 미구현 (작업 시 참고)
- Excel 가져오기 검증 (`lib/excel/import.ts`)
- 네이버 자동동기화 실행 설정 (`lib/naver/auto-sync.ts`)
- 텔레그램 봇 (`lib/telegram/`)
- 쿠팡/자사몰 채널 연동 어댑터 (인터페이스만 있음)
- 홈택스 세금계산서 연동
