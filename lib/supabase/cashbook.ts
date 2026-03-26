import { createClient } from './client'
import { CashBook } from '@/lib/types'

export async function getCashBook(businessId?: string, from?: string, to?: string): Promise<CashBook[]> {
  const supabase = createClient()
  let query = supabase
    .from('cash_book')
    .select('*')
    .order('cash_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (businessId && businessId !== 'all') query = query.eq('business_id', businessId)
  if (from) query = query.gte('cash_date', from)
  if (to) query = query.lte('cash_date', to)
  const { data, error } = await query
  if (error) throw new Error('현금 출납 조회 실패: ' + error.message)
  return data ?? []
}

export async function upsertCashBook(entry: Partial<CashBook> & { business_id: string; cash_type: 'in' | 'out'; amount: number; cash_date: string }): Promise<CashBook> {
  const supabase = createClient()
  const { data, error } = await supabase.from('cash_book').upsert(entry).select().single()
  if (error) throw new Error('저장 실패: ' + error.message)
  return data
}

export async function deleteCashBook(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('cash_book').delete().eq('id', id)
  if (error) throw new Error('삭제 실패: ' + error.message)
}
