export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getNaverOrders, getNaverOrdersLastHours } from '@/lib/naver/orders'

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

    // ── 1. 네이버 주문 조회 (최근 24h + N일 병합) ──────────────
    const [recent, older] = await Promise.all([
      getNaverOrdersLastHours(24, businessId),
      getNaverOrders(days, businessId),
    ])
    const map = new Map(older.map(o => [o.productOrderId, o]))
    recent.forEach(o => map.set(o.productOrderId, o))
    const orders = Array.from(map.values())

    if (orders.length === 0) {
      return NextResponse.json({ success: true, synced: 0, dbSaved: 0, message: '동기화할 신규 주문 없음' })
    }

    // ── 2. naver_orders 테이블에 전체 주문 upsert (히스토리 보존) ─
    const naverRows = orders.map(o => ({
      product_order_id:           o.productOrderId,
      order_id:                   o.orderId,
      order_date:                 o.orderDate || null,
      payment_date:               o.paymentDate || null,
      order_status:               o.productOrderStatus,
      product_name:               o.productName,
      product_no:                 o.productNo || null,
      channel_product_no:         o.channelProductNo || null,
      product_option:             o.productOption || null,
      quantity:                   o.quantity,
      unit_price:                 o.unitPrice,
      total_payment_amount:       o.totalPaymentAmount,
      discount_amount:            o.discountAmount ?? 0,
      expected_settlement_amount: o.expectedSettlementAmount ?? 0,
      payment_commission:         o.paymentCommission ?? 0,
      sale_commission:            o.saleCommission ?? 0,
      orderer_name:               o.ordererName || null,
      orderer_tel:                o.ordererTel || null,
      receiver_name:              o.receiverName || null,
      receiver_tel:               o.receiverTel || null,
      receiver_address:           o.receiverAddress || null,
      receiver_zip_code:          o.receiverZipCode || null,
      delivery_company:           o.deliveryCompany || null,
      tracking_number:            o.trackingNumber || null,
      delivery_status:            o.deliveryStatus || null,
      inflow_path:                o.inflowPath || null,
      payment_means:              o.paymentMeans || null,
      is_membership_subscribed:   o.isMembershipSubscribed ?? false,
      business_id:                businessId,
      synced_at:                  new Date().toISOString(),
    }))

    const { error: upsertErr } = await supabase
      .from('naver_orders')
      .upsert(naverRows, { onConflict: 'product_order_id' })

    if (upsertErr) {
      console.error('[Naver Sync] naver_orders upsert 실패:', upsertErr.message)
    }
    const dbSaved = upsertErr ? 0 : naverRows.length

    // ── 3. '네이버스마트스토어' 채널 ID 조회 ───────────────────
    const { data: channels } = await supabase
      .from('channels')
      .select('id, name')
      .order('sort_order')
    const naverChannel = channels?.find(c =>
      c.name.includes('네이버') || c.name.toLowerCase().includes('naver')
    ) ?? channels?.[0]

    // ── 4. 이미 slips에 동기화된 주문 확인 ────────────────────
    const orderIds = orders.map(o => o.productOrderId)
    const { data: existingSlips } = await supabase
      .from('slips')
      .select('memo')
      .in('memo', orderIds.map(id => `[naver]${id}`))
    const syncedIds = new Set((existingSlips ?? []).map(s => s.memo))

    // ── 5. 신규 주문만 슬립 생성 ─────────────────────────────
    let synced = 0
    const errors: string[] = []

    for (const order of orders) {
      // 취소·반품은 슬립 생성 안 함
      if (['CANCELED', 'CANCEL_REQUEST', 'RETURNED', 'RETURN_REQUEST'].includes(order.productOrderStatus)) continue

      const memoKey = `[naver]${order.productOrderId}`
      if (syncedIds.has(memoKey)) continue

      const slipDate = order.paymentDate
        ? order.paymentDate.slice(0, 10)
        : order.orderDate.slice(0, 10)

      const supplyAmount = Math.round(order.totalPaymentAmount / 1.1)
      const taxAmount    = order.totalPaymentAmount - supplyAmount

      const { data: slip, error: slipErr } = await supabase
        .from('slips')
        .insert({
          slip_type:     'sale',
          business_id:   businessId,
          channel_id:    naverChannel?.id ?? null,
          slip_date:     slipDate,
          payment_type:  'cash',
          cash_amount:   order.totalPaymentAmount,
          supply_amount: supplyAmount,
          tax_amount:    taxAmount,
          total_amount:  order.totalPaymentAmount,
          is_tax_invoice: false,
          memo:          memoKey,
        })
        .select('id')
        .single()

      if (slipErr || !slip) {
        errors.push(`주문 ${order.productOrderId}: ${slipErr?.message}`)
        continue
      }

      const itemSupply = Math.round(order.unitPrice * order.quantity / 1.1)
      await supabase.from('slip_items').insert({
        slip_id:        slip.id,
        product_name:   order.productName + (order.productOption ? ` (${order.productOption})` : ''),
        quantity:       order.quantity,
        unit_price:     Math.round(order.unitPrice / 1.1),
        supply_amount:  itemSupply,
        tax_amount:     (order.unitPrice * order.quantity) - itemSupply,
        sort_order:     0,
      })

      synced++
    }

    return NextResponse.json({
      success: true,
      total:   orders.length,
      dbSaved,
      synced,
      skipped: orders.length - synced - errors.length,
      errors:  errors.length > 0 ? errors : undefined,
    })
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error }, { status: 500 })
  }
}
