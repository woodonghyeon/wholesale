import { createClient } from './client'
import { Warehouse } from '@/lib/types'

export async function getWarehouses(businessId?: string): Promise<Warehouse[]> {
  const supabase = createClient()
  let query = supabase.from('warehouses').select('*').order('name')
  if (businessId && businessId !== 'all') query = query.eq('business_id', businessId)
  const { data, error } = await query
  if (error) throw new Error('창고 목록 조회 실패: ' + error.message)
  return data ?? []
}

export async function upsertWarehouse(warehouse: Partial<Warehouse> & { name: string }): Promise<Warehouse> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('warehouses')
    .upsert(warehouse)
    .select()
    .single()
  if (error) throw new Error('창고 저장 실패: ' + error.message)
  return data
}

export async function deleteWarehouse(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('warehouses').delete().eq('id', id)
  if (error) throw new Error('창고 삭제 실패: ' + error.message)
}
