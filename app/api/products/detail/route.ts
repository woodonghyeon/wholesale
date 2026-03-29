export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: NextRequest) {
  const id   = req.nextUrl.searchParams.get('id')
  const name = req.nextUrl.searchParams.get('name')

  if (!id && !name) {
    return NextResponse.json({ error: 'id 또는 name 필요' }, { status: 400 })
  }

  const supabase = adminClient()

  // ── 1. 상품 기본 정보 ──────────────────────────────
  let productQuery = supabase.from('products').select('*')
  if (id)   productQuery = (productQuery.eq('id', id) as any).maybeSingle()
  else      productQuery = (productQuery.ilike('name', `%${name}%`) as any).limit(1).maybeSingle()

  const { data: productRaw } = await productQuery
  const product = productRaw as any
  if (!product) {
    return NextResponse.json({ error: '상품을 찾을 수 없습니다' }, { status: 404 })
  }

  // ── 2. 재고 합계 (창고별) ──────────────────────────
  const { data: inventoryRows } = await supabase
    .from('inventory')
    .select('quantity, warehouses(name)')
    .eq('product_id', product.id)

  const totalStock = (inventoryRows ?? []).reduce((s: number, r: any) => s + (r.quantity ?? 0), 0)
  const stockByWarehouse = (inventoryRows ?? [])
    .filter((r: any) => r.quantity > 0)
    .map((r: any) => ({
      warehouse: r.warehouses?.name ?? '알 수 없음',
      quantity: r.quantity ?? 0,
    }))

  // ── 3. 최근 판매 10건 ─────────────────────────────
  const { data: recentSales } = await supabase
    .from('slip_items')
    .select('quantity, unit_price, created_at, slips(slip_date, slip_type, partners(name), warehouses(name))')
    .eq('product_id', product.id)
    .order('created_at', { ascending: false })
    .limit(10)

  const sales = (recentSales ?? [])
    .filter((s: any) => s.slips?.slip_type === 'sale')
    .map((s: any) => ({
      date:      s.slips?.slip_date ?? '',
      partner:   s.slips?.partners?.name ?? '-',
      warehouse: s.slips?.warehouses?.name ?? '-',
      quantity:  s.quantity,
      price:     s.unit_price,
      total:     s.quantity * s.unit_price,
    }))

  // ── 4. 최근 매입 5건 ─────────────────────────────
  const { data: recentPurchases } = await supabase
    .from('slip_items')
    .select('quantity, unit_price, created_at, slips(slip_date, slip_type, partners(name))')
    .eq('product_id', product.id)
    .order('created_at', { ascending: false })
    .limit(20)

  const purchases = (recentPurchases ?? [])
    .filter((s: any) => s.slips?.slip_type === 'purchase')
    .slice(0, 5)
    .map((s: any) => ({
      date:    s.slips?.slip_date ?? '',
      partner: s.slips?.partners?.name ?? '-',
      quantity: s.quantity,
      price:   s.unit_price,
      total:   s.quantity * s.unit_price,
    }))

  // ── 5. 월별 판매 추이 (최근 6개월) ────────────────
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
  const fromMonth = sixMonthsAgo.toISOString().slice(0, 7) + '-01'

  const { data: monthlySalesRaw } = await supabase
    .from('slip_items')
    .select('quantity, unit_price, slips(slip_date, slip_type)')
    .eq('product_id', product.id)
    .gte('created_at', fromMonth)

  const monthlyMap: Record<string, { qty: number; revenue: number }> = {}
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const key = d.toISOString().slice(0, 7)
    monthlyMap[key] = { qty: 0, revenue: 0 }
  }
  for (const row of (monthlySalesRaw ?? []) as any[]) {
    if (row.slips?.slip_type !== 'sale') continue
    const month = (row.slips?.slip_date ?? '').slice(0, 7)
    if (!monthlyMap[month]) continue
    monthlyMap[month].qty += row.quantity
    monthlyMap[month].revenue += row.quantity * row.unit_price
  }
  const monthlyTrend = Object.entries(monthlyMap).map(([month, v]) => ({
    month,
    label: month.slice(5) + '월',
    qty: v.qty,
    revenue: v.revenue,
  }))

  // ── 6. 거래처별 단가 ─────────────────────────────
  const { data: partnerPrices } = await supabase
    .from('partner_prices')
    .select('price, partners(name)')
    .eq('product_id', product.id)

  const prices = (partnerPrices ?? []).map((p: any) => ({
    partner: p.partners?.name ?? '-',
    price:   p.price,
  }))

  // ── 7. 반품 이력 ─────────────────────────────────
  const { data: returnRows } = await supabase
    .from('returns')
    .select('quantity, reason, status, created_at, partners(name)')
    .eq('product_id', product.id)
    .order('created_at', { ascending: false })
    .limit(5)

  const returns = (returnRows ?? []).map((r: any) => ({
    date:     r.created_at?.slice(0, 10) ?? '',
    partner:  r.partners?.name ?? '-',
    quantity: r.quantity,
    reason:   r.reason ?? '-',
    status:   r.status,
  }))

  // ── 8. 통계 요약 ──────────────────────────────────
  const totalSalesQty = monthlyTrend.reduce((s, m) => s + m.qty, 0)
  const totalRevenue  = monthlyTrend.reduce((s, m) => s + m.revenue, 0)
  const margin = product.sell_price > 0
    ? Math.round(((product.sell_price - product.buy_price) / product.sell_price) * 100)
    : 0
  const avgMonthlySales = Math.round(totalSalesQty / 6)

  return NextResponse.json({
    product,
    totalStock,
    stockByWarehouse,
    recentSales: sales,
    recentPurchases: purchases,
    monthlyTrend,
    partnerPrices: prices,
    returns,
    margin,
    summary: {
      totalSalesQty,
      totalRevenue,
      avgMonthlySales,
    },
  })
}
