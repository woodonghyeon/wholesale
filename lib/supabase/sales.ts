import { createClient } from './client'

export interface SalesSummaryRow {
  slip_date: string
  slip_id: string
  partner_name: string | null
  channel_name: string | null
  warehouse_name: string | null
  payment_type: string
  supply_amount: number
  tax_amount: number
  total_amount: number
  buy_amount: number        // 매입원가 합계
  profit_amount: number     // 이익 (공급가 - 원가)
  margin_rate: number       // 이익률 %
  is_tax_invoice: boolean
  memo: string | null
}

export interface SalesByProduct {
  product_id: string
  product_name: string
  category: string | null
  total_quantity: number
  total_supply: number
  total_amount: number
  buy_amount: number
  profit_amount: number
  margin_rate: number
}

export interface MonthlyTrendRow {
  month: string        // YYYY-MM
  label: string        // MM월
  revenue: number      // 합계(부가세포함)
  supply: number       // 공급가합계
  profit: number       // 이익
  count: number        // 전표 수
}

export async function getSalesSlips(
  businessId?: string,
  from?: string,
  to?: string,
  channelId?: string
): Promise<SalesSummaryRow[]> {
  const supabase = createClient()
  let query = supabase
    .from('slips')
    .select(`
      id, slip_date, payment_type, supply_amount, tax_amount, total_amount, is_tax_invoice, memo,
      partners ( name ),
      channels ( name ),
      warehouses ( name ),
      slip_items ( quantity, unit_price, supply_amount, products ( buy_price ) )
    `)
    .eq('slip_type', 'sale')
    .order('slip_date', { ascending: false })

  if (businessId && businessId !== 'all') query = query.eq('business_id', businessId)
  if (from) query = query.gte('slip_date', from)
  if (to) query = query.lte('slip_date', to)
  if (channelId && channelId !== 'all') query = query.eq('channel_id', channelId)

  const { data, error } = await query
  if (error) throw new Error('매출 조회 실패: ' + error.message)

  return (data ?? []).map((r: any) => {
    // 매입원가 = slip_items 각각의 buy_price * quantity (없으면 unit_price 기준 추정 불가→0)
    const buyAmount = (r.slip_items ?? []).reduce((s: number, item: any) => {
      const buyPrice = item.products?.buy_price ?? 0
      return s + buyPrice * (item.quantity ?? 0)
    }, 0)
    const profitAmount = r.supply_amount - buyAmount
    const marginRate = r.supply_amount > 0 && buyAmount > 0
      ? Math.round(profitAmount / r.supply_amount * 100)
      : 0

    return {
      slip_date: r.slip_date,
      slip_id: r.id,
      partner_name: r.partners?.name ?? null,
      channel_name: r.channels?.name ?? null,
      warehouse_name: r.warehouses?.name ?? null,
      payment_type: r.payment_type,
      supply_amount: r.supply_amount,
      tax_amount: r.tax_amount,
      total_amount: r.total_amount,
      buy_amount: buyAmount,
      profit_amount: profitAmount,
      margin_rate: marginRate,
      is_tax_invoice: r.is_tax_invoice,
      memo: r.memo,
    }
  })
}

export async function getSalesByProduct(
  businessId?: string,
  from?: string,
  to?: string
): Promise<SalesByProduct[]> {
  const supabase = createClient()
  let query = supabase
    .from('slip_items')
    .select(`
      product_id, quantity, unit_price, supply_amount,
      products ( name, category, buy_price ),
      slips!inner ( slip_type, slip_date, business_id )
    `)
    .eq('slips.slip_type', 'sale')

  if (from) query = query.gte('slips.slip_date', from)
  if (to) query = query.lte('slips.slip_date', to)
  if (businessId && businessId !== 'all') query = query.eq('slips.business_id', businessId)

  const { data, error } = await query
  if (error) throw new Error('상품별 매출 조회 실패: ' + error.message)

  const map = new Map<string, SalesByProduct>()
  for (const row of data ?? []) {
    const key = (row as any).product_id ?? 'unknown'
    const existing = map.get(key)
    const supply = (row as any).supply_amount ?? (row as any).quantity * (row as any).unit_price
    const buyPrice = (row as any).products?.buy_price ?? 0
    const buyCost = buyPrice * (row as any).quantity
    if (existing) {
      existing.total_quantity += (row as any).quantity
      existing.total_supply += supply
      existing.total_amount += supply
      existing.buy_amount += buyCost
      existing.profit_amount += supply - buyCost
    } else {
      map.set(key, {
        product_id: key,
        product_name: (row as any).products?.name ?? '(직접입력)',
        category: (row as any).products?.category ?? null,
        total_quantity: (row as any).quantity,
        total_supply: supply,
        total_amount: supply,
        buy_amount: buyCost,
        profit_amount: supply - buyCost,
        margin_rate: 0,
      })
    }
  }

  // margin_rate 최종 계산
  const result = Array.from(map.values()).map(p => ({
    ...p,
    margin_rate: p.total_supply > 0 && p.buy_amount > 0
      ? Math.round(p.profit_amount / p.total_supply * 100)
      : 0,
  }))

  return result.sort((a, b) => b.total_amount - a.total_amount)
}

export async function getSalesMonthlyTrend(
  businessId?: string,
  months: number = 6
): Promise<MonthlyTrendRow[]> {
  const supabase = createClient()

  // 6개월 키 미리 생성
  const map: Record<string, MonthlyTrendRow> = {}
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    const key = d.toISOString().slice(0, 7)
    map[key] = {
      month: key,
      label: key.slice(5) + '월',
      revenue: 0,
      supply: 0,
      profit: 0,
      count: 0,
    }
  }

  const fromDate = Object.keys(map)[0] + '-01'

  let query = supabase
    .from('slips')
    .select(`
      slip_date, supply_amount, tax_amount, total_amount,
      slip_items ( quantity, unit_price, supply_amount, products ( buy_price ) )
    `)
    .eq('slip_type', 'sale')
    .gte('slip_date', fromDate)

  if (businessId && businessId !== 'all') query = query.eq('business_id', businessId)

  const { data, error } = await query
  if (error) throw new Error('월별 추이 조회 실패: ' + error.message)

  for (const slip of data ?? []) {
    const month = (slip as any).slip_date?.slice(0, 7)
    if (!map[month]) continue

    const buyAmount = ((slip as any).slip_items ?? []).reduce((s: number, item: any) => {
      return s + (item.products?.buy_price ?? 0) * (item.quantity ?? 0)
    }, 0)

    map[month].revenue += (slip as any).total_amount ?? 0
    map[month].supply += (slip as any).supply_amount ?? 0
    map[month].profit += ((slip as any).supply_amount ?? 0) - buyAmount
    map[month].count += 1
  }

  return Object.values(map)
}
