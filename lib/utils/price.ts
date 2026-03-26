import { ProductPrice } from '@/lib/types'

/**
 * 단가 결정 우선순위
 * 1순위: 거래처별 특수단가 (price_type='partner')
 * 2순위: 등급별 단가 (price_type='grade')
 * 3순위: 수량별 단가 (price_type='quantity')
 * 4순위: 상품 기본 판매단가
 */
export function resolvePrice(
  prices: ProductPrice[],
  options: {
    partnerId?: string
    grade?: number
    quantity?: number
    defaultPrice: number
  }
): number {
  const today = new Date().toISOString().slice(0, 10)
  const effective = prices.filter((p) => p.effective_from <= today)

  // 1순위: 거래처별
  if (options.partnerId) {
    const partnerPrice = effective.find(
      (p) => p.price_type === 'partner' && p.partner_id === options.partnerId
    )
    if (partnerPrice) return partnerPrice.price
  }

  // 2순위: 등급별
  if (options.grade !== undefined) {
    const gradePrice = effective.find(
      (p) => p.price_type === 'grade' && p.grade === options.grade
    )
    if (gradePrice) return gradePrice.price
  }

  // 3순위: 수량별 (최소수량 이상인 것 중 가장 큰 min_quantity)
  if (options.quantity !== undefined) {
    const quantityPrices = effective
      .filter((p) => p.price_type === 'quantity' && p.min_quantity <= options.quantity!)
      .sort((a, b) => b.min_quantity - a.min_quantity)
    if (quantityPrices.length > 0) return quantityPrices[0].price
  }

  // 4순위: 기본 단가
  return options.defaultPrice
}
