import { NextResponse } from 'next/server'
import { getNaverOrders } from '@/lib/naver/orders'

export async function GET() {
  try {
    /**
     * Naver 주문 API 특성:
     * - from 파라미터가 "주문 유입일" 기준이지만, 구매확정(PURCHASE_DECIDED) 상태는
     *   확정 처리일 기준으로 반환되어 최근 결제 완료 주문이 누락될 수 있음.
     * - 해결: 7일(최신) + 30일(과거) 두 번 조회 후 productOrderId로 중복 제거
     */
    const [recent, older] = await Promise.all([
      getNaverOrders(7),   // 최근 7일: 결제완료·배송중 등 진행 중 주문 포함
      getNaverOrders(30),  // 최근 30일: 구매확정 완료된 주문 포함
    ])

    // 중복 제거 — 7일 데이터 우선
    const orderMap = new Map(older.map(o => [o.productOrderId, o]))
    recent.forEach(o => orderMap.set(o.productOrderId, o))
    const orders = Array.from(orderMap.values())

    const now = new Date()
    // KST 기준 오늘 날짜 (UTC+9)
    const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000)
    const todayStr = kstNow.toISOString().slice(0, 10)
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // orderDate 또는 paymentDate 중 더 최신 값을 기준 날짜로 사용
    const getEffectiveDate = (o: typeof orders[0]) => {
      const od = o.orderDate ?? ''
      const pd = o.paymentDate ?? ''
      return od > pd ? od : pd
    }

    const todayOrders = orders.filter(o => getEffectiveDate(o).slice(0, 10) === todayStr)
    const weekOrders = orders.filter(o => new Date(getEffectiveDate(o)) >= weekAgo)

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
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      dailyMap[d.toISOString().slice(0, 10)] = { count: 0, revenue: 0 }
    }
    orders.forEach(o => {
      const date = getEffectiveDate(o).slice(0, 10)
      if (dailyMap[date]) {
        dailyMap[date].count++
        dailyMap[date].revenue += o.totalPaymentAmount
      }
    })
    const daily = Object.entries(dailyMap).map(([date, v]) => ({ date, ...v }))

    // 최근 주문 5건 — effectiveDate 기준 최신순
    const recentOrders = [...orders]
      .sort((a, b) => getEffectiveDate(b).localeCompare(getEffectiveDate(a)))
      .slice(0, 5)
      .map(o => ({
        productOrderId: o.productOrderId,
        productName: o.productName,
        ordererName: o.ordererName,
        totalPaymentAmount: o.totalPaymentAmount,
        status: o.productOrderStatus,
        orderDate: getEffectiveDate(o),
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
