import { createClient } from './client'
import { Payment } from '../types'
import { logActivity } from './logs'

export type PaymentRow = Payment & { partner_name?: string }

export async function getPayments(opts: {
  businessId?: string
  partnerId?: string
  paymentType?: string
  from?: string
  to?: string
} = {}) {
  const supabase = createClient()
  let q = supabase.from('payments').select('*, partners(name)').order('payment_date', { ascending: false })
  if (opts.businessId) q = q.eq('business_id', opts.businessId)
  if (opts.partnerId) q = q.eq('partner_id', opts.partnerId)
  if (opts.paymentType) q = q.eq('payment_type', opts.paymentType)
  if (opts.from) q = q.gte('payment_date', opts.from)
  if (opts.to) q = q.lte('payment_date', opts.to)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []).map((r: any) => ({ ...r, partner_name: r.partners?.name ?? null })) as PaymentRow[]
}

export interface BalanceSummary {
  partner_id: string
  partner_name: string
  partner_type: string
  receivable: number
  payable: number
}

export async function getBalanceSummary(businessId?: string): Promise<BalanceSummary[]> {
  const supabase = createClient()

  const [{ data: slips }, { data: pays }, { data: partners }] = await Promise.all([
    (() => {
      let q = supabase.from('slips').select('partner_id, slip_type, total_amount, cash_amount')
      if (businessId) q = q.eq('business_id', businessId)
      return q
    })(),
    (() => {
      let q = supabase.from('payments').select('partner_id, payment_type, amount')
      if (businessId) q = q.eq('business_id', businessId)
      return q
    })(),
    supabase.from('partners').select('id, name, partner_type'),
  ])

  const map: Record<string, { receivable: number; payable: number }> = {}

  for (const s of slips ?? []) {
    if (!s.partner_id) continue
    if (!map[s.partner_id]) map[s.partner_id] = { receivable: 0, payable: 0 }
    const credit = s.total_amount - s.cash_amount
    if (s.slip_type === 'sale') map[s.partner_id].receivable += credit
    if (s.slip_type === 'purchase') map[s.partner_id].payable += credit
  }

  for (const p of pays ?? []) {
    if (!p.partner_id) continue
    if (!map[p.partner_id]) map[p.partner_id] = { receivable: 0, payable: 0 }
    if (p.payment_type === 'receive') map[p.partner_id].receivable -= p.amount
    if (p.payment_type === 'pay') map[p.partner_id].payable -= p.amount
  }

  return (partners ?? [])
    .map((pt: any) => ({
      partner_id: pt.id,
      partner_name: pt.name,
      partner_type: pt.partner_type,
      receivable: map[pt.id]?.receivable ?? 0,
      payable: map[pt.id]?.payable ?? 0,
    }))
    .filter((r) => r.receivable !== 0 || r.payable !== 0)
    .sort((a, b) => b.receivable + b.payable - (a.receivable + a.payable))
}

export async function upsertPayment(payment: Partial<Payment>) {
  const supabase = createClient()
  const isNew = !payment.id
  const { error } = await supabase.from('payments').upsert(payment)
  if (error) throw new Error(error.message)
  logActivity({ action_type: isNew ? 'create' : 'update', resource_type: 'payment', resource_id: payment.id ?? '', description: `${payment.payment_type === 'receive' ? '수금' : '지급'} ${isNew ? '등록' : '수정'}: ${(payment.amount ?? 0).toLocaleString()}원`, metadata: { payment_type: payment.payment_type, amount: payment.amount, payment_method: payment.payment_method } })
}

export async function deletePayment(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from('payments').delete().eq('id', id)
  if (error) throw new Error(error.message)
  logActivity({ action_type: 'delete', resource_type: 'payment', resource_id: id, description: `수금/지급 삭제: ${id.slice(0, 8)}` })
}
