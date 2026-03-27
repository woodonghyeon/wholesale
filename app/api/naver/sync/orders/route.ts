import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getNaverOrders } from '@/lib/naver/orders'

// 서비스 롤 클라이언트 (RLS 우회하여 서버에서 직접 저장)
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const days: number = body.days ?? 7
    const businessId: string | undefined = body.business_id

    if (!businessId) {
      return NextResponse.json({ success: false, error: 'business_id 필수' }, { status: 400 })
    }

    const supabase = adminClient()

    // 1. 네이버 주문 조회
    const orders = await getNaverOrders(days)
    if (orders.length === 0) {
      return NextResponse.json({ success: true, synced: 0, message: '동기화할 신규 주문 없음' })
    }

    // 2. '네이버스마트스토어' 채널 ID 조회 (없으면 첫 번째 채널 사용)
    const { data: channels } = await supabase
      .from('channels')
      .select('id, name')
      .order('sort_order')
    const naverChannel = channels?.find(c =>
      c.name.includes('네이버') || c.name.toLowerCase().includes('naver')
    ) ?? channels?.[0]

    // 3. 이미 동기화된 주문 ID 목록 확인 (memo에 naver_order_id 저장)
    const orderIds = orders.map(o => o.productOrderId)
    const { data: existingSlips } = await supabase
      .from('slips')
      .select('memo')
      .in('memo', orderIds.map(id => `[naver]${id}`))
    const syncedIds = new Set((existingSlips ?? []).map(s => s.memo))

    // 4. 신규 주문만 슬립 생성
    let synced = 0
    const errors: string[] = []

    for (const order of orders) {
      const memoKey = `[naver]${order.productOrderId}`
      if (syncedIds.has(memoKey)) continue

      const slipDate = order.paymentDate
        ? order.paymentDate.slice(0, 10)
        : order.orderDate.slice(0, 10)

      const { data: slip, error: slipErr } = await supabase
        .from('slips')
        .insert({
          slip_type: 'sale',
          business_id: businessId,
          channel_id: naverChannel?.id ?? null,
          slip_date: slipDate,
          total_amount: order.totalPaymentAmount,
          memo: memoKey,
          status: 'confirmed',
        })
        .select('id')
        .single()

      if (slipErr || !slip) {
        errors.push(`주문 ${order.productOrderId}: ${slipErr?.message}`)
        continue
      }

      // 슬립 아이템 생성 (상품명으로만 저장)
      await supabase.from('slip_items').insert({
        slip_id: slip.id,
        product_name_override: order.productName,
        quantity: order.quantity,
        unit_price: order.unitPrice,
        amount: order.totalPaymentAmount,
        sort_order: 0,
      })

      synced++
    }

    return NextResponse.json({
      success: true,
      total: orders.length,
      synced,
      skipped: orders.length - synced - errors.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error }, { status: 500 })
  }
}
