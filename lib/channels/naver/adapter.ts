import { getNaverAuthHeader } from './auth'
import { mapNaverProductOrder } from './mapper'
import type { MappedOrder, OrderFetchParams, SyncResult } from '../types'

const BASE_URL = 'https://api.commerce.naver.com'

/** 네이버 API 요청 공통 헬퍼 */
async function naverFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const authHeader = await getNaverAuthHeader()
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Naver API ${res.status}: ${text.slice(0, 300)}`)
  }
  return res.json() as T
}

/** 일정 시간 대기 (ms) */
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/**
 * 날짜를 KST (+09:00) 형식으로 변환
 * 네이버 Commerce API는 반드시 KST 형식을 요구함
 */
function toKstIso(date: Date): string {
  const kstOffset = 9 * 60 * 60 * 1000
  const kst = new Date(date.getTime() + kstOffset)
  return kst.toISOString().replace('Z', '+09:00')
}

/**
 * 날짜 범위를 maxHours 단위 구간으로 분할
 * 네이버 last-changed-statuses 엔드포인트는 1회 24시간 이내만 허용
 */
function splitDateRange(
  from: Date,
  to: Date,
  maxHours = 24,
): Array<{ from: Date; to: Date }> {
  const maxMs = maxHours * 60 * 60 * 1000
  const ranges: Array<{ from: Date; to: Date }> = []
  let cur = new Date(from)
  while (cur < to) {
    const end = new Date(Math.min(cur.getTime() + maxMs, to.getTime()))
    ranges.push({ from: new Date(cur), to: end })
    cur = end
  }
  return ranges
}

/** 최근 변경된 상품주문 ID 수집 (날짜 범위 자동 분할 + 호출 간 딜레이) */
async function fetchChangedIds(params: OrderFetchParams): Promise<string[]> {
  const ranges = splitDateRange(params.fromDate, params.toDate)
  const allIds: string[] = []

  for (let ri = 0; ri < ranges.length; ri++) {
    // 레이트 리밋 방지: 첫 호출 제외하고 600ms 대기
    if (ri > 0) await sleep(600)

    const range = ranges[ri]
    const from = toKstIso(range.from)
    const to   = toKstIso(range.to)
    let moreSequenceToken: string | undefined

    do {
      const qs = new URLSearchParams({
        lastChangedFrom: from,
        lastChangedTo: to,
        limitCount: '300',
        ...(moreSequenceToken ? { moreSequenceToken } : {}),
      })
      const data = await naverFetch<{
        data?: {
          lastChangeStatuses?: { productOrderId: string }[]
          moreSequenceToken?: string
        }
      }>(`/external/v1/pay-order/seller/product-orders/last-changed-statuses?${qs}`)

      const statuses = data?.data?.lastChangeStatuses ?? []
      allIds.push(...statuses.map(s => s.productOrderId))
      moreSequenceToken = data?.data?.moreSequenceToken

      if (moreSequenceToken) await sleep(300)
    } while (moreSequenceToken)
  }

  // 중복 제거 (날짜 범위 경계에서 같은 주문이 두 번 포함될 수 있음)
  return Array.from(new Set(allIds))
}

/** 상품주문 ID 배열로 상세 조회 */
async function fetchOrderDetails(
  productOrderIds: string[],
  channelId?: string,
  businessId?: string,
): Promise<MappedOrder[]> {
  const results: MappedOrder[] = []
  const BATCH = 300

  for (let i = 0; i < productOrderIds.length; i += BATCH) {
    if (i > 0) await sleep(400)
    const batch = productOrderIds.slice(i, i + BATCH)
    const data = await naverFetch<{ data?: Record<string, unknown>[] }>(
      '/external/v1/pay-order/seller/product-orders/query',
      { method: 'POST', body: JSON.stringify({ productOrderIds: batch }) },
    )
    const orders = data?.data ?? []
    results.push(...orders.map(o => mapNaverProductOrder(o, channelId, businessId)))
  }

  return results
}

/** 네이버 주문 조회 (저장 없이 반환) */
export async function fetchNaverOrders(
  params: OrderFetchParams,
  channelId?: string,
  businessId?: string,
): Promise<MappedOrder[]> {
  const ids = await fetchChangedIds(params)
  if (ids.length === 0) return []
  return fetchOrderDetails(ids, channelId, businessId)
}

/** 네이버 주문 동기화 — DB에 upsert */
export async function syncNaverOrders(
  params: OrderFetchParams,
  _channelId?: string,
  _businessId?: string,
): Promise<SyncResult> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = createClient()
  const result: SyncResult = { synced: 0, errors: [] }

  try {
    // UI에서 전달된 businessId는 신뢰하지 않음 (Zustand 스토어의 값이 DB와 다를 수 있음)
    // channels 테이블에는 business_id가 없으므로, 채널 id와 사업자 id를 별도 조회
    const [{ data: ch }, { data: biz }] = await Promise.all([
      supabase
        .from('channels')
        .select('id')
        .eq('platform_type', 'naver')
        .limit(1)
        .maybeSingle(),
      supabase
        .from('businesses')
        .select('id')
        .order('sort_order', { ascending: true })
        .limit(1)
        .maybeSingle(),
    ])

    const resolvedChannelId  = ch?.id as string | undefined
    const resolvedBusinessId = biz?.id as string | undefined

    const ids = await fetchChangedIds(params)
    if (ids.length === 0) return result

    const BATCH = 300
    for (let i = 0; i < ids.length; i += BATCH) {
      if (i > 0) await sleep(400)
      const batch = ids.slice(i, i + BATCH)
      try {
        const data = await naverFetch<{ data?: Record<string, unknown>[] }>(
          '/external/v1/pay-order/seller/product-orders/query',
          { method: 'POST', body: JSON.stringify({ productOrderIds: batch }) },
        )
        const orders = (data?.data ?? []).map(o =>
          mapNaverProductOrder(o, resolvedChannelId, resolvedBusinessId),
        )

        const { error } = await supabase
          .from('channel_orders')
          .upsert(orders, {
            onConflict: 'platform_type,external_product_order_id',
            ignoreDuplicates: false,
          })

        if (error) {
          result.errors.push(error.message)
        } else {
          result.synced += orders.length
        }
      } catch (e) {
        result.errors.push(e instanceof Error ? e.message : String(e))
      }
    }

    if (resolvedChannelId) {
      await supabase
        .from('channels')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('id', resolvedChannelId)
    }
  } catch (e) {
    result.errors.push(e instanceof Error ? e.message : String(e))
  }

  return result
}
