import { createClient } from './client'
import { Slip, SlipItem, SlipType } from '@/lib/types'

export interface SlipWithItems extends Slip {
  items: SlipItem[]
  partner_name?: string
  warehouse_name?: string
  channel_name?: string
}

export async function getSlips(
  type: SlipType,
  businessId?: string,
  from?: string,
  to?: string
): Promise<SlipWithItems[]> {
  const supabase = createClient()
  let query = supabase
    .from('slips')
    .select(`
      *,
      partners ( name ),
      warehouses ( name ),
      channels ( name ),
      slip_items ( * )
    `)
    .eq('slip_type', type)
    .order('slip_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (businessId && businessId !== 'all') query = query.eq('business_id', businessId)
  if (from) query = query.gte('slip_date', from)
  if (to) query = query.lte('slip_date', to)

  const { data, error } = await query
  if (error) throw new Error('전표 조회 실패: ' + error.message)

  return (data ?? []).map((row: any) => ({
    ...row,
    items: row.slip_items ?? [],
    partner_name: row.partners?.name ?? null,
    warehouse_name: row.warehouses?.name ?? null,
    channel_name: row.channels?.name ?? null,
  }))
}

export async function createSlip(
  slip: Omit<Slip, 'id' | 'slip_no' | 'created_at'>,
  items: Omit<SlipItem, 'id' | 'slip_id'>[]
): Promise<SlipWithItems> {
  const supabase = createClient()

  // 전표 생성
  const { data: slipData, error: slipErr } = await supabase
    .from('slips')
    .insert(slip)
    .select()
    .single()
  if (slipErr) throw new Error('전표 생성 실패: ' + slipErr.message)

  // 품목 삽입
  if (items.length > 0) {
    const { error: itemErr } = await supabase
      .from('slip_items')
      .insert(items.map((item, i) => ({ ...item, slip_id: slipData.id, sort_order: i })))
    if (itemErr) throw new Error('품목 저장 실패: ' + itemErr.message)
  }

  return { ...slipData, items }
}

export async function deleteSlip(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('slips').delete().eq('id', id)
  if (error) throw new Error('전표 삭제 실패: ' + error.message)
}

export async function getSlipDetail(id: string): Promise<SlipWithItems> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('slips')
    .select(`
      *,
      partners ( name ),
      warehouses ( name ),
      channels ( name ),
      slip_items ( * )
    `)
    .eq('id', id)
    .single()
  if (error) throw new Error('전표 조회 실패: ' + error.message)
  return {
    ...data,
    items: data.slip_items ?? [],
    partner_name: data.partners?.name ?? null,
    warehouse_name: data.warehouses?.name ?? null,
    channel_name: data.channels?.name ?? null,
  }
}
