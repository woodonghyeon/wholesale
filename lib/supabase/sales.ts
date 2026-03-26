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
      warehouses ( name )
    `)
    .eq('slip_type', 'sale')
    .order('slip_date', { ascending: false })

  if (businessId && businessId !== 'all') query = query.eq('business_id', businessId)
  if (from) query = query.gte('slip_date', from)
  if (to) query = query.lte('slip_date', to)
  if (channelId && channelId !== 'all') query = query.eq('channel_id', channelId)

  const { data, error } = await query
  if (error) throw new Error('매출 조회 실패: ' + error.message)

  return (data ?? []).map((r: any) => ({
    slip_date: r.slip_date,
    slip_id: r.id,
    partner_name: r.partners?.name ?? null,
    channel_name: r.channels?.name ?? null,
    warehouse_name: r.warehouses?.name ?? null,
    payment_type: r.payment_type,
    supply_amount: r.supply_amount,
    tax_amount: r.tax_amount,
    total_amount: r.total_amount,
    is_tax_invoice: r.is_tax_invoice,
    memo: r.memo,
  }))
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
      products ( name, category ),
      slips!inner ( slip_type, slip_date, business_id )
    `)
    .eq('slips.slip_type', 'sale')

  if (from) query = query.gte('slips.slip_date', from)
  if (to) query = query.lte('slips.slip_date', to)
  if (businessId && businessId !== 'all') query = query.eq('slips.business_id', businessId)

  const { data, error } = await query
  if (error) throw new Error('상품별 매출 조회 실패: ' + error.message)

  // 상품별 집계
  const map = new Map<string, SalesByProduct>()
  for (const row of data ?? []) {
    const key = row.product_id ?? 'unknown'
    const existing = map.get(key)
    const supply = row.supply_amount ?? row.quantity * row.unit_price
    if (existing) {
      existing.total_quantity += row.quantity
      existing.total_supply += supply
      existing.total_amount += supply
    } else {
      map.set(key, {
        product_id: key,
        product_name: (row as any).products?.name ?? '(직접입력)',
        category: (row as any).products?.category ?? null,
        total_quantity: row.quantity,
        total_supply: supply,
        total_amount: supply,
      })
    }
  }

  return Array.from(map.values()).sort((a, b) => b.total_amount - a.total_amount)
}
