import { createClient } from '@/lib/supabase/client'
import type { Partner, PartnerType } from '@/lib/types'

export interface PartnerFilter {
  partnerType?: PartnerType | 'all'
}

export interface PartnerFormData {
  name: string
  partner_type: PartnerType
  phone?: string
  email?: string
  address?: string
  business_no?: string
  credit_limit: number
  note?: string
}

export async function fetchPartners(filter: PartnerFilter): Promise<Partner[]> {
  const supabase = createClient()
  let query = supabase
    .from('partners')
    .select('*')
    .order('name', { ascending: true })

  if (filter.partnerType && filter.partnerType !== 'all') {
    query = query.eq('partner_type', filter.partnerType)
  }

  const { data, error } = await query
  if (error) throw error

  return (data ?? []) as Partner[]
}

export async function createPartner(data: PartnerFormData): Promise<Partner> {
  const supabase = createClient()
  const { data: created, error } = await supabase
    .from('partners')
    .insert(data)
    .select('*')
    .single()
  if (error) throw error
  return created as Partner
}

export async function updatePartner(id: string, data: Partial<PartnerFormData>): Promise<Partner> {
  const supabase = createClient()
  const { data: updated, error } = await supabase
    .from('partners')
    .update(data)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return updated as Partner
}

export async function deletePartner(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('partners').delete().eq('id', id)
  if (error) throw error
}
