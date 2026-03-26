import { createClient } from './client'
import { Partner } from '@/lib/types'

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
  const { data, error } = await supabase
    .from('partners')
    .upsert(partner)
    .select()
    .single()
  if (error) throw new Error('거래처 저장 실패: ' + error.message)
  return data
}

export async function deletePartner(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('partners').delete().eq('id', id)
  if (error) throw new Error('거래처 삭제 실패: ' + error.message)
}
