export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getNaverOrders, getNaverOrdersLastHours } from '@/lib/naver/orders'

const PAYMENT_LABEL: Record<string, string> = {
  CREDIT_CARD:     '신용카드',
  NAVER_POINT:     '네이버포인트',
  BANK_TRANSFER:   '무통장입금',
  VIRTUAL_ACCOUNT: '가상계좌',
  NPAY:            '네이버페이',
  NAVER_PAY:       '네이버페이',
  CASH:            '현금',
  MOBILE:          '휴대폰결제',
  GIFT_CARD:       '상품권',
}

function labelPayment(raw: string): string {
  return PAYMENT_LABEL[raw] ?? raw ?? '알수없음'
}

function parseInflowLabel(raw: string): string {
  if (!raw) return '직접유입'
  // "검색>쇼핑검색(네이버쇼핑)" → "쇼핑검색"
  const last = raw.split('>').pop()?.trim() ?? raw
  const clean = last.replace(/\(.*?\)/g, '').trim()
  return clean || raw
}

/**
 * GET /api/naver/analytics?days=30
 * 정산 분석 / 옵션 분석 / 유입경로 / 결제수단 통계
 */
export async function GET(req: NextRequest) {
  const days       = Number(req.nextUrl.searchParams.get('days') ?? '30')
  const businessId = req.nextUrl.searchParams.get('business_id') ?? undefined

  try {
    // 오늘 신규 + N일 중복 제거
    const [recent, older] = await Promise.all([
      getNaverOrdersLastHours(24, businessId),
      getNaverOrders(days, businessId),
    ])
    const orderMap = new Map(older.map(o => [o.productOrderId, o]))
    recent.forEach(o => orderMap.set(o.productOrderId, o))
    const all = Array.from(orderMap.values())

    const CANCEL_STATUSES = new Set(['CANCELED', 'CANCEL_REQUEST', 'RETURNED', 'RETURN_REQUEST'])
    const active = all.filter(o => !CANCEL_STATUSES.has(o.productOrderStatus))

    // ── 정산 분석 ─────────────────────────────────────────────
    const totalRevenue        = active.reduce((s, o) => s + o.totalPaymentAmount, 0)
    const totalSettlement     = active.reduce((s, o) => s + (o.expectedSettlementAmount ?? 0), 0)
    const totalPayComm        = active.reduce((s, o) => s + (o.paymentCommission ?? 0), 0)
    const totalSaleComm       = active.reduce((s, o) => s + (o.saleCommission ?? 0), 0)
    const totalDiscount       = active.reduce((s, o) => s + (o.discountAmount ?? 0), 0)
    const totalCommission     = totalPayComm + totalSaleComm
    const settlementRate      = totalRevenue > 0 ? Math.round((totalSettlement / totalRevenue) * 100) : 0
    const commissionRate      = totalRevenue > 0 ? Math.round((totalCommission / totalRevenue) * 100) : 0

    // ── 옵션별 분석 ───────────────────────────────────────────
    const optMap = new Map<string, { count: number; revenue: number; orders: number }>()
    for (const o of active) {
      const raw = o.productOption ?? ''
      if (!raw) continue
      // 여러 옵션: "색상: 블루, 사이즈: M" → split by comma
      const parts = raw.split(',').map(s => s.trim()).filter(Boolean)
      for (const part of parts) {
        const key = part.length > 40 ? part.slice(0, 40) + '…' : part
        const prev = optMap.get(key) ?? { count: 0, revenue: 0, orders: 0 }
        optMap.set(key, {
          count:   prev.count + o.quantity,
          revenue: prev.revenue + o.totalPaymentAmount,
          orders:  prev.orders + 1,
        })
      }
    }
    const topOptions = Array.from(optMap.entries())
      .map(([option, v]) => ({ option, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15)

    // ── 유입 경로 분석 ────────────────────────────────────────
    const inflowMap = new Map<string, { count: number; revenue: number }>()
    for (const o of active) {
      const label = parseInflowLabel(o.inflowPath ?? '')
      const prev = inflowMap.get(label) ?? { count: 0, revenue: 0 }
      inflowMap.set(label, {
        count:   prev.count + 1,
        revenue: prev.revenue + o.totalPaymentAmount,
      })
    }
    const inflowStats = Array.from(inflowMap.entries())
      .map(([path, v]) => ({
        path,
        ...v,
        avgAmount: v.count > 0 ? Math.round(v.revenue / v.count) : 0,
        share:     active.length > 0 ? Math.round((v.count / active.length) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)

    // ── 결제수단 분석 ─────────────────────────────────────────
    const payMap = new Map<string, { count: number; revenue: number }>()
    for (const o of active) {
      const label = labelPayment(o.paymentMeans ?? '')
      const prev = payMap.get(label) ?? { count: 0, revenue: 0 }
      payMap.set(label, {
        count:   prev.count + 1,
        revenue: prev.revenue + o.totalPaymentAmount,
      })
    }
    const paymentStats = Array.from(payMap.entries())
      .map(([means, v]) => ({
        means,
        ...v,
        share: active.length > 0 ? Math.round((v.count / active.length) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)

    const membershipCount = active.filter(o => o.isMembershipSubscribed).length
    const membershipRate  = active.length > 0 ? Math.round((membershipCount / active.length) * 100) : 0

    return NextResponse.json({
      success: true,
      days,
      totalOrders:  all.length,
      activeOrders: active.length,
      settlement: {
        totalRevenue,
        totalSettlement,
        totalPayComm,
        totalSaleComm,
        totalCommission,
        totalDiscount,
        settlementRate,
        commissionRate,
      },
      topOptions,
      inflowStats,
      paymentStats,
      membershipCount,
      membershipRate,
    })
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error }, { status: 500 })
  }
}
