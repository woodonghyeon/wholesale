# 코딩 패턴

## lib/supabase/[domain].ts 작성 패턴

```typescript
// Filter 인터페이스 (채널 필터 포함)
export interface XxxFilter {
  businessId: string    // 'all' 또는 UUID
  channelId?: string    // 'all' 또는 UUID (헤더 선택값 전달)
  dateFrom?: string
  dateTo?: string
  search?: string
}

// 목록 조회 패턴
export async function fetchXxxList(filter: XxxFilter) {
  const supabase = createClient()
  let query = supabase
    .from('table')
    .select('*, relation(id, name)')
    .order('created_at', { ascending: false })
  if (filter.businessId !== 'all') query = query.eq('business_id', filter.businessId)
  if (filter.channelId && filter.channelId !== 'all') query = query.eq('channel_id', filter.channelId)
  if (filter.dateFrom)  query = query.gte('created_at', filter.dateFrom)
  if (filter.dateTo)    query = query.lte('created_at', `${filter.dateTo}T23:59:59`)
  if (filter.search)    query = query.ilike('name', `%${filter.search}%`)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}
```

## 페이지 컴포넌트 기본 구조 (3-뷰 + 페이지네이션)

```typescript
'use client'
import { useEffect, useState, useCallback } from 'react'
import { useBusinessStore } from '@/store/businessStore'
import { fetchXxxList } from '@/lib/supabase/xxx'
import { toast } from 'sonner'

type ViewMode = 'table' | 'list' | 'card'
type PageSize = 10 | 50 | 100

export default function XxxPage() {
  const { selectedBusinessId, selectedChannelId } = useBusinessStore()
  const [data, setData]               = useState([])
  const [loading, setLoading]         = useState(true)
  const [viewMode, setViewMode]       = useState<ViewMode>('table')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize]       = useState<PageSize>(50)

  const totalPages = Math.max(1, Math.ceil(data.length / pageSize))
  const paginated  = data.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const load = useCallback(async () => {
    setLoading(true)
    setCurrentPage(1)
    try {
      const result = await fetchXxxList({
        businessId: selectedBusinessId,
        channelId: selectedChannelId,
      })
      setData(result)
    } catch {
      toast.error('데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [selectedBusinessId, selectedChannelId])

  useEffect(() => { load() }, [load])
  useEffect(() => { setCurrentPage(1) }, [pageSize])
}
```

## 모달 오버레이 패턴

```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
  <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
  <div className="relative z-10 bg-white/90 backdrop-blur-2xl rounded-2xl shadow-2xl">
    {/* 내용 */}
  </div>
</div>
```

## 슬라이드 패널 패턴 (우측)

```tsx
<div className="fixed inset-0 z-40 flex justify-end">
  <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" onClick={onClose} />
  <div className="relative z-10 w-[420px] h-full bg-white/95 backdrop-blur-2xl border-l border-black/[0.06]">
    {/* 내용 */}
  </div>
</div>
```

## 삭제 2-step 확인 패턴 (인라인)

```tsx
{deleteId === item.id ? (
  <div className="flex items-center gap-1">
    <span className="text-xs text-[#86868b]">정말 삭제?</span>
    <button onClick={() => handleDelete(item.id)} className="text-xs text-[#ff3b30] hover:underline font-medium">확인</button>
    <button onClick={() => setDeleteId(null)} className="text-xs text-[#86868b] hover:underline">취소</button>
  </div>
) : (
  <button onClick={() => setDeleteId(item.id)} className="text-xs text-[#86868b] hover:text-[#ff3b30]">삭제</button>
)}
```

## 다중 뷰 컴포넌트 패턴

- `XxxTableView` / `XxxListView` / `XxxCardView` 로 분리
- props: `{ items: T[], onSelect: (item: T) => void }`
- ListView: 좌측 컬러바(상태/카테고리별) + 2행 인박스 레이아웃
- CardView: `grid-cols-4` / 헤더(뱃지) + 핵심정보 + 구분선 + 금액/지표

## 유틸 함수

```typescript
// 금액 포맷 (페이지 내 로컬 정의)
function fmt(n: number) { return new Intl.NumberFormat('ko-KR').format(n) }

// 마진율 계산
function margin(buy: number, sell: number) {
  if (sell === 0) return 0
  return Math.round(((sell - buy) / sell) * 100)
}

// 날짜 포맷
new Date(date).toLocaleDateString('ko-KR')  // → "2026. 4. 1."

// KST 날짜 문자열 (외부 API 요청 시)
function toKstIso(date: Date): string {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().replace('Z', '+09:00')
}

// 재고 조정 (RPC)
await supabase.rpc('adjust_inventory', {
  p_product_id: productId,
  p_business_id: businessId,
  p_warehouse_id: warehouseId,
  p_quantity: delta,    // 매출: -수량, 매입: +수량
  p_note: '전표 S20260401-001',
})

// Set 중복제거 (TS2802 오류 방지)
const seen = new Set<string>(); const result: string[] = []
for (const item of arr) { if (!seen.has(item)) { seen.add(item); result.push(item) } }
```

## 새 채널 어댑터 추가 체크리스트

1. `lib/channels/[platform]/auth.ts` — 인증 토큰 발급
2. `lib/channels/[platform]/adapter.ts` — `syncXxxOrders()` 구현
3. `lib/channels/[platform]/mapper.ts` — API 응답 → `MappedOrder` 변환
4. `app/api/channels/sync-orders/route.ts` — platform 파라미터로 분기 추가
5. `supabase/channel_orders.sql`의 `platform_type` CHECK에 값 추가
6. `/settings`에서 해당 사업자에 채널 추가 후 `api_client_id`, `api_client_secret` 설정
