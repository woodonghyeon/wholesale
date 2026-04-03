import type { MappedOrder } from '../types'

type NaverProductOrder = Record<string, unknown>
type AnyObj = Record<string, unknown>

export function mapNaverProductOrder(
  raw: NaverProductOrder,
  channelId?: string,
  businessId?: string,
): MappedOrder {
  // Naver API 응답 구조: { productOrder: {...}, order: {...}, ... }
  const po = (raw.productOrder ?? raw) as AnyObj
  const order = (raw.order ?? po.order ?? {}) as AnyObj
  const addr = (po.shippingAddress ?? {}) as AnyObj
  const delivery = (po.deliveryInfo ?? {}) as AnyObj

  return {
    business_id: businessId,
    channel_id: channelId,
    platform_type: 'naver',
    external_order_id: str(po.orderId ?? order.orderId),
    external_product_order_id: str(po.productOrderId),
    order_status: mapStatus(str(po.productOrderStatus)),
    ordered_at: str(po.orderDate ?? order.orderDate) || new Date().toISOString(),
    buyer_name: str(order.ordererName),
    buyer_phone: str(order.ordererTel),
    receiver_name: str(addr.name),
    receiver_phone: str(addr.tel1 ?? addr.tel2),
    receiver_address: buildAddress(addr),
    receiver_zipcode: str(addr.zipCode),
    product_name: str(po.productName),
    option_info: str(po.optionInfo),
    quantity: num(po.quantity) || 1,
    unit_price: num(po.unitPrice),
    total_amount: num(po.totalPaymentAmount ?? po.amount),
    shipping_fee: num(po.shippingFee),
    commission_amount: 0,
    tracking_number: str(delivery.trackingNumber) || undefined,
    shipping_company: str(delivery.courierCompanyCode) || undefined,
    raw_data: raw,
    updated_at: new Date().toISOString(),
  }
}

function str(v: unknown): string {
  if (v == null) return ''
  return String(v)
}

function num(v: unknown): number {
  const n = Number(v)
  return isNaN(n) ? 0 : n
}

function buildAddress(addr: AnyObj): string {
  return [addr.baseAddress, addr.detailedAddress].filter(Boolean).join(' ')
}

export function mapStatus(naverStatus: string): string {
  const map: Record<string, string> = {
    PAYMENT_WAITING: 'payment_waiting',
    PAYED: 'paid',
    DELIVERING: 'shipping',
    DELIVERED: 'delivered',
    PURCHASE_DECIDED: 'confirmed',
    EXCHANGED: 'exchanged',
    CANCEL_DONE: 'cancelled',
    RETURN_DONE: 'returned',
    CANCELED: 'cancelled',
    RETURNED: 'returned',
    CANCEL_REQUEST: 'cancel_request',
    RETURN_REQUEST: 'return_request',
    EXCHANGE_REQUEST: 'exchange_request',
  }
  return map[naverStatus] ?? naverStatus.toLowerCase()
}
