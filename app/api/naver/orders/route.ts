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
 * GET /api/naver/orders?days=30          → DB 캐시 우선 반환
 * GET /api/naver/orders?days=30&refresh=1 → Naver API 호출 후 DB 저장, 반환
 */
export async function GET(req: NextRequest) {
  const days       = Number(req.nextUrl.searchParams.get('days') ?? '7')
  const refresh    = req.nextUrl.searchParams.get('refresh') === '1'
  const businessId = req.nextUrl.searchParams.get('business_id') ?? undefined

  try {
    const supabase = adminClient()

    // ── DB 캐시 조회 ──────────────────────────────────────
    const fromDate = new Date()
    fromDate.setDate(fromDate.getDate() - days)

    const { data: cached, error: dbErr } = await supabase
      .from('naver_orders')
      .select('*')
      .gte('order_date', fromDate.toISOString())
      .order('order_date', { ascending: false })

    const hasCache = !dbErr && (cached?.length ?? 0) > 0

    // 캐시가 있고 refresh 요청이 없으면 DB에서 바로 반환
    if (hasCache && !refresh) {
      // 가장 최근 synced_at 확인 (30분 이내면 신선한 데이터)
      const latestSync = cached!.reduce((max, r) =>
        r.synced_at > max ? r.synced_at : max, cached![0].synced_at
      )
      const syncAge = Date.now() - new Date(latestSync).getTime()
      const FRESH_MS = 30 * 60 * 1000 // 30분

      if (syncAge < FRESH_MS) {
        const orders = mapDbToOrders(cached!)
        return NextResponse.json({
          success:  true,
          count:    orders.length,
          orders,
          source:   'cache',
          cachedAt: latestSync,
        })
      }
    }

    // ── Naver API 호출 (refresh 또는 캐시 만료) ──────────
    const [recent, older] = await Promise.all([
      getNaverOrdersLastHours(24, businessId),
      getNaverOrders(days, businessId),
    ])
    const map = new Map(older.map(o => [o.productOrderId, o]))
    recent.forEach(o => map.set(o.productOrderId, o))
    const apiOrders = Array.from(map.values())

    // ── 조회된 주문을 naver_orders에 upsert (히스토리 보존) ──
    if (apiOrders.length > 0) {
      // business_id가 없으므로 기존 캐시에서 추출하거나 null로 저장
      const existingBusinessId = cached?.[0]?.business_id ?? null

      const rows = apiOrders.map(o => ({
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
        business_id:                existingBusinessId,
        synced_at:                  new Date().toISOString(),
      }))

      const { error: saveErr } = await supabase
        .from('naver_orders')
        .upsert(rows, { onConflict: 'product_order_id' })
      if (saveErr) console.error('[Naver Orders] DB 저장 실패:', saveErr.message)
    }

    return NextResponse.json({
      success: true,
      count:   apiOrders.length,
      orders:  apiOrders,
      source:  'api',
    })
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error }, { status: 500 })
  }
}

// DB row → NaverProductOrder 형태 변환
function mapDbToOrders(rows: any[]) {
  return rows.map(r => ({
    productOrderId:           r.product_order_id,
    orderId:                  r.order_id ?? '',
    orderDate:                r.order_date ?? '',
    paymentDate:              r.payment_date ?? '',
    productOrderStatus:       r.order_status ?? '',
    productName:              r.product_name ?? '',
    productNo:                r.product_no ?? '',
    channelProductNo:         r.channel_product_no ?? '',
    productOption:            r.product_option ?? '',
    quantity:                 r.quantity ?? 1,
    unitPrice:                r.unit_price ?? 0,
    totalPaymentAmount:       r.total_payment_amount ?? 0,
    discountAmount:           r.discount_amount ?? 0,
    expectedSettlementAmount: r.expected_settlement_amount ?? 0,
    paymentCommission:        r.payment_commission ?? 0,
    saleCommission:           r.sale_commission ?? 0,
    ordererName:              r.orderer_name ?? '',
    ordererTel:               r.orderer_tel ?? '',
    receiverName:             r.receiver_name ?? '',
    receiverTel:              r.receiver_tel ?? '',
    receiverAddress:          r.receiver_address ?? '',
    receiverZipCode:          r.receiver_zip_code ?? '',
    receiverLat:              null,
    receiverLng:              null,
    deliveryCompany:          r.delivery_company ?? '',
    trackingNumber:           r.tracking_number ?? '',
    deliveryStatus:           r.delivery_status ?? '',
    inflowPath:               r.inflow_path ?? '',
    paymentMeans:             r.payment_means ?? '',
    isMembershipSubscribed:   r.is_membership_subscribed ?? false,
  }))
}
