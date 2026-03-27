import { NextRequest, NextResponse } from 'next/server'
import { getNaverOrders } from '@/lib/naver/orders'

export async function GET(req: NextRequest) {
  const days = Number(req.nextUrl.searchParams.get('days') ?? '7')
  try {
    const orders = await getNaverOrders(days)
    return NextResponse.json({ success: true, count: orders.length, orders })
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error }, { status: 500 })
  }
}
