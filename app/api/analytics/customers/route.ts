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
 * GET /api/analytics/customers?days=90
 * 재구매 고객 분석: 주문자 전화번호 기준 집계
 */
export async function GET(req: NextRequest) {
  const days = Number(req.nextUrl.searchParams.get('days') ?? '90')

  try {
    const supabase = adminClient()

    // 네이버 주문 집계
    const [recent, older] = await Promise.all([
      getNaverOrdersLastHours(24),
      getNaverOrders(Math.min(days, 90)), // API max ~90일
    ])
    const orderMap = new Map(older.map(o => [o.productOrderId, o]))
    recent.forEach(o => orderMap.set(o.productOrderId, o))
    const orders = Array.from(orderMap.values())

    const CANCEL = new Set(['CANCELED', 'CANCEL_REQUEST', 'RETURNED', 'RETURN_REQUEST'])
    const active = orders.filter(o => !CANCEL.has(o.productOrderStatus))

    // 전화번호 기준 집계
    const customerMap = new Map<string, {
      name:         string
      tel:          string
      orderCount:   number
      totalAmount:  number
      lastOrderDate: string
      products:     Map<string, number>
    }>()

    for (const o of active) {
      const tel = (o.ordererTel ?? '').replace(/[^0-9]/g, '')
      if (!tel) continue

      const prev = customerMap.get(tel) ?? {
        name:          o.ordererName,
        tel,
        orderCount:    0,
        totalAmount:   0,
        lastOrderDate: '',
        products:      new Map(),
      }

      prev.orderCount++
      prev.totalAmount += o.totalPaymentAmount
      const d = (o.paymentDate ?? o.orderDate ?? '').slice(0, 10)
      if (d > prev.lastOrderDate) prev.lastOrderDate = d
      prev.products.set(o.productName, (prev.products.get(o.productName) ?? 0) + 1)
      customerMap.set(tel, prev)
    }

    // partners 테이블과 조인 (파트너 ID 매핑)
    const { data: partners } = await supabase
      .from('partners')
      .select('id, phone, name, partner_type')
      .eq('partner_type', 'customer')

    const phoneToPartnerId = new Map<string, string>()
    for (const p of partners ?? []) {
      if (p.phone) phoneToPartnerId.set(p.phone.replace(/[^0-9]/g, ''), p.id)
    }

    const customers = Array.from(customerMap.values()).map(c => {
      const topProducts = Array.from(c.products.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name]) => name)

      return {
        tel:           c.tel,
        name:          c.name,
        orderCount:    c.orderCount,
        totalAmount:   c.totalAmount,
        avgAmount:     Math.round(c.totalAmount / c.orderCount),
        lastOrderDate: c.lastOrderDate,
        isRepeat:      c.orderCount >= 2,
        partnerId:     phoneToPartnerId.get(c.tel) ?? null,
        topProducts,
        grade:         c.orderCount >= 5 ? 'VIP' : c.orderCount >= 2 ? '단골' : '신규',
      }
    }).sort((a, b) => b.totalAmount - a.totalAmount)

    const repeatCount  = customers.filter(c => c.isRepeat).length
    const vipCount     = customers.filter(c => c.grade === 'VIP').length
    const totalRevenue = customers.reduce((s, c) => s + c.totalAmount, 0)
    const repeatRevenue = customers.filter(c => c.isRepeat).reduce((s, c) => s + c.totalAmount, 0)

    return NextResponse.json({
      success: true,
      days,
      summary: {
        totalCustomers: customers.length,
        repeatCount,
        repeatRate:     customers.length > 0 ? Math.round((repeatCount / customers.length) * 100) : 0,
        vipCount,
        totalRevenue,
        repeatRevenue,
        repeatRevenueRate: totalRevenue > 0 ? Math.round((repeatRevenue / totalRevenue) * 100) : 0,
      },
      customers: customers.slice(0, 100), // 상위 100명
    })
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error }, { status: 500 })
  }
}
