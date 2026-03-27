import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * GET /api/naver/orders/db
 * naver_orders 테이블에서 저장된 주문 조회 (배송 추적 포함)
 * Query params:
 *   - days: 최근 N일 (default 30)
 *   - status: 상태 필터
 *   - tracking: 운송장번호 포함 여부 (tracking=only → 운송장 있는 것만)
 *   - search: 상품명/주문자/운송장번호 검색
 *   - page: 페이지 (default 1)
 *   - size: 페이지당 건수 (default 50)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const days   = Number(searchParams.get('days') ?? '30')
  const status = searchParams.get('status') ?? ''
  const tracking = searchParams.get('tracking') ?? ''
  const search = searchParams.get('search') ?? ''
  const page   = Math.max(1, Number(searchParams.get('page') ?? '1'))
  const size   = Math.min(200, Number(searchParams.get('size') ?? '50'))

  try {
    const supabase = adminClient()
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    let query = supabase
      .from('naver_orders')
      .select('*', { count: 'exact' })
      .gte('order_date', from)
      .order('order_date', { ascending: false })

    if (status) query = query.eq('order_status', status)
    if (tracking === 'only') query = query.not('tracking_number', 'is', null).neq('tracking_number', '')
    if (search) {
      query = query.or(
        `product_name.ilike.%${search}%,orderer_name.ilike.%${search}%,tracking_number.ilike.%${search}%,receiver_name.ilike.%${search}%`
      )
    }

    const { data, count, error } = await query.range((page - 1) * size, page * size - 1)
    if (error) throw error

    return NextResponse.json({
      success: true,
      total: count ?? 0,
      page,
      size,
      totalPages: Math.ceil((count ?? 0) / size),
      orders: data ?? [],
    })
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error }, { status: 500 })
  }
}
