import { getNaverAuthHeaders, BASE_URL } from './auth'

export type NaverProductOrderStatus =
  | 'PAYMENT_WAITING'
  | 'PAYED'
  | 'DELIVERING'
  | 'DELIVERED'
  | 'PURCHASE_DECIDED'
  | 'EXCHANGED'
  | 'RETURNED'
  | 'CANCELED'
  | 'RETURN_REQUEST'
  | 'CANCEL_REQUEST'
  | 'EXCHANGE_REQUEST'

export interface NaverProductOrder {
  productOrderId: string
  orderId: string
  orderDate: string
  paymentDate: string
  productOrderStatus: NaverProductOrderStatus
  productName: string
  quantity: number
  unitPrice: number
  totalPaymentAmount: number
  ordererName: string
  ordererTel: string
}

interface RawContent {
  productOrderId: string
  content: {
    order: {
      orderId: string
      orderDate: string
      paymentDate: string
      ordererName: string
      ordererTel: string
    }
    productOrder: {
      productOrderId: string
      productOrderStatus: NaverProductOrderStatus
      productName: string
      quantity: number
      unitPrice: number
      totalPaymentAmount: number
    }
  }
}

function mapOrder(raw: RawContent): NaverProductOrder {
  const { order, productOrder } = raw.content
  return {
    productOrderId: productOrder.productOrderId,
    orderId: order.orderId,
    orderDate: order.orderDate,
    paymentDate: order.paymentDate,
    productOrderStatus: productOrder.productOrderStatus,
    productName: productOrder.productName,
    quantity: productOrder.quantity,
    unitPrice: productOrder.unitPrice,
    totalPaymentAmount: productOrder.totalPaymentAmount,
    ordererName: order.ordererName,
    ordererTel: order.ordererTel,
  }
}

/**
 * 주문 목록 조회 - 페이지네이션 자동 처리
 * ※ from만 지정하면 현재 시각까지 전체 조회 (from+to 동시 사용 시 24시간 이내만 허용)
 */
async function fetchWithRetry(url: string, headers: Record<string, string>, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, { headers })
    if (res.status === 429) {
      const wait = (i + 1) * 5000 // 5초, 10초, 15초 대기
      console.warn(`[Naver API] Rate limit (429) — ${wait / 1000}초 후 재시도 (${i + 1}/${retries})`)
      await new Promise(r => setTimeout(r, wait))
      continue
    }
    return res
  }
  throw new Error('네이버 API Rate Limit — 재시도 횟수 초과')
}

async function fetchOrdersSince(from: Date): Promise<NaverProductOrder[]> {
  const headers = await getNaverAuthHeaders()
  const all: NaverProductOrder[] = []
  let nextToken: string | undefined

  do {
    const params = new URLSearchParams({ from: from.toISOString() })
    if (nextToken) params.set('nextToken', nextToken)

    const res = await fetchWithRetry(
      `${BASE_URL}/external/v1/pay-order/seller/product-orders?${params}`,
      headers
    )

    if (!res.ok) {
      const error = await res.text()
      throw new Error(`주문 조회 실패 (${res.status}): ${error}`)
    }

    const data = await res.json()
    const contents: RawContent[] = data.data?.contents ?? []
    all.push(...contents.map(mapOrder))
    nextToken = data.data?.pagination?.nextToken
  } while (nextToken)

  return all
}

/** 최근 N일치 주문 조회 (전체 초기 로드용) */
export async function getNaverOrders(lastDays = 7): Promise<NaverProductOrder[]> {
  const from = new Date()
  from.setDate(from.getDate() - lastDays)
  return fetchOrdersSince(from)
}

/** 최근 N시간 주문 조회 — 오늘 신규 주문 실시간 캡처용 */
export async function getNaverOrdersLastHours(hours: number): Promise<NaverProductOrder[]> {
  const from = new Date(Date.now() - hours * 60 * 60 * 1000)
  return fetchOrdersSince(from)
}

/** 특정 시각 이후 신규 주문만 조회 (2분 주기 증분 동기화용) */
export async function getNaverOrdersSince(from: Date): Promise<NaverProductOrder[]> {
  return fetchOrdersSince(from)
}

/** 반품·취소·교환 주문만 필터링 */
export async function getNaverReturnOrders(lastDays = 60): Promise<NaverProductOrder[]> {
  const all = await getNaverOrders(lastDays)
  const returnStatuses: NaverProductOrderStatus[] = [
    'RETURN_REQUEST', 'RETURNED',
    'CANCEL_REQUEST', 'CANCELED',
    'EXCHANGE_REQUEST', 'EXCHANGED',
  ]
  return all.filter(o => returnStatuses.includes(o.productOrderStatus))
}
