import { NextRequest, NextResponse } from 'next/server'
import { getNaverOrders, getNaverOrdersLastHours } from '@/lib/naver/orders'

// 한국 광역시도 추출 패턴
const REGION_PATTERNS: [RegExp, string][] = [
  [/서울/,   '서울'],
  [/부산/,   '부산'],
  [/대구/,   '대구'],
  [/인천/,   '인천'],
  [/광주/,   '광주'],
  [/대전/,   '대전'],
  [/울산/,   '울산'],
  [/세종/,   '세종'],
  [/경기/,   '경기'],
  [/강원/,   '강원'],
  [/충북|충청북/,  '충북'],
  [/충남|충청남/,  '충남'],
  [/전북|전라북/,  '전북'],
  [/전남|전라남/,  '전남'],
  [/경북|경상북/,  '경북'],
  [/경남|경상남/,  '경남'],
  [/제주/,   '제주'],
]

function extractRegion(address: string): string {
  if (!address) return '기타'
  for (const [pattern, name] of REGION_PATTERNS) {
    if (pattern.test(address)) return name
  }
  return '기타'
}

/**
 * GET /api/analytics/regions?days=30
 * 배송지 지역별 매출 분포
 */
export async function GET(req: NextRequest) {
  const days = Number(req.nextUrl.searchParams.get('days') ?? '30')

  try {
    const [recent, older] = await Promise.all([
      getNaverOrdersLastHours(24),
      getNaverOrders(days),
    ])
    const orderMap = new Map(older.map(o => [o.productOrderId, o]))
    recent.forEach(o => orderMap.set(o.productOrderId, o))
    const orders = Array.from(orderMap.values())

    const CANCEL = new Set(['CANCELED', 'CANCEL_REQUEST', 'RETURNED', 'RETURN_REQUEST'])
    const active = orders.filter(o => !CANCEL.has(o.productOrderStatus))

    // 지역별 집계
    const regionMap = new Map<string, { count: number; revenue: number; qty: number }>()

    for (const o of active) {
      const region = extractRegion(o.receiverAddress ?? '')
      const prev = regionMap.get(region) ?? { count: 0, revenue: 0, qty: 0 }
      regionMap.set(region, {
        count:   prev.count + 1,
        revenue: prev.revenue + o.totalPaymentAmount,
        qty:     prev.qty + o.quantity,
      })
    }

    const totalCount = active.length
    const totalRevenue = active.reduce((s, o) => s + o.totalPaymentAmount, 0)

    const regions = Array.from(regionMap.entries())
      .map(([region, v]) => ({
        region,
        ...v,
        avgAmount:    v.count > 0 ? Math.round(v.revenue / v.count) : 0,
        countShare:   totalCount > 0 ? Math.round((v.count / totalCount) * 100) : 0,
        revenueShare: totalRevenue > 0 ? Math.round((v.revenue / totalRevenue) * 100) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)

    // 좌표 데이터 (지도용: 대표 좌표)
    const latLngSamples = active
      .filter(o => o.receiverLat && o.receiverLng)
      .slice(0, 500)
      .map(o => ({
        lat: o.receiverLat,
        lng: o.receiverLng,
        region: extractRegion(o.receiverAddress ?? ''),
        amount: o.totalPaymentAmount,
      }))

    return NextResponse.json({
      success: true,
      days,
      totalCount,
      totalRevenue,
      regions,
      latLngSamples,
    })
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error }, { status: 500 })
  }
}
