import { NextResponse } from 'next/server'
import { getNaverOrders, getNaverOrdersLastHours } from '@/lib/naver/orders'

export async function GET() {
  try {
    /**
     * Naver 주문 API 특성:
     * - from 파라미터가 "주문 상태 변경일" 기준으로 동작
     * - 오늘 막 결제된 신규 주문(상태 변경 없음)은 짧은 시간 창으로만 조회됨
     * - 해결: 3가지 구간을 병렬 조회 후 중복 제거
     *   ① 최근 24시간 → 오늘 신규 주문 포함
     *   ② 최근 7일    → 이번 주 배송/구매확정 주문
     *   ③ 최근 30일   → 월간 통계용
     */
    const [today, week, month] = await Promise.all([
      getNaverOrdersLastHours(24),
      getNaverOrders(7),
      getNaverOrders(30),
    ])

    // 중복 제거 — 최신(짧은 창) 데이터 우선
    const orderMap = new Map(month.map(o => [o.productOrderId, o]))
    week.forEach(o => orderMap.set(o.productOrderId, o))
    today.forEach(o => orderMap.set(o.productOrderId, o))
    const orders = Array.from(orderMap.values())

    const now = new Date()
    // KST 기준 오늘 날짜
    const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000)
    const todayStr = kstNow.toISOString().slice(0, 10)
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // orderDate / paymentDate 중 더 최신 값 사용
    const effectiveDate = (o: typeof orders[0]) => {
      const od = o.orderDate ?? ''
      const pd = o.paymentDate ?? ''
      return od > pd ? od : pd
    }

    const todayOrders = orders.filter(o => effectiveDate(o).slice(0, 10) === todayStr)
    const weekOrders  = orders.filter(o => new Date(effectiveDate(o)) >= weekAgo)

    // 상태별 집계
    const statusCount: Record<string, number> = {}
    orders.forEach(o => {
      statusCount[o.productOrderStatus] = (statusCount[o.productOrderStatus] ?? 0) + 1
    })

    // 상품별 TOP5
    const productMap: Record<string, { revenue: number; qty: number }> = {}
    orders.forEach(o => {
      if (!productMap[o.productName]) productMap[o.productName] = { revenue: 0, qty: 0 }
      productMap[o.productName].revenue += o.totalPaymentAmount
      productMap[o.productName].qty += o.quantity
    })
    const topProducts = Object.entries(productMap)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 5)
      .map(([name, v]) => ({ name, revenue: v.revenue, qty: v.qty }))

    // 일별 추이 (최근 14일)
    const dailyMap: Record<string, { count: number; revenue: number }> = {}
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i)
      dailyMap[d.toISOString().slice(0, 10)] = { count: 0, revenue: 0 }
    }
    orders.forEach(o => {
      const date = effectiveDate(o).slice(0, 10)
      if (dailyMap[date]) {
        dailyMap[date].count++
        dailyMap[date].revenue += o.totalPaymentAmount
      }
    })
    const daily = Object.entries(dailyMap).map(([date, v]) => ({ date, ...v }))

    // 최근 주문 5건
    const recentOrders = [...orders]
      .sort((a, b) => effectiveDate(b).localeCompare(effectiveDate(a)))
      .slice(0, 5)
      .map(o => ({
        productOrderId: o.productOrderId,
        productName: o.productName,
        ordererName: o.ordererName,
        totalPaymentAmount: o.totalPaymentAmount,
        status: o.productOrderStatus,
        orderDate: effectiveDate(o),
      }))

    return NextResponse.json({
      success: true,
      summary: {
        total: orders.length,
        totalRevenue: orders.reduce((s, o) => s + o.totalPaymentAmount, 0),
        todayCount: todayOrders.length,
        todayRevenue: todayOrders.reduce((s, o) => s + o.totalPaymentAmount, 0),
        weekCount: weekOrders.length,
        weekRevenue: weekOrders.reduce((s, o) => s + o.totalPaymentAmount, 0),
        canceledCount: (statusCount['CANCELED'] ?? 0) + (statusCount['CANCEL_REQUEST'] ?? 0),
        returnedCount: (statusCount['RETURNED'] ?? 0) + (statusCount['RETURN_REQUEST'] ?? 0),
      },
      statusCount,
      topProducts,
      daily,
      recentOrders,
    })
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error }, { status: 500 })
  }
}
