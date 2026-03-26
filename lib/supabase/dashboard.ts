import { createClient } from './client'

export interface DashboardStats {
  monthSales: number
  monthPurchase: number
  monthProfit: number
  totalInventoryValue: number
  lowStockCount: number
  unpaidReceivable: number
  unpaidPayable: number
  recentSlips: {
    id: string
    slip_date: string
    slip_type: 'sale' | 'purchase'
    partner_name: string | null
    total_amount: number
  }[]
  monthlySalesTrend: { month: string; amount: number }[]
}

export async function getDashboardStats(businessId?: string): Promise<DashboardStats> {
  const supabase = createClient()
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const today = now.toISOString().slice(0, 10)

  const bizFilter = businessId && businessId !== 'all' ? businessId : null

  // 이번달 매출 / 매입
  const buildSlipQuery = (type: string) => {
    let q = supabase
      .from('slips')
      .select('total_amount, supply_amount, tax_amount')
      .eq('slip_type', type)
      .gte('slip_date', monthStart)
      .lte('slip_date', today)
    if (bizFilter) q = q.eq('business_id', bizFilter)
    return q
  }

  const [salesRes, purchaseRes, inventoryRes, recentRes] = await Promise.all([
    buildSlipQuery('sale'),
    buildSlipQuery('purchase'),
    (() => {
      let q = supabase.from('inventory').select('quantity, products(buy_price)')
      if (bizFilter) q = q.eq('business_id', bizFilter)
      return q
    })(),
    (() => {
      let q = supabase
        .from('slips')
        .select('id, slip_date, slip_type, total_amount, partners(name)')
        .order('created_at', { ascending: false })
        .limit(10)
      if (bizFilter) q = q.eq('business_id', bizFilter)
      return q
    })(),
  ])

  const monthSales = (salesRes.data ?? []).reduce((s: number, r: any) => s + r.total_amount, 0)
  const monthPurchase = (purchaseRes.data ?? []).reduce((s: number, r: any) => s + r.total_amount, 0)
  const monthProfit = monthSales - monthPurchase

  const totalInventoryValue = (inventoryRes.data ?? []).reduce(
    (s: number, r: any) => s + r.quantity * (r.products?.buy_price ?? 0), 0
  )

  // 부족 재고 건수 (DB 함수 없이 클라이언트 계산)
  const { data: invWithMin } = await (() => {
    let q = supabase.from('inventory').select('quantity, products(min_stock)')
    if (bizFilter) q = q.eq('business_id', bizFilter)
    return q
  })()
  const lowStockCount = (invWithMin ?? []).filter(
    (r: any) => r.products?.min_stock > 0 && r.quantity <= r.products.min_stock
  ).length

  // 월별 매출 추이 (최근 6개월)
  const months: { month: string; amount: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    const to = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${lastDay}`
    let q = supabase.from('slips').select('total_amount').eq('slip_type', 'sale').gte('slip_date', from).lte('slip_date', to)
    if (bizFilter) q = q.eq('business_id', bizFilter)
    const { data } = await q
    months.push({
      month: `${d.getMonth() + 1}월`,
      amount: (data ?? []).reduce((s: number, r: any) => s + r.total_amount, 0)
    })
  }

  const recentSlips = (recentRes.data ?? []).map((r: any) => ({
    id: r.id,
    slip_date: r.slip_date,
    slip_type: r.slip_type,
    partner_name: r.partners?.name ?? null,
    total_amount: r.total_amount,
  }))

  return {
    monthSales, monthPurchase, monthProfit,
    totalInventoryValue, lowStockCount,
    unpaidReceivable: 0, unpaidPayable: 0, // payments 테이블 구현 후 연동
    recentSlips,
    monthlySalesTrend: months,
  }
}
