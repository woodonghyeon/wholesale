import { createClient } from './client'

export interface ChannelSaleRow {
  channel_id: string
  channel_name: string
  commission_rate: number
  shipping_fee: number
  slip_count: number
  total_sales: number
  commission_amount: number
  net_sales: number
  avg_order: number
}

export interface ChannelMonthlyRow {
  month: string
  [channelName: string]: number | string
}

export async function getSalesByChannel(
  businessId?: string,
  from?: string,
  to?: string
): Promise<ChannelSaleRow[]> {
  const supabase = createClient()
  let q = supabase
    .from('slips')
    .select('channel_id, total_amount, channels(name, commission_rate, shipping_fee)')
    .eq('slip_type', 'sale')
    .not('channel_id', 'is', null)
  if (businessId) q = q.eq('business_id', businessId)
  if (from) q = q.gte('slip_date', from)
  if (to) q = q.lte('slip_date', to)

  const { data, error } = await q
  if (error) throw new Error(error.message)

  const map: Record<string, {
    name: string; commission_rate: number; shipping_fee: number; sales: number; count: number
  }> = {}

  for (const s of data ?? []) {
    const ch = (s as any).channels
    if (!s.channel_id || !ch) continue
    if (!map[s.channel_id]) {
      map[s.channel_id] = {
        name: ch.name,
        commission_rate: ch.commission_rate ?? 0,
        shipping_fee: ch.shipping_fee ?? 0,
        sales: 0,
        count: 0,
      }
    }
    map[s.channel_id].sales += s.total_amount
    map[s.channel_id].count += 1
  }

  return Object.entries(map)
    .map(([id, v]) => {
      const commission = Math.round(v.sales * v.commission_rate / 100)
      return {
        channel_id: id,
        channel_name: v.name,
        commission_rate: v.commission_rate,
        shipping_fee: v.shipping_fee,
        slip_count: v.count,
        total_sales: v.sales,
        commission_amount: commission,
        net_sales: v.sales - commission,
        avg_order: v.count > 0 ? Math.round(v.sales / v.count) : 0,
      }
    })
    .sort((a, b) => b.total_sales - a.total_sales)
}

export async function getChannelMonthlySales(
  businessId?: string,
  from?: string,
  to?: string
): Promise<{ months: string[]; channels: string[]; data: Record<string, Record<string, number>> }> {
  const supabase = createClient()
  let q = supabase
    .from('slips')
    .select('channel_id, slip_date, total_amount, channels(name)')
    .eq('slip_type', 'sale')
    .not('channel_id', 'is', null)
  if (businessId) q = q.eq('business_id', businessId)
  if (from) q = q.gte('slip_date', from)
  if (to) q = q.lte('slip_date', to)

  const { data, error } = await q
  if (error) throw new Error(error.message)

  const monthSet = new Set<string>()
  const channelSet = new Set<string>()
  const matrix: Record<string, Record<string, number>> = {} // month → channelName → amount

  for (const s of data ?? []) {
    const ch = (s as any).channels
    if (!ch) continue
    const month = s.slip_date?.slice(0, 7) ?? ''
    const chName = ch.name as string
    monthSet.add(month)
    channelSet.add(chName)
    if (!matrix[month]) matrix[month] = {}
    matrix[month][chName] = (matrix[month][chName] ?? 0) + s.total_amount
  }

  const months = Array.from(monthSet).sort()
  const channels = Array.from(channelSet)
  return { months, channels, data: matrix }
}
