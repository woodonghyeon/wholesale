import { createClient } from './client'
import { CashBook } from '@/lib/types'
import { logActivity } from './logs'

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
  const isNew = !entry.id
  const { data, error } = await supabase.from('cash_book').upsert(entry).select().single()
  if (error) throw new Error('저장 실패: ' + error.message)
  logActivity({ action_type: isNew ? 'create' : 'update', resource_type: 'cash', resource_id: data.id, description: `현금출납 ${isNew ? '등록' : '수정'}: ${entry.cash_type === 'in' ? '입금' : '출금'} ${entry.amount.toLocaleString()}원`, metadata: { cash_type: entry.cash_type, amount: entry.amount, category: entry.category } })
  return data
}

export async function deleteCashBook(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('cash_book').delete().eq('id', id)
  if (error) throw new Error('삭제 실패: ' + error.message)
  logActivity({ action_type: 'delete', resource_type: 'cash', resource_id: id, description: `현금출납 삭제: ${id.slice(0, 8)}` })
}
