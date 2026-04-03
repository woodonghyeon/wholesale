import { createClient } from '@/lib/supabase/client'

export interface SalesFilter {
  businessId: string
  dateFrom?: string
  dateTo?: string
  partnerId?: string
  channelId?: string
  paymentType?: string
}

export interface SalesKPI {
  totalSales: number
  slipCount: number
  supplyAmount: number
  unpaid: number
}

export interface MonthlySales {
  month: string
  sales: number
  purchase: number
}

export interface PartnerSales {
  partnerId: string
  partnerName: string
  amount: number
  count: number
}

export interface ChannelSales {
  channelId: string
  channelName: string
  amount: number
  count: number
}

export interface SalesSlip {
  id: string
  slip_no: string
  slip_date: string
  payment_type: string
  supply_amount: number
  tax_amount: number
  total_amount: number
  paid_amount: number
  partner: { id: string; name: string } | null
  channel: { id: string; name: string } | null
}

export async function fetchSalesKPI(filter: SalesFilter): Promise<SalesKPI> {
  const supabase = createClient()
  let query = supabase
    .from('slips')
    .select('supply_amount, total_amount, paid_amount')
    .eq('slip_type', 'sale')

  if (filter.businessId !== 'all') query = query.eq('business_id', filter.businessId)
  if (filter.dateFrom) query = query.gte('slip_date', filter.dateFrom)
  if (filter.dateTo) query = query.lte('slip_date', filter.dateTo)
  if (filter.partnerId) query = query.eq('partner_id', filter.partnerId)
  if (filter.channelId) query = query.eq('channel_id', filter.channelId)
  if (filter.paymentType) query = query.eq('payment_type', filter.paymentType)

  const { data, error } = await query
  if (error) throw error

  const rows = data ?? []
  return {
    totalSales: rows.reduce((s, r) => s + r.total_amount, 0),
    slipCount: rows.length,
    supplyAmount: rows.reduce((s, r) => s + r.supply_amount, 0),
    unpaid: rows.reduce((s, r) => s + (r.total_amount - r.paid_amount), 0),
  }
}

export async function fetchMonthlySales(businessId: string, months = 6): Promise<MonthlySales[]> {
  const supabase = createClient()
  const now = new Date()
  const result: MonthlySales[] = []

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10)
    const label = `${d.getMonth() + 1}월`

    let q = supabase
      .from('slips')
      .select('slip_type, total_amount')
      .gte('slip_date', start)
      .lte('slip_date', end)
    if (businessId !== 'all') q = q.eq('business_id', businessId)

    const { data } = await q
    const rows = data ?? []
    result.push({
      month: label,
      sales: rows.filter(r => r.slip_type === 'sale').reduce((s, r) => s + r.total_amount, 0),
      purchase: rows.filter(r => r.slip_type === 'purchase').reduce((s, r) => s + r.total_amount, 0),
    })
  }
  return result
}

export async function fetchPartnerSales(filter: SalesFilter): Promise<PartnerSales[]> {
  const supabase = createClient()
  let query = supabase
    .from('slips')
    .select('total_amount, partners(id, name)')
    .eq('slip_type', 'sale')
    .not('partner_id', 'is', null)

  if (filter.businessId !== 'all') query = query.eq('business_id', filter.businessId)
  if (filter.dateFrom) query = query.gte('slip_date', filter.dateFrom)
  if (filter.dateTo) query = query.lte('slip_date', filter.dateTo)
  if (filter.channelId) query = query.eq('channel_id', filter.channelId)
  if (filter.paymentType) query = query.eq('payment_type', filter.paymentType)

  const { data, error } = await query
  if (error) throw error

  const map = new Map<string, PartnerSales>()
  for (const row of data ?? []) {
    const p = (row.partners as any)
    if (!p) continue
    const existing = map.get(p.id)
    if (existing) {
      existing.amount += row.total_amount
      existing.count += 1
    } else {
      map.set(p.id, { partnerId: p.id, partnerName: p.name, amount: row.total_amount, count: 1 })
    }
  }
  return Array.from(map.values()).sort((a, b) => b.amount - a.amount)
}

export async function fetchChannelSalesAgg(filter: SalesFilter): Promise<ChannelSales[]> {
  const supabase = createClient()
  let query = supabase
    .from('slips')
    .select('total_amount, channels(id, name)')
    .eq('slip_type', 'sale')
    .not('channel_id', 'is', null)

  if (filter.businessId !== 'all') query = query.eq('business_id', filter.businessId)
  if (filter.dateFrom) query = query.gte('slip_date', filter.dateFrom)
  if (filter.dateTo) query = query.lte('slip_date', filter.dateTo)
  if (filter.partnerId) query = query.eq('partner_id', filter.partnerId)
  if (filter.paymentType) query = query.eq('payment_type', filter.paymentType)

  const { data, error } = await query
  if (error) throw error

  const map = new Map<string, ChannelSales>()
  for (const row of data ?? []) {
    const c = (row.channels as any)
    if (!c) continue
    const existing = map.get(c.id)
    if (existing) {
      existing.amount += row.total_amount
      existing.count += 1
    } else {
      map.set(c.id, { channelId: c.id, channelName: c.name, amount: row.total_amount, count: 1 })
    }
  }
  return Array.from(map.values()).sort((a, b) => b.amount - a.amount)
}

export interface ChannelMonthlyBreakdown {
  months: string[]
  series: { channelId: string; channelName: string; data: number[] }[]
}

export async function fetchChannelMonthlyBreakdown(
  businessId: string,
  months = 6
): Promise<ChannelMonthlyBreakdown> {
  const supabase = createClient()
  const now = new Date()
  const monthLabels: string[] = []
  const monthKeys: string[] = []

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    monthLabels.push(`${d.getMonth() + 1}월`)
    monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const dateFrom = `${monthKeys[0]}-01`
  const lastKey = monthKeys[monthKeys.length - 1]
  const lastYear = parseInt(lastKey.slice(0, 4))
  const lastMonth = parseInt(lastKey.slice(5, 7))
  const dateTo = new Date(lastYear, lastMonth, 0).toISOString().slice(0, 10)

  let q = supabase
    .from('slips')
    .select('slip_date, total_amount, channels(id, name)')
    .eq('slip_type', 'sale')
    .not('channel_id', 'is', null)
    .gte('slip_date', dateFrom)
    .lte('slip_date', dateTo)
  if (businessId !== 'all') q = q.eq('business_id', businessId)

  const { data, error } = await q
  if (error) throw error

  const channelMap = new Map<string, { name: string; monthData: number[] }>()
  for (const row of data ?? []) {
    const c = (row.channels as any)
    if (!c) continue
    if (!channelMap.has(c.id)) {
      channelMap.set(c.id, { name: c.name, monthData: new Array(months).fill(0) })
    }
    const slipMonthKey = row.slip_date.slice(0, 7)
    const idx = monthKeys.indexOf(slipMonthKey)
    if (idx >= 0) {
      channelMap.get(c.id)!.monthData[idx] += row.total_amount
    }
  }

  return {
    months: monthLabels,
    series: Array.from(channelMap.entries()).map(([id, v]) => ({
      channelId: id,
      channelName: v.name,
      data: v.monthData,
    })),
  }
}

export async function fetchSalesSlips(filter: SalesFilter): Promise<SalesSlip[]> {
  const supabase = createClient()
  let query = supabase
    .from('slips')
    .select('id, slip_no, slip_date, payment_type, supply_amount, tax_amount, total_amount, paid_amount, partners(id, name), channels(id, name)')
    .eq('slip_type', 'sale')
    .order('slip_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (filter.businessId !== 'all') query = query.eq('business_id', filter.businessId)
  if (filter.dateFrom) query = query.gte('slip_date', filter.dateFrom)
  if (filter.dateTo) query = query.lte('slip_date', filter.dateTo)
  if (filter.partnerId) query = query.eq('partner_id', filter.partnerId)
  if (filter.channelId) query = query.eq('channel_id', filter.channelId)
  if (filter.paymentType) query = query.eq('payment_type', filter.paymentType)

  const { data, error } = await query
  if (error) throw error

  return (data ?? []).map(r => ({
    ...r,
    partner: (r.partners as any) ?? null,
    channel: (r.channels as any) ?? null,
  }))
}
