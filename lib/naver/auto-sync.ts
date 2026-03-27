/**
 * 네이버 주문 자동 동기화 (증분 방식)
 *
 * ─ 동작 원리 ─────────────────────────────────────────────────────
 * DB 저장 성공 여부와 관계없이 "마지막 동기화 시각(lastSyncedAt)"을
 * 프로세스 메모리에 보관한다.
 * 매 2분마다 그 시각 이후 주문/반품만 API로 조회 → 반환된 데이터는
 * 정의상 100% 신규이므로 중복 체크 없이 바로 텔레그램 전송 + DB 저장.
 *
 * ─ 최초 실행 ─────────────────────────────────────────────────────
 * lastSyncedAt 이 null 이면 최근 5분치만 가져온다.
 * (서버 재시작 시 이미 처리된 주문이 한 번 더 올 수 있지만,
 *  이후부터는 정확히 증분 처리됨)
 * ─────────────────────────────────────────────────────────────────
 */

import { createClient } from '@supabase/supabase-js'
import { getNaverOrdersSince } from './orders'
import { getNaverClaimsSince } from './claims'
import { getNaverProducts } from './products'
import { sendTelegram, buildOrderAlert, buildClaimAlert, isTelegramConfigured } from '../telegram'
import type { NaverProductOrder } from './orders'
import type { NaverClaim } from './claims'

// ── 증분 기준 시각 (프로세스 생존 동안 유지) ──────────────────────
let lastSyncedAt: Date | null = null

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ── DB 저장 (실패해도 동기화 자체는 계속) ────────────────────────
async function saveOrdersToDB(orders: NaverProductOrder[]) {
  if (!orders.length) return
  const supabase = adminClient()

  const { data: businesses } = await supabase
    .from('businesses')
    .select('id')
    .order('created_at')
    .limit(1)
  const businessId = businesses?.[0]?.id
  if (!businessId) return

  const { data: channels } = await supabase
    .from('channels')
    .select('id, name')
  const naverChannel = channels?.find(
    c => c.name.includes('네이버') || c.name.toLowerCase().includes('naver')
  ) ?? channels?.[0]

  for (const order of orders) {
    const slipDate = (order.paymentDate ?? order.orderDate).slice(0, 10)
    const memo = `[naver]${order.productOrderId}`

    // ── naver_orders upsert (전체 원본 데이터 저장) ──────────
    await supabase.from('naver_orders').upsert({
      product_order_id:           order.productOrderId,
      order_id:                   order.orderId,
      order_date:                 order.orderDate || null,
      payment_date:               order.paymentDate || null,
      order_status:               order.productOrderStatus,
      product_name:               order.productName,
      product_no:                 order.productNo || null,
      channel_product_no:         order.channelProductNo || null,
      product_option:             order.productOption || null,
      quantity:                   order.quantity,
      unit_price:                 order.unitPrice,
      total_payment_amount:       order.totalPaymentAmount,
      discount_amount:            order.discountAmount,
      expected_settlement_amount: order.expectedSettlementAmount,
      payment_commission:         order.paymentCommission,
      sale_commission:            order.saleCommission,
      orderer_name:               order.ordererName,
      orderer_tel:                order.ordererTel,
      receiver_name:              order.receiverName || null,
      receiver_tel:               order.receiverTel || null,
      receiver_address:           order.receiverAddress || null,
      receiver_zip_code:          order.receiverZipCode || null,
      receiver_lat:               order.receiverLat,
      receiver_lng:               order.receiverLng,
      delivery_company:           order.deliveryCompany || null,
      tracking_number:            order.trackingNumber || null,
      delivery_status:            order.deliveryStatus || null,
      inflow_path:                order.inflowPath || null,
      payment_means:              order.paymentMeans || null,
      is_membership_subscribed:   order.isMembershipSubscribed,
      business_id:                businessId,
      synced_at:                  new Date().toISOString(),
    }, { onConflict: 'product_order_id' })

    // ── slips 중복 체크 후 저장 ──────────────────────────────
    const { count } = await supabase
      .from('slips')
      .select('id', { count: 'exact', head: true })
      .eq('memo', memo)
    if ((count ?? 0) > 0) continue

    const supplyAmount = Math.round(order.totalPaymentAmount / 1.1)
    const taxAmount = order.totalPaymentAmount - supplyAmount

    const { data: slip } = await supabase
      .from('slips')
      .insert({
        slip_type: 'sale',
        business_id: businessId,
        channel_id: naverChannel?.id ?? null,
        slip_date: slipDate,
        payment_type: 'cash',
        cash_amount: order.totalPaymentAmount,
        supply_amount: supplyAmount,
        tax_amount: taxAmount,
        total_amount: order.totalPaymentAmount,
        is_tax_invoice: false,
        memo,
      })
      .select('id')
      .single()

    if (slip?.id) {
      const itemSupply = Math.round(order.unitPrice * order.quantity / 1.1)
      await supabase.from('slip_items').insert({
        slip_id: slip.id,
        product_name: order.productName,
        quantity: order.quantity,
        unit_price: Math.round(order.unitPrice / 1.1),
        supply_amount: itemSupply,
        tax_amount: (order.unitPrice * order.quantity) - itemSupply,
        sort_order: 0,
      })
    }
  }
}

async function saveClaimsToDB(claims: NaverClaim[]) {
  if (!claims.length) return
  const supabase = adminClient()

  const { data: businesses } = await supabase
    .from('businesses')
    .select('id')
    .order('created_at')
    .limit(1)
  const businessId = businesses?.[0]?.id
  if (!businessId) return

  const REASON_MAP: Record<string, string> = {
    RETURN: 'other',
    CANCEL: 'simple',
    EXCHANGE: 'other',
  }

  for (const claim of claims) {
    const note = `[naver]${claim.claimId}`

    const { count } = await supabase
      .from('returns')
      .select('id', { count: 'exact', head: true })
      .eq('note', note)
    if ((count ?? 0) > 0) continue

    await supabase.from('returns').insert({
      business_id: businessId,
      quantity: claim.quantity,
      reason: REASON_MAP[claim.claimType] ?? 'other',
      status: 'received',
      restock_done: false,
      note,
    })
  }
}

// ── 상품 DB 저장 (1시간마다 전체 갱신) ─────────────────────────
let lastProductSyncAt: Date | null = null

async function saveProductsToDB() {
  const now = new Date()
  // 1시간마다만 실행
  if (lastProductSyncAt && now.getTime() - lastProductSyncAt.getTime() < 60 * 60 * 1000) return
  lastProductSyncAt = now

  const supabase = adminClient()
  const { data: businesses } = await supabase.from('businesses').select('id').order('created_at').limit(1)
  const businessId = businesses?.[0]?.id
  if (!businessId) return

  const products = await getNaverProducts()
  console.log(`[Naver Sync] 상품 동기화: ${products.length}개`)

  for (const p of products) {
    const naverNo = String(p.originProductNo)
    // 이미 있으면 가격·재고 업데이트, 없으면 insert
    const { data: existing } = await supabase
      .from('products')
      .select('id')
      .eq('barcode', `naver_${naverNo}`)
      .maybeSingle()

    if (existing?.id) {
      await supabase.from('products').update({
        sell_price: p.salePrice,
        note: `네이버 재고: ${p.stockQuantity ?? 0}`,
      }).eq('id', existing.id)
    } else {
      await supabase.from('products').insert({
        business_id: businessId,
        name: p.name,
        barcode: `naver_${naverNo}`,
        category: p.categoryName || null,
        unit: 'ea',
        buy_price: 0,
        sell_price: p.salePrice,
        min_stock: 0,
        is_bundle: false,
        note: `네이버 재고: ${p.stockQuantity ?? 0}`,
      })
    }
  }
}

// ── 메인 동기화 함수 ────────────────────────────────────────────
export async function runNaverAutoSync(): Promise<{
  newOrders: number
  newClaims: number
  syncedAt: string
}> {
  const now = new Date()

  // 기준 시각: 마지막 동기화 시각 or (최초 실행) 5분 전
  const from = lastSyncedAt ?? new Date(now.getTime() - 5 * 60 * 1000)

  console.log(
    `[Naver Sync] 조회 기준: ${from.toISOString()} → ${now.toISOString()}`
  )

  // 기준 시각 즉시 업데이트 (다음 실행에서 겹치지 않도록)
  lastSyncedAt = now

  const [newOrders, newClaims] = await Promise.all([
    getNaverOrdersSince(from),
    getNaverClaimsSince(from),
  ])

  console.log(
    `[Naver Sync] 신규 주문 ${newOrders.length}건 / 반품 ${newClaims.length}건`
  )

  // 텔레그램 알림
  if (isTelegramConfigured()) {
    if (newOrders.length > 0) {
      await sendTelegram(buildOrderAlert(newOrders.length, newOrders))
    }
    if (newClaims.length > 0) {
      await sendTelegram(buildClaimAlert(newClaims.length, newClaims))
    }
  }

  // DB 저장 (비동기, 실패해도 무관)
  await Promise.allSettled([
    saveOrdersToDB(newOrders),
    saveClaimsToDB(newClaims),
    saveProductsToDB(),
  ])

  return {
    newOrders: newOrders.length,
    newClaims: newClaims.length,
    syncedAt: now.toISOString(),
  }
}
