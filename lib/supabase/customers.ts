import { createClient } from './client'
import { RegularCustomer, RegularCustomerItem } from '@/lib/types'
import { logActivity } from './logs'

export interface RegularCustomerRow extends RegularCustomer {
  partner_name?: string
  channel_name?: string
  items: (RegularCustomerItem & { product_name?: string })[]
  days_until_next: number
}

export async function getRegularCustomers(businessId?: string): Promise<RegularCustomerRow[]> {
  const supabase = createClient()
  let query = supabase
    .from('regular_customers')
    .select('*, partners(name), channels(name), regular_customer_items(*, products(name))')
    .order('created_at', { ascending: false })
  if (businessId && businessId !== 'all') query = query.eq('business_id', businessId)
  const { data, error } = await query
  if (error) throw new Error('정기 고객 조회 실패: ' + error.message)

  const today = new Date()
  return (data ?? []).map((r: any) => {
    let daysUntilNext = 0
    if (r.last_order_date) {
      const last = new Date(r.last_order_date)
      const nextDate = new Date(last.getTime() + r.order_cycle_days * 86400000)
      daysUntilNext = Math.ceil((nextDate.getTime() - today.getTime()) / 86400000)
    }
    return {
      ...r,
      partner_name: r.partners?.name ?? null,
      channel_name: r.channels?.name ?? null,
      items: (r.regular_customer_items ?? []).map((i: any) => ({ ...i, product_name: i.products?.name ?? null })),
      days_until_next: daysUntilNext,
    }
  })
}

export async function upsertRegularCustomer(customer: Partial<RegularCustomer> & { business_id: string; order_cycle_days: number }): Promise<RegularCustomer> {
  const supabase = createClient()
  const isNew = !customer.id
  const { data, error } = await supabase.from('regular_customers').upsert(customer).select().single()
  if (error) throw new Error('저장 실패: ' + error.message)
  logActivity({ action_type: isNew ? 'create' : 'update', resource_type: 'customer', resource_id: data.id, description: `정기고객 ${isNew ? '등록' : '수정'}: 주기 ${customer.order_cycle_days}일`, metadata: { order_cycle_days: customer.order_cycle_days } })
  return data
}

export async function deleteRegularCustomer(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('regular_customers').delete().eq('id', id)
  if (error) throw new Error('삭제 실패: ' + error.message)
  logActivity({ action_type: 'delete', resource_type: 'customer', resource_id: id, description: `정기고객 삭제: ${id.slice(0, 8)}` })
}
