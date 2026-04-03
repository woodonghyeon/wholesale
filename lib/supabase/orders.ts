import { createClient } from './client'

export interface OrderFilter {
  businessId: string
  channelId?: string
  status?: string
  from?: string
  to?: string
  search?: string
  isProcessed?: boolean
}

export interface OrderStats {
  total: number
  paid: number
  shipping: number
  delivered: number
  cancelled: number
  revenue: number
}

export async function fetchChannelOrders(filter: OrderFilter) {
  const supabase = createClient()
  let query = supabase
    .from('channel_orders')
    .select('*')
    .order('ordered_at', { ascending: false })
    .limit(500)

  if (filter.businessId !== 'all') {
    query = query.eq('business_id', filter.businessId)
  }
  if (filter.channelId) {
    query = query.eq('channel_id', filter.channelId)
  }
  if (filter.status && filter.status !== 'all') {
    if (filter.status === 'cancelled') {
      query = query.in('order_status', ['cancelled', 'returned', 'cancel_request', 'return_request'])
    } else {
      query = query.eq('order_status', filter.status)
    }
  }
  if (filter.from) {
    query = query.gte('ordered_at', filter.from)
  }
  if (filter.to) {
    query = query.lte('ordered_at', `${filter.to}T23:59:59`)
  }
  if (filter.search) {
    query = query.or(
      `buyer_name.ilike.%${filter.search}%,receiver_name.ilike.%${filter.search}%,product_name.ilike.%${filter.search}%,external_order_id.ilike.%${filter.search}%`,
    )
  }
  if (filter.isProcessed !== undefined) {
    query = query.eq('is_processed', filter.isProcessed)
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function fetchOrderStats(businessId: string): Promise<OrderStats> {
  const supabase = createClient()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  let query = supabase
    .from('channel_orders')
    .select('order_status, total_amount')
    .gte('ordered_at', thirtyDaysAgo)

  if (businessId !== 'all') {
    query = query.eq('business_id', businessId)
  }

  const { data, error } = await query
  if (error) throw error

  const rows = data ?? []
  const cancelled = ['cancelled', 'returned', 'cancel_request', 'return_request']

  return {
    total: rows.length,
    paid: rows.filter(r => r.order_status === 'paid').length,
    shipping: rows.filter(r => r.order_status === 'shipping').length,
    delivered: rows.filter(r => ['delivered', 'confirmed'].includes(r.order_status)).length,
    cancelled: rows.filter(r => cancelled.includes(r.order_status)).length,
    revenue: rows
      .filter(r => !cancelled.includes(r.order_status))
      .reduce((s, r) => s + (r.total_amount ?? 0), 0),
  }
}

export async function markOrderProcessed(id: string, slipId?: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('channel_orders')
    .update({
      is_processed: true,
      ref_slip_id: slipId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw error
}
