import { createClient } from './client'
import { Return, ReturnReason, ReturnDisposition, ReturnStatus } from '@/lib/types'

export interface ReturnRow extends Return {
  partner_name?: string
  product_name?: string
}

export async function getReturns(businessId?: string): Promise<ReturnRow[]> {
  const supabase = createClient()
  let query = supabase
    .from('returns')
    .select('*, partners(name), products(name)')
    .order('created_at', { ascending: false })
  if (businessId && businessId !== 'all') query = query.eq('business_id', businessId)
  const { data, error } = await query
  if (error) throw new Error('반품 조회 실패: ' + error.message)
  return (data ?? []).map((r: any) => ({
    ...r,
    partner_name: r.partners?.name ?? null,
    product_name: r.products?.name ?? null,
  }))
}

export async function upsertReturn(entry: Partial<Return> & { business_id: string }): Promise<Return> {
  const supabase = createClient()
  const { data, error } = await supabase.from('returns').upsert(entry).select().single()
  if (error) throw new Error('저장 실패: ' + error.message)
  return data
}

export async function deleteReturn(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('returns').delete().eq('id', id)
  if (error) throw new Error('삭제 실패: ' + error.message)
}
