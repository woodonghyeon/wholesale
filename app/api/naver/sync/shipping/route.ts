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

/**
 * POST /api/naver/sync/shipping
 * 네이버 주문 중 송장번호가 있는 항목을 shipping_labels 테이블에 upsert
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const days: number = body.days ?? 30
    const businessId: string | undefined = body.business_id

    if (!businessId) {
      return NextResponse.json({ success: false, error: 'business_id 필수' }, { status: 400 })
    }

    const supabase = adminClient()

    // ── 1. naver_orders DB에서 먼저 조회 (송장번호 있는 것만) ──
    const fromDate = new Date()
    fromDate.setDate(fromDate.getDate() - days)

    let ordersWithTracking: any[] = []

    const { data: dbOrders } = await supabase
      .from('naver_orders')
      .select('*')
      .eq('business_id', businessId)
      .gte('order_date', fromDate.toISOString())
      .not('tracking_number', 'is', null)

    if (dbOrders && dbOrders.length > 0) {
      ordersWithTracking = dbOrders
    } else {
      // DB에 없으면 Naver API에서 직접 조회
      const [recent, older] = await Promise.all([
        getNaverOrdersLastHours(24),
        getNaverOrders(days),
      ])
      const map = new Map(older.map(o => [o.productOrderId, o]))
      recent.forEach(o => map.set(o.productOrderId, o))
      const apiOrders = Array.from(map.values())

      // DB에 저장
      if (apiOrders.length > 0) {
        const rows = apiOrders.map(o => ({
          product_order_id:           o.productOrderId,
          order_id:                   o.orderId,
          order_date:                 o.orderDate || null,
          payment_date:               o.paymentDate || null,
          order_status:               o.productOrderStatus,
          product_name:               o.productName,
          product_option:             o.productOption || null,
          quantity:                   o.quantity,
          unit_price:                 o.unitPrice,
          total_payment_amount:       o.totalPaymentAmount,
          orderer_name:               o.ordererName || null,
          orderer_tel:                o.ordererTel || null,
          receiver_name:              o.receiverName || null,
          receiver_tel:               o.receiverTel || null,
          receiver_address:           o.receiverAddress || null,
          delivery_company:           o.deliveryCompany || null,
          tracking_number:            o.trackingNumber || null,
          delivery_status:            o.deliveryStatus || null,
          business_id:                businessId,
          synced_at:                  new Date().toISOString(),
        }))
        await supabase.from('naver_orders').upsert(rows, { onConflict: 'product_order_id' })
      }

      ordersWithTracking = apiOrders
        .filter(o => !!o.trackingNumber)
        .map(o => ({
          product_order_id: o.productOrderId,
          order_date:       o.orderDate,
          payment_date:     o.paymentDate,
          product_name:     o.productName,
          product_option:   o.productOption,
          quantity:         o.quantity,
          receiver_name:    o.receiverName,
          receiver_tel:     o.receiverTel,
          receiver_address: o.receiverAddress,
          delivery_company: o.deliveryCompany,
          tracking_number:  o.trackingNumber,
          delivery_status:  o.deliveryStatus,
        }))
    }

    if (ordersWithTracking.length === 0) {
      return NextResponse.json({ success: true, synced: 0, message: '송장번호가 있는 주문이 없습니다' })
    }

    // ── 2. 이미 등록된 naver_order_id 조회 ─────────────────
    const orderIds = ordersWithTracking.map(o => o.product_order_id)
    const { data: existing } = await supabase
      .from('shipping_labels')
      .select('naver_order_id')
      .in('naver_order_id', orderIds)
    const existingSet = new Set((existing ?? []).map(e => e.naver_order_id))

    // ── 3. 신규 송장만 shipping_labels에 삽입 ─────────────
    const CARRIER_MAP: Record<string, string> = {
      CJGLS:   'CJ대한통운', CJ:     'CJ대한통운', CJLGST: 'CJ대한통운',
      HANJIN:  '한진택배',
      LOTTE:   '롯데택배',   LTCGIS: '롯데택배',
      EPOST:   '우체국',
      LOGEN:   '로젠택배',
      HDEXP:   '현대택배',   HYUNDAI: '현대택배',  HYUNDAILOGIS: '현대택배',
      KDEXP:   '경동택배',
      CHUNIL:  '천일택배',
      DONGBU:  '한덱스',
      GSMNTON: 'GS네트웍스',
    }

    let synced  = 0
    let updated = 0
    for (const o of ordersWithTracking) {
      if (!o.tracking_number) continue

      const shippedDate = (o.payment_date ?? o.order_date ?? '').slice(0, 10)
      const carrierCode = (o.delivery_company ?? '').toUpperCase()
      const carrier     = CARRIER_MAP[carrierCode] ?? o.delivery_company ?? '기타'
      const status      = o.delivery_status === 'DELIVERED' ? 'delivered'
                        : o.delivery_status === 'DELIVERING' ? 'shipped'
                        : 'pending'

      if (existingSet.has(o.product_order_id)) {
        // 기존 항목 상태 업데이트 (배송 상태 변경 반영)
        await supabase
          .from('shipping_labels')
          .update({ status, tracking_no: o.tracking_number, carrier })
          .eq('naver_order_id', o.product_order_id)
        updated++
        continue
      }

      const { error } = await supabase.from('shipping_labels').insert({
        business_id:     businessId,
        naver_order_id:  o.product_order_id,
        carrier,
        tracking_no:     o.tracking_number,
        recipient_name:  o.receiver_name  ?? null,
        recipient_phone: o.receiver_tel   ?? null,
        recipient_addr:  o.receiver_address ?? null,
        product_name:    o.product_name + (o.product_option ? ` (${o.product_option})` : ''),
        qty:             o.quantity ?? null,
        status,
        shipped_at:      shippedDate || null,
      })
      if (!error) synced++
    }

    return NextResponse.json({
      success:   true,
      total:     ordersWithTracking.length,
      synced,
      updated,
      skipped:   ordersWithTracking.length - synced - updated,
    })
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error }, { status: 500 })
  }
}
