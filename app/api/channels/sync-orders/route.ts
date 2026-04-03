import { NextResponse } from 'next/server'
import { syncNaverOrders } from '@/lib/channels/naver/adapter'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as {
      days?: number
      channelId?: string
      businessId?: string
    }

    const days = body.days ?? 1
    const toDate = new Date()
    const fromDate = new Date(toDate.getTime() - days * 24 * 60 * 60 * 1000)

    const result = await syncNaverOrders(
      { fromDate, toDate },
      body.channelId,
      body.businessId,
    )

    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json(
      { synced: 0, errors: [e instanceof Error ? e.message : '동기화 실패'] },
      { status: 500 },
    )
  }
}
