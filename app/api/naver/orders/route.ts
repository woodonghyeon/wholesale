import { NextRequest, NextResponse } from 'next/server'
import { getNaverOrders, getNaverOrdersLastHours } from '@/lib/naver/orders'

export async function GET(req: NextRequest) {
  const days = Number(req.nextUrl.searchParams.get('days') ?? '7')
  try {
    // Naver API 특성: 오늘 신규 주문은 짧은 시간 창으로만 조회됨
    // → 24시간 + N일 병렬 조회 후 중복 제거
    const [recent, older] = await Promise.all([
      getNaverOrdersLastHours(24),
      getNaverOrders(days),
    ])

    const map = new Map(older.map(o => [o.productOrderId, o]))
    recent.forEach(o => map.set(o.productOrderId, o))
    const orders = Array.from(map.values())

    return NextResponse.json({ success: true, count: orders.length, orders })
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error }, { status: 500 })
  }
}
