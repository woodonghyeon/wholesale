import { createClient } from './client'
import { Business } from '@/lib/types'
import { logActivity } from './logs'

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
  const isNew = !business.id
  const { data, error } = await supabase.from('businesses').upsert(business).select().single()
  if (error) throw new Error('사업자 저장 실패: ' + error.message)
  logActivity({ action_type: isNew ? 'create' : 'update', resource_type: 'settings', resource_id: data.id, description: `사업자 ${isNew ? '등록' : '수정'}: ${business.name}`, metadata: { name: business.name, business_no: business.business_no } })
  return data
}

export async function deleteBusiness(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('businesses').delete().eq('id', id)
  if (error) throw new Error('사업자 삭제 실패: ' + error.message)
  logActivity({ action_type: 'delete', resource_type: 'settings', resource_id: id, description: `사업자 삭제: ${id.slice(0, 8)}` })
}
