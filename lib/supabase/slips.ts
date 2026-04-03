import { createClient } from '@/lib/supabase/client'
import type { Slip, SlipItem, SlipType, PaymentType } from '@/lib/types'

export interface SlipFormData {
  slip_type: SlipType
  business_id: string
  partner_id?: string
  channel_id?: string
  warehouse_id?: string
  slip_date: string
  payment_type: PaymentType
  memo?: string
  items: SlipItemFormData[]
}

export interface SlipItemFormData {
  product_id: string
  quantity: number
  unit_price: number
}

export interface SlipFilter {
  businessId: string
  slipType?: SlipType
  dateFrom?: string
  dateTo?: string
  partnerId?: string
  keyword?: string
}

function calcAmounts(items: SlipItemFormData[]) {
  const supply = items.reduce((s, i) => s + i.quantity * i.unit_price, 0)
  const tax = Math.round(supply * 0.1)
  return { supply_amount: supply, tax_amount: tax, total_amount: supply + tax }
}

export async function fetchSlips(filter: SlipFilter): Promise<Slip[]> {
  const supabase = createClient()
  let query = supabase
    .from('slips')
    .select(`
      *,
      partners(id, name),
      channels(id, name),
      warehouses(id, name),
      businesses(id, name)
    `)
    .order('slip_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (filter.businessId !== 'all') {
    query = query.eq('business_id', filter.businessId)
  }
  if (filter.slipType) {
    query = query.eq('slip_type', filter.slipType)
  }
  if (filter.dateFrom) {
    query = query.gte('slip_date', filter.dateFrom)
  }
  if (filter.dateTo) {
    query = query.lte('slip_date', filter.dateTo)
  }
  if (filter.partnerId) {
    query = query.eq('partner_id', filter.partnerId)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Slip[]
}

export async function fetchSlipWithItems(slipId: string): Promise<Slip | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('slips')
    .select(`
      *,
      partners(id, name, phone, business_no),
      channels(id, name),
      warehouses(id, name),
      businesses(id, name),
      slip_items(
        *,
        products(id, name, unit, buy_price)
      )
    `)
    .eq('id', slipId)
    .single()

  if (error) throw error
  return data as Slip | null
}

export async function createSlip(form: SlipFormData): Promise<string> {
  const supabase = createClient()
  const { supply_amount, tax_amount, total_amount } = calcAmounts(form.items)

  // slip_no 생성: YYYYMMDD-XXX
  const prefix = form.slip_type === 'sale' ? 'S' : 'P'
  const today = form.slip_date.replace(/-/g, '')
  const { count } = await supabase
    .from('slips')
    .select('id', { count: 'exact', head: true })
    .like('slip_no', `${prefix}${today}%`)
  const seq = String((count ?? 0) + 1).padStart(3, '0')
  const slip_no = `${prefix}${today}-${seq}`

  const { data: slip, error: slipErr } = await supabase
    .from('slips')
    .insert({
      slip_no,
      slip_type: form.slip_type,
      business_id: form.business_id,
      partner_id: form.partner_id || null,
      channel_id: form.channel_id || null,
      warehouse_id: form.warehouse_id || null,
      slip_date: form.slip_date,
      payment_type: form.payment_type,
      supply_amount,
      tax_amount,
      total_amount,
      paid_amount: form.payment_type === 'cash' ? total_amount : 0,
      memo: form.memo || null,
      tax_invoice_issued: false,
    })
    .select('id')
    .single()

  if (slipErr) throw slipErr

  const slipId = slip.id
  const itemRows = form.items.map((i) => ({
    slip_id: slipId,
    product_id: i.product_id,
    quantity: i.quantity,
    unit_price: i.unit_price,
    supply_amount: i.quantity * i.unit_price,
    tax_amount: Math.round(i.quantity * i.unit_price * 0.1),
  }))

  const { error: itemErr } = await supabase.from('slip_items').insert(itemRows)
  if (itemErr) throw itemErr

  // 재고 조정
  for (const i of form.items) {
    const delta = form.slip_type === 'sale' ? -i.quantity : i.quantity
    await supabase.rpc('adjust_inventory', {
      p_product_id: i.product_id,
      p_business_id: form.business_id,
      p_warehouse_id: form.warehouse_id ?? null,
      p_quantity: delta,
      p_note: `전표 ${slip_no}`,
    })
  }

  return slipId
}

export async function deleteSlip(slipId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('slips').delete().eq('id', slipId)
  if (error) throw error
}
