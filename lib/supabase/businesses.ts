import { createClient } from './client'
import { Business } from '@/lib/types'

export async function getBusinesses(): Promise<Business[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .order('sort_order')
  if (error) throw new Error('사업자 목록 조회 실패: ' + error.message)
  return data ?? []
}

export async function upsertBusiness(business: Partial<Business> & { name: string }): Promise<Business> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('businesses')
    .upsert(business)
    .select()
    .single()
  if (error) throw new Error('사업자 저장 실패: ' + error.message)
  return data
}

export async function deleteBusiness(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('businesses').delete().eq('id', id)
  if (error) throw new Error('사업자 삭제 실패: ' + error.message)
}
