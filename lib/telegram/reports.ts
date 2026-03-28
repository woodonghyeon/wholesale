/**
 * 텔레그램 자동 리포트 빌더
 * - 일일 매출 리포트 (매일 오전 9시)
 * - 주간 리포트 (월요일 오전 9시)
 * - 재고 소진 임박 알림
 */

import { sendTelegram, isTelegramConfigured } from './index'
import { createClient } from '@supabase/supabase-js'
import { getNaverOrders, getNaverOrdersLastHours } from '@/lib/naver/orders'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ── 일일 매출 리포트 ────────────────────────────────────────────
export async function sendDailyReport(): Promise<void> {
  if (!isTelegramConfigured()) return

  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const ymd = yesterday.toISOString().slice(0, 10)
  const today = now.toISOString().slice(0, 10)

  // 어제 주문 (네이버 API: 최근 2일 조회 후 어제 날짜 필터)
  const [recent48h, prevDay] = await Promise.all([
    getNaverOrdersLastHours(48),
    getNaverOrders(2),
  ])
  const orderMap = new Map(prevDay.map(o => [o.productOrderId, o]))
  recent48h.forEach(o => orderMap.set(o.productOrderId, o))
  const allOrders = Array.from(orderMap.values())

  const CANCEL = new Set(['CANCELED', 'CANCEL_REQUEST', 'RETURNED', 'RETURN_REQUEST'])
  const yesterday_orders = allOrders.filter(o => {
    const d = (o.paymentDate ?? o.orderDate ?? '').slice(0, 10)
    return d === ymd && !CANCEL.has(o.productOrderStatus)
  })
  const today_orders = allOrders.filter(o => {
    const d = (o.paymentDate ?? o.orderDate ?? '').slice(0, 10)
    return d === today && !CANCEL.has(o.productOrderStatus)
  })

  const yRev  = yesterday_orders.reduce((s, o) => s + o.totalPaymentAmount, 0)
  const ySettle = yesterday_orders.reduce((s, o) => s + (o.expectedSettlementAmount ?? 0), 0)
  const yQty  = yesterday_orders.reduce((s, o) => s + o.quantity, 0)
  const tdRev = today_orders.reduce((s, o) => s + o.totalPaymentAmount, 0)

  // 어제 취소/반품
  const yCancels = allOrders.filter(o => {
    const d = (o.paymentDate ?? o.orderDate ?? '').slice(0, 10)
    return d === ymd && CANCEL.has(o.productOrderStatus)
  })

  // TOP3 상품 (어제)
  const prodMap = new Map<string, number>()
  for (const o of yesterday_orders) {
    prodMap.set(o.productName, (prodMap.get(o.productName) ?? 0) + o.totalPaymentAmount)
  }
  const top3 = Array.from(prodMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)

  // DB 부족 재고 수 (간략)
  const supabase = adminClient()
  const { data: inv } = await supabase
    .from('inventory')
    .select('quantity, products(min_stock, name)')
  const lowStock = (inv ?? []).filter(
    (r: any) => r.products?.min_stock > 0 && r.quantity <= r.products.min_stock
  )

  const lines = [
    `📊 <b>일일 매출 리포트 — ${ymd}</b>`,
    '',
    `🟢 어제 주문: <b>${yesterday_orders.length}건</b> / <b>${yRev.toLocaleString()}원</b>`,
    `💰 정산 예정금: <b>${ySettle.toLocaleString()}원</b>`,
    `📦 총 수량: ${yQty}개`,
    yCancels.length > 0 ? `🔴 취소·반품: ${yCancels.length}건` : `✅ 취소·반품: 0건`,
    '',
  ]

  if (top3.length > 0) {
    lines.push('🏆 어제 TOP 상품')
    top3.forEach(([name, rev], i) => {
      const short = name.length > 20 ? name.slice(0, 20) + '…' : name
      lines.push(`  ${i + 1}. ${short} — ${rev.toLocaleString()}원`)
    })
    lines.push('')
  }

  if (today_orders.length > 0) {
    lines.push(`🔔 오늘 현재: ${today_orders.length}건 / ${tdRev.toLocaleString()}원`)
  }

  if (lowStock.length > 0) {
    lines.push('')
    lines.push(`⚠️ 부족 재고: ${lowStock.length}개 품목 → /inventory 확인`)
  }

  await sendTelegram(lines.join('\n'))
}

// ── 주간 리포트 ─────────────────────────────────────────────────
export async function sendWeeklyReport(): Promise<void> {
  if (!isTelegramConfigured()) return

  const [recent, older] = await Promise.all([
    getNaverOrdersLastHours(24),
    getNaverOrders(7),
  ])
  const map = new Map(older.map(o => [o.productOrderId, o]))
  recent.forEach(o => map.set(o.productOrderId, o))
  const all = Array.from(map.values())

  const CANCEL = new Set(['CANCELED', 'CANCEL_REQUEST', 'RETURNED', 'RETURN_REQUEST'])
  const active = all.filter(o => !CANCEL.has(o.productOrderStatus))
  const canceled = all.filter(o => CANCEL.has(o.productOrderStatus))

  const totalRev    = active.reduce((s, o) => s + o.totalPaymentAmount, 0)
  const totalSettle = active.reduce((s, o) => s + (o.expectedSettlementAmount ?? 0), 0)
  const avgOrder    = active.length > 0 ? Math.round(totalRev / active.length) : 0

  // 일별 매출
  const dailyMap = new Map<string, number>()
  for (const o of active) {
    const d = (o.paymentDate ?? o.orderDate ?? '').slice(0, 10)
    if (d) dailyMap.set(d, (dailyMap.get(d) ?? 0) + o.totalPaymentAmount)
  }
  const bestDay = Array.from(dailyMap.entries()).sort((a, b) => b[1] - a[1])[0]

  // TOP5 상품
  const prodMap = new Map<string, { rev: number; qty: number }>()
  for (const o of active) {
    const prev = prodMap.get(o.productName) ?? { rev: 0, qty: 0 }
    prodMap.set(o.productName, { rev: prev.rev + o.totalPaymentAmount, qty: prev.qty + o.quantity })
  }
  const top5 = Array.from(prodMap.entries())
    .sort((a, b) => b[1].rev - a[1].rev)
    .slice(0, 5)

  const lines = [
    `📈 <b>주간 매출 리포트 (최근 7일)</b>`,
    '',
    `🟢 총 주문: <b>${active.length}건</b> / <b>${totalRev.toLocaleString()}원</b>`,
    `💰 정산 예정금: <b>${totalSettle.toLocaleString()}원</b>`,
    `📊 평균 주문금액: ${avgOrder.toLocaleString()}원`,
    canceled.length > 0 ? `🔴 취소·반품: ${canceled.length}건` : `✅ 취소·반품: 0건`,
    bestDay ? `⭐ 최고 매출일: ${bestDay[0]} (${bestDay[1].toLocaleString()}원)` : '',
    '',
    '🏆 주간 TOP 5 상품',
    ...top5.map(([name, { rev, qty }], i) => {
      const short = name.length > 18 ? name.slice(0, 18) + '…' : name
      return `  ${i + 1}. ${short}\n      ${rev.toLocaleString()}원 (${qty}개)`
    }),
  ].filter(Boolean)

  await sendTelegram(lines.join('\n'))
}

// ── 재고 소진 임박 알림 ─────────────────────────────────────────
export async function sendStockAlert(): Promise<void> {
  if (!isTelegramConfigured()) return

  const supabase = adminClient()
  const { data: inv } = await supabase
    .from('inventory')
    .select('quantity, products(id, name, min_stock, barcode)')

  if (!inv) return

  const lowItems = (inv as any[]).filter(
    r => r.products?.min_stock > 0 && r.quantity <= r.products.min_stock
  ).map(r => ({
    name:      r.products.name as string,
    quantity:  r.quantity as number,
    min_stock: r.products.min_stock as number,
  }))

  if (lowItems.length === 0) return

  const lines = [
    `⚠️ <b>재고 부족 알림 — ${lowItems.length}개 품목</b>`,
    '',
    ...lowItems.map(i =>
      `• ${i.name}\n  현재 ${i.quantity}개 (안전재고 ${i.min_stock}개)`
    ),
    '',
    '→ 재고 관리 페이지에서 발주 처리하세요',
  ]

  await sendTelegram(lines.join('\n'))
}
