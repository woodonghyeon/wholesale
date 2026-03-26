import { createClient } from './client'

export interface LedgerRow {
  id: string
  slip_date: string
  slip_no: string | null
  slip_type: 'sale' | 'purchase'
  payment_type: string
  supply_amount: number
  tax_amount: number
  total_amount: number
  memo: string | null
  // 누계
  running_balance: number
}

export interface PartnerLedgerSummary {
  total_sale: number
  total_purchase: number
  net: number
}

export async function getPartnerLedger(
  partnerId: string,
  from?: string,
  to?: string
): Promise<{ rows: LedgerRow[]; summary: PartnerLedgerSummary }> {
  const supabase = createClient()
  let q = supabase
    .from('slips')
    .select('id, slip_date, slip_no, slip_type, payment_type, supply_amount, tax_amount, total_amount, memo')
    .eq('partner_id', partnerId)
    .order('slip_date', { ascending: true })
    .order('created_at', { ascending: true })

  if (from) q = q.gte('slip_date', from)
  if (to) q = q.lte('slip_date', to)

  const { data, error } = await q
  if (error) throw new Error(error.message)

  let balance = 0
  let total_sale = 0
  let total_purchase = 0

  const rows: LedgerRow[] = (data ?? []).map((r: any) => {
    // 매출은 미수금 증가(+), 매입은 미지급 증가(-)
    const signed = r.slip_type === 'sale' ? r.total_amount : -r.total_amount
    balance += signed
    if (r.slip_type === 'sale') total_sale += r.total_amount
    else total_purchase += r.total_amount
    return {
      id: r.id,
      slip_date: r.slip_date,
      slip_no: r.slip_no,
      slip_type: r.slip_type,
      payment_type: r.payment_type,
      supply_amount: r.supply_amount,
      tax_amount: r.tax_amount,
      total_amount: r.total_amount,
      memo: r.memo,
      running_balance: balance,
    }
  })

  return {
    rows: rows.reverse(), // 최신순 표시
    summary: { total_sale, total_purchase, net: total_sale - total_purchase },
  }
}
