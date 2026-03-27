/**
 * 반품·취소 클레임은 주문 API에서 상태 필터링으로 조회합니다.
 * (별도 클레임 API 엔드포인트는 권한 없음)
 */
import { getNaverReturnOrders, NaverProductOrder } from './orders'

export interface NaverClaim {
  claimId: string
  claimType: 'RETURN' | 'CANCEL' | 'EXCHANGE'
  claimRequestDate: string
  claimStatus: string
  productOrderId: string
  orderId: string
  productName: string
  quantity: number
  ordererName: string
  ordererTel: string
  claimReason: string
  claimReasonType: string
}

function orderToClaim(o: NaverProductOrder): NaverClaim {
  const type =
    o.productOrderStatus.includes('RETURN') ? 'RETURN' :
    o.productOrderStatus.includes('CANCEL') ? 'CANCEL' : 'EXCHANGE'

  return {
    claimId: o.productOrderId,
    claimType: type,
    claimRequestDate: o.orderDate,
    claimStatus: o.productOrderStatus,
    productOrderId: o.productOrderId,
    orderId: o.orderId,
    productName: o.productName,
    quantity: o.quantity,
    ordererName: o.ordererName,
    ordererTel: o.ordererTel,
    claimReason: '',
    claimReasonType: 'other',
  }
}

export async function getNaverClaims(lastDays = 60): Promise<NaverClaim[]> {
  const returnOrders = await getNaverReturnOrders(lastDays)
  return returnOrders.map(orderToClaim)
}

/** 특정 시각 이후 신규 반품/취소만 조회 (증분 동기화용) */
export async function getNaverClaimsSince(from: Date): Promise<NaverClaim[]> {
  const { getNaverOrdersSince } = await import('./orders')
  const orders = await getNaverOrdersSince(from)
  const returnStatuses = [
    'RETURN_REQUEST', 'RETURNED',
    'CANCEL_REQUEST', 'CANCELED',
    'EXCHANGE_REQUEST', 'EXCHANGED',
  ]
  return orders
    .filter(o => returnStatuses.includes(o.productOrderStatus))
    .map(orderToClaim)
}
