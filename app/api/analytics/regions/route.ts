export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// 한국 광역시도 추출 패턴
const REGION_PATTERNS: [RegExp, string][] = [
  [/서울/,         '서울'],
  [/부산/,         '부산'],
  [/대구/,         '대구'],
  [/인천/,         '인천'],
  [/광주/,         '광주'],
  [/대전/,         '대전'],
  [/울산/,         '울산'],
  [/세종/,         '세종'],
  [/경기/,         '경기'],
  [/강원/,         '강원'],
  [/충북|충청북/,  '충북'],
  [/충남|충청남/,  '충남'],
  [/전북|전라북/,  '전북'],
  [/전남|전라남/,  '전남'],
  [/경북|경상북/,  '경북'],
  [/경남|경상남/,  '경남'],
  [/제주/,         '제주'],
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
 * naver_orders DB 기반 배송지 지역별 매출 분포 (API 호출 없음)
 */
export async function GET(req: NextRequest) {
  const days = Number(req.nextUrl.searchParams.get('days') ?? '30')

  try {
    const supabase = adminClient()
    const fromDate = new Date()
    fromDate.setDate(fromDate.getDate() - days)

    const { data: orders, error } = await supabase
      .from('naver_orders')
      .select('product_order_id, order_status, total_payment_amount, quantity, receiver_address, receiver_lat, receiver_lng')
      .gte('order_date', fromDate.toISOString())

    if (error) throw new Error('지역 조회 실패: ' + error.message)

    const CANCEL = new Set(['CANCELED', 'CANCEL_REQUEST', 'RETURNED', 'RETURN_REQUEST'])
    const active = (orders ?? []).filter(o => !CANCEL.has(o.order_status ?? ''))

    if (active.length === 0) {
      return NextResponse.json({
        success: true, days, totalCount: 0, totalRevenue: 0,
        regions: [], latLngSamples: [],
        notice: 'naver_orders DB에 데이터가 없습니다. 먼저 네이버 주문 동기화를 실행하세요.',
      })
    }

    // 지역별 집계
    const regionMap = new Map<string, { count: number; revenue: number; qty: number }>()
    for (const o of active) {
      const region = extractRegion(o.receiver_address ?? '')
      const prev = regionMap.get(region) ?? { count: 0, revenue: 0, qty: 0 }
      regionMap.set(region, {
        count:   prev.count + 1,
        revenue: prev.revenue + (o.total_payment_amount ?? 0),
        qty:     prev.qty + (o.quantity ?? 0),
      })
    }

    const totalCount   = active.length
    const totalRevenue = active.reduce((s, o) => s + (o.total_payment_amount ?? 0), 0)

    const regions = Array.from(regionMap.entries())
      .map(([region, v]) => ({
        region,
        ...v,
        avgAmount:    v.count > 0 ? Math.round(v.revenue / v.count) : 0,
        countShare:   totalCount   > 0 ? Math.round((v.count   / totalCount)   * 100) : 0,
        revenueShare: totalRevenue > 0 ? Math.round((v.revenue / totalRevenue) * 100) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)

    // 좌표 샘플 (지도용)
    const latLngSamples = active
      .filter(o => o.receiver_lat && o.receiver_lng)
      .slice(0, 500)
      .map(o => ({
        lat:    o.receiver_lat,
        lng:    o.receiver_lng,
        region: extractRegion(o.receiver_address ?? ''),
        amount: o.total_payment_amount ?? 0,
      }))

    return NextResponse.json({
      success: true, days, totalCount, totalRevenue, regions, latLngSamples,
    })
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error }, { status: 500 })
  }
}
