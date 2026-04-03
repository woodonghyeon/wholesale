import { createClient } from '@/lib/supabase/client'

export interface PurchaseFilter {
  businessId: string
  dateFrom?: string
  dateTo?: string
  partnerId?: string
  paymentType?: string
}

export interface PurchaseKPI {
  totalPurchase: number
  slipCount: number
  supplyAmount: number
  unpaid: number
}

export interface PartnerPurchase {
  partnerId: string
  partnerName: string
  amount: number
  count: number
}

export interface MonthlyPurchase {
  month: string
  amount: number
}

export interface PurchaseSlip {
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

export async function fetchPurchaseKPI(filter: PurchaseFilter): Promise<PurchaseKPI> {
  const supabase = createClient()
  let query = supabase
    .from('slips')
    .select('supply_amount, total_amount, paid_amount')
    .eq('slip_type', 'purchase')

  if (filter.businessId !== 'all') query = query.eq('business_id', filter.businessId)
  if (filter.dateFrom) query = query.gte('slip_date', filter.dateFrom)
  if (filter.dateTo) query = query.lte('slip_date', filter.dateTo)
  if (filter.partnerId) query = query.eq('partner_id', filter.partnerId)
  if (filter.paymentType) query = query.eq('payment_type', filter.paymentType)

  const { data, error } = await query
  if (error) throw error

  const rows = data ?? []
  return {
    totalPurchase: rows.reduce((s, r) => s + r.total_amount, 0),
    slipCount: rows.length,
    supplyAmount: rows.reduce((s, r) => s + r.supply_amount, 0),
    unpaid: rows.reduce((s, r) => s + (r.total_amount - r.paid_amount), 0),
  }
}

export async function fetchMonthlyPurchases(businessId: string, months = 6): Promise<MonthlyPurchase[]> {
  const supabase = createClient()
  const now = new Date()
  const result: MonthlyPurchase[] = []

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10)

    let q = supabase
      .from('slips')
      .select('total_amount')
      .eq('slip_type', 'purchase')
      .gte('slip_date', start)
      .lte('slip_date', end)
    if (businessId !== 'all') q = q.eq('business_id', businessId)

    const { data } = await q
    result.push({
      month: `${d.getMonth() + 1}월`,
      amount: (data ?? []).reduce((s, r) => s + r.total_amount, 0),
    })
  }
  return result
}

export async function fetchPartnerPurchases(filter: PurchaseFilter): Promise<PartnerPurchase[]> {
  const supabase = createClient()
  let query = supabase
    .from('slips')
    .select('total_amount, partners(id, name)')
    .eq('slip_type', 'purchase')
    .not('partner_id', 'is', null)

  if (filter.businessId !== 'all') query = query.eq('business_id', filter.businessId)
  if (filter.dateFrom) query = query.gte('slip_date', filter.dateFrom)
  if (filter.dateTo) query = query.lte('slip_date', filter.dateTo)
  if (filter.paymentType) query = query.eq('payment_type', filter.paymentType)

  const { data, error } = await query
  if (error) throw error

  const map = new Map<string, PartnerPurchase>()
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

export async function fetchPurchaseSlips(filter: PurchaseFilter): Promise<PurchaseSlip[]> {
  const supabase = createClient()
  let query = supabase
    .from('slips')
    .select('id, slip_no, slip_date, payment_type, supply_amount, tax_amount, total_amount, paid_amount, partners(id, name), channels(id, name)')
    .eq('slip_type', 'purchase')
    .order('slip_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (filter.businessId !== 'all') query = query.eq('business_id', filter.businessId)
  if (filter.dateFrom) query = query.gte('slip_date', filter.dateFrom)
  if (filter.dateTo) query = query.lte('slip_date', filter.dateTo)
  if (filter.partnerId) query = query.eq('partner_id', filter.partnerId)
  if (filter.paymentType) query = query.eq('payment_type', filter.paymentType)

  const { data, error } = await query
  if (error) throw error

  return (data ?? []).map(r => ({
    ...r,
    partner: (r.partners as any) ?? null,
    channel: (r.channels as any) ?? null,
  }))
}
