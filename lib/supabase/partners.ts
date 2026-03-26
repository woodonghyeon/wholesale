import { createClient } from './client'
import { Partner } from '@/lib/types'
import { logActivity } from './logs'

export async function getPartners(type?: 'supplier' | 'customer' | 'both'): Promise<Partner[]> {
  const supabase = createClient()
  let query = supabase.from('partners').select('*').order('name')
  if (type) query = query.eq('partner_type', type)
  const { data, error } = await query
  if (error) throw new Error('거래처 목록 조회 실패: ' + error.message)
  return data ?? []
}

export async function upsertPartner(partner: Partial<Partner> & { name: string }): Promise<Partner> {
  const supabase = createClient()
  const isNew = !partner.id
  const { data, error } = await supabase
    .from('partners')
    .upsert(partner)
    .select()
    .single()
  if (error) throw new Error('거래처 저장 실패: ' + error.message)
  logActivity({
    action_type: isNew ? 'create' : 'update',
    resource_type: 'partner',
    resource_id: data.id,
    description: `거래처 ${isNew ? '등록' : '수정'}: ${partner.name}`,
    metadata: { name: partner.name, partner_type: partner.partner_type },
  })
  return data
}

export async function deletePartner(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('partners').delete().eq('id', id)
  if (error) throw new Error('거래처 삭제 실패: ' + error.message)
  logActivity({ action_type: 'delete', resource_type: 'partner', resource_id: id, description: `거래처 삭제: ${id.slice(0, 8)}` })
}
