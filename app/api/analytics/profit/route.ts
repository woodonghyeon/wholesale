export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export interface ProfitByProduct {
  product_id: string
  product_name: string
  category: string | null
  total_qty: number
  total_revenue: number  // 판매 금액 합계
  total_cost: number     // 매입가 * 수량 합계
  total_profit: number
  margin_rate: number    // 이익률 %
}

export interface ProfitByPartner {
  partner_id: string
  partner_name: string
  total_revenue: number
  total_cost: number
  total_profit: number
  margin_rate: number
  order_count: number
}

export interface ProfitResponse {
  success: boolean
  byProduct: ProfitByProduct[]
  byPartner: ProfitByPartner[]
  summary: {
    totalRevenue: number
    totalCost: number
    totalProfit: number
    marginRate: number
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const businessId = searchParams.get('businessId') ?? undefined
  const from = searchParams.get('from') ?? new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10)
  const to = searchParams.get('to') ?? new Date().toISOString().slice(0, 10)

  const supabase = adminClient()

  // 매출 전표 + 품목 + 상품 매입가 조회
  let q = supabase
    .from('slips')
    .select(`
      id,
      partner_id,
      partners ( name ),
      slip_items (
        product_id,
        product_name,
        quantity,
        unit_price,
        supply_amount,
        products ( buy_price, category )
      )
    `)
    .eq('slip_type', 'sale')
    .gte('slip_date', from)
    .lte('slip_date', to)

  if (businessId && businessId !== 'all') {
    q = q.eq('business_id', businessId)
  }

  const { data: slips, error } = await q
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

  // 품목별 집계
  const productMap = new Map<string, ProfitByProduct>()
  // 거래처별 집계
  const partnerMap = new Map<string, ProfitByPartner>()

  for (const slip of (slips ?? []) as any[]) {
    const partnerId = slip.partner_id ?? 'unknown'
    const partnerName = slip.partners?.name ?? '미분류'

    if (!partnerMap.has(partnerId)) {
      partnerMap.set(partnerId, {
        partner_id: partnerId,
        partner_name: partnerName,
        total_revenue: 0,
        total_cost: 0,
        total_profit: 0,
        margin_rate: 0,
        order_count: 0,
      })
    }
    const partnerRow = partnerMap.get(partnerId)!
    partnerRow.order_count++

    for (const item of (slip.slip_items ?? []) as any[]) {
      const pid = item.product_id ?? 'unknown'
      const pname = item.product_name ?? '미분류'
      const qty = item.quantity ?? 0
      const unitPrice = item.unit_price ?? 0
      const buyPrice = item.products?.buy_price ?? 0
      const category = item.products?.category ?? null

      const revenue = (item.supply_amount ?? unitPrice * qty)
      const cost = buyPrice * qty
      const profit = revenue - cost

      // 품목별
      if (!productMap.has(pid)) {
        productMap.set(pid, {
          product_id: pid,
          product_name: pname,
          category,
          total_qty: 0,
          total_revenue: 0,
          total_cost: 0,
          total_profit: 0,
          margin_rate: 0,
        })
      }
      const prodRow = productMap.get(pid)!
      prodRow.total_qty += qty
      prodRow.total_revenue += revenue
      prodRow.total_cost += cost
      prodRow.total_profit += profit

      // 거래처별
      partnerRow.total_revenue += revenue
      partnerRow.total_cost += cost
      partnerRow.total_profit += profit
    }
  }

  // 이익률 계산
  const byProduct = Array.from(productMap.values()).map(p => ({
    ...p,
    margin_rate: p.total_revenue > 0 ? Math.round((p.total_profit / p.total_revenue) * 1000) / 10 : 0,
  })).sort((a, b) => b.total_profit - a.total_profit)

  const byPartner = Array.from(partnerMap.values()).map(p => ({
    ...p,
    margin_rate: p.total_revenue > 0 ? Math.round((p.total_profit / p.total_revenue) * 1000) / 10 : 0,
  })).sort((a, b) => b.total_profit - a.total_profit)

  const totalRevenue = byProduct.reduce((s, p) => s + p.total_revenue, 0)
  const totalCost = byProduct.reduce((s, p) => s + p.total_cost, 0)
  const totalProfit = totalRevenue - totalCost

  return NextResponse.json({
    success: true,
    byProduct,
    byPartner,
    summary: {
      totalRevenue,
      totalCost,
      totalProfit,
      marginRate: totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 1000) / 10 : 0,
    },
  } satisfies ProfitResponse)
}
