import { Channel } from '@/lib/types'

/**
 * 실이익 계산
 * 실이익 = 판매가 - 매입단가 - (판매가 × 플랫폼수수료율/100) - (판매가 × 결제수수료율/100) - 배송비
 */
export function calcProfit(
  sellPrice: number,
  buyPrice: number,
  channel: Pick<Channel, 'commission_rate' | 'payment_fee_rate' | 'shipping_fee'>
): number {
  const platformFee = Math.round(sellPrice * (channel.commission_rate / 100))
  const paymentFee = Math.round(sellPrice * (channel.payment_fee_rate / 100))
  return sellPrice - buyPrice - platformFee - paymentFee - channel.shipping_fee
}

/**
 * 이익률 계산 (%)
 */
export function calcProfitRate(sellPrice: number, profit: number): number {
  if (sellPrice === 0) return 0
  return Math.round((profit / sellPrice) * 10000) / 100
}

/**
 * 손익분기가 계산
 * 손익분기가 = 매입단가 / (1 - 수수료합계율/100 - 목표이익률/100)
 */
export function calcBreakEvenPrice(
  buyPrice: number,
  channel: Pick<Channel, 'commission_rate' | 'payment_fee_rate'>,
  targetProfitRate: number = 0
): number {
  const totalFeeRate = channel.commission_rate + channel.payment_fee_rate
  const divisor = 1 - totalFeeRate / 100 - targetProfitRate / 100
  if (divisor <= 0) return 0
  return Math.round(buyPrice / divisor)
}
