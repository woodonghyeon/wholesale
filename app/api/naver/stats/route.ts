import { NextResponse } from 'next/server'
import { getNaverOrders } from '@/lib/naver/orders'

export async function GET() {
  try {
    const orders = await getNaverOrders(30)

    // 오늘·이번주·이번달
    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)
    const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)

    const todayOrders = orders.filter(o => o.orderDate.slice(0, 10) === todayStr)
    const weekOrders = orders.filter(o => new Date(o.orderDate) >= weekAgo)

    // 상태별 집계
    const statusCount: Record<string, number> = {}
    orders.forEach(o => { statusCount[o.productOrderStatus] = (statusCount[o.productOrderStatus] ?? 0) + 1 })

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
      const date = o.orderDate.slice(0, 10)
      if (dailyMap[date]) {
        dailyMap[date].count++
        dailyMap[date].revenue += o.totalPaymentAmount
      }
    })
    const daily = Object.entries(dailyMap).map(([date, v]) => ({ date, ...v }))

    // 최근 주문 5건
    const recentOrders = [...orders]
      .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())
      .slice(0, 5)
      .map(o => ({
        productOrderId: o.productOrderId,
        productName: o.productName,
        ordererName: o.ordererName,
        totalPaymentAmount: o.totalPaymentAmount,
        status: o.productOrderStatus,
        orderDate: o.orderDate,
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
