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
  productNo: string
  channelProductNo: string
  productOption: string
  quantity: number
  unitPrice: number
  totalPaymentAmount: number
  discountAmount: number
  expectedSettlementAmount: number
  paymentCommission: number
  saleCommission: number
  ordererName: string
  ordererTel: string
  receiverName: string
  receiverTel: string
  receiverAddress: string
  receiverZipCode: string
  receiverLat: number | null
  receiverLng: number | null
  deliveryCompany: string
  trackingNumber: string
  deliveryStatus: string
  inflowPath: string
  paymentMeans: string
  isMembershipSubscribed: boolean
}

interface RawProductOrder {
  productOrderId: string
  productOrderStatus: NaverProductOrderStatus
  productName: string
  quantity: number
  unitPrice: number
  totalPaymentAmount: number
  discountAmount?: number
  expectedSettlementAmount?: number
  paymentCommission?: number
  saleCommission?: number
  inflowPath?: string
  paymentMeans?: string
  isMembershipSubscribed?: boolean
  // 상품 번호
  originProductNo?: number
  channelProductNo?: number
  // 옵션
  productOption?: string
  itemOptions?: { optionName: string; optionValue: string }[]
}

interface RawOrder {
  orderId: string
  orderDate: string
  paymentDate: string
  ordererName: string
  ordererTel: string
}

interface RawShippingAddress {
  name?: string
  tel?: string
  baseAddress?: string
  detailAddress?: string
  zipCode?: string
  lat?: number
  lng?: number
}

interface RawDelivery {
  deliveryCompany?: string
  trackingNumber?: string
  deliveryStatus?: string
}

interface RawContent {
  productOrderId: string
  content: {
    order: RawOrder
    productOrder: RawProductOrder
    shippingAddress?: RawShippingAddress
    delivery?: RawDelivery
  }
}

function buildProductOption(po: RawProductOrder): string {
  if (po.productOption) return po.productOption
  if (po.itemOptions?.length) {
    return po.itemOptions.map(o => `${o.optionName}: ${o.optionValue}`).join(', ')
  }
  return ''
}

function mapOrder(raw: RawContent): NaverProductOrder {
  const { order, productOrder, shippingAddress, delivery } = raw.content
  return {
    productOrderId: productOrder.productOrderId,
    orderId: order.orderId,
    orderDate: order.orderDate,
    paymentDate: order.paymentDate,
    productOrderStatus: productOrder.productOrderStatus,
    productName: productOrder.productName,
    productNo: String(productOrder.originProductNo ?? ''),
    channelProductNo: String(productOrder.channelProductNo ?? ''),
    productOption: buildProductOption(productOrder),
    quantity: productOrder.quantity,
    unitPrice: productOrder.unitPrice,
    totalPaymentAmount: productOrder.totalPaymentAmount,
    discountAmount: productOrder.discountAmount ?? 0,
    expectedSettlementAmount: productOrder.expectedSettlementAmount ?? 0,
    paymentCommission: productOrder.paymentCommission ?? 0,
    saleCommission: productOrder.saleCommission ?? 0,
    ordererName: order.ordererName,
    ordererTel: order.ordererTel,
    receiverName: shippingAddress?.name ?? '',
    receiverTel: shippingAddress?.tel ?? '',
    receiverAddress: shippingAddress
      ? [shippingAddress.baseAddress, shippingAddress.detailAddress].filter(Boolean).join(' ')
      : '',
    receiverZipCode: shippingAddress?.zipCode ?? '',
    receiverLat: shippingAddress?.lat ?? null,
    receiverLng: shippingAddress?.lng ?? null,
    deliveryCompany: delivery?.deliveryCompany ?? '',
    trackingNumber: delivery?.trackingNumber ?? '',
    deliveryStatus: delivery?.deliveryStatus ?? '',
    inflowPath: productOrder.inflowPath ?? '',
    paymentMeans: productOrder.paymentMeans ?? '',
    isMembershipSubscribed: productOrder.isMembershipSubscribed ?? false,
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
  let page = 1
  const size = 300

  while (true) {
    const params = new URLSearchParams({
      from: from.toISOString(),
      page: String(page),
      size: String(size),
    })

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

    const hasNext = data.data?.pagination?.hasNext ?? false
    if (!hasNext) break
    page++
  }

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
