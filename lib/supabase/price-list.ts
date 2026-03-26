import { createClient } from './client'
import { logActivity } from './logs'

export interface PartnerPrice {
  id: string
  partner_id: string
  partner_name?: string
  product_id: string
  product_name?: string
  channel_id: string | null
  channel_name?: string
  unit_price: number
  note: string | null
  created_at: string
}

export async function getPartnerPrices(opts: {
  partnerId?: string
  productId?: string
  channelId?: string
} = {}): Promise<PartnerPrice[]> {
  const supabase = createClient()
  let q = supabase
    .from('partner_prices')
    .select('*, partners(name), products(name), channels(name)')
    .order('created_at', { ascending: false })

  if (opts.partnerId) q = q.eq('partner_id', opts.partnerId)
  if (opts.productId) q = q.eq('product_id', opts.productId)
  if (opts.channelId) q = q.eq('channel_id', opts.channelId)

  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []).map((r: any) => ({
    ...r,
    partner_name: r.partners?.name ?? null,
    product_name: r.products?.name ?? null,
    channel_name: r.channels?.name ?? null,
  }))
}

export async function upsertPartnerPrice(row: {
  id?: string
  partner_id: string
  product_id: string
  channel_id?: string | null
  unit_price: number
  note?: string | null
}): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('partner_prices')
    .upsert({
      ...row,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'partner_id,product_id,channel_id' })
  if (error) throw new Error(error.message)
  logActivity({
    action_type: row.id ? 'update' : 'create',
    resource_type: 'product',
    description: `다단가 ${row.id ? '수정' : '등록'}: 단가 ${row.unit_price.toLocaleString()}원`,
    metadata: { partner_id: row.partner_id, product_id: row.product_id, unit_price: row.unit_price },
  })
}

export async function deletePartnerPrice(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('partner_prices').delete().eq('id', id)
  if (error) throw new Error(error.message)
  logActivity({ action_type: 'delete', resource_type: 'product', resource_id: id, description: `다단가 삭제: ${id.slice(0, 8)}` })
}

/** 특정 거래처·상품·채널에 해당하는 단가를 조회 (거래 입력 시 자동 적용용) */
export async function resolveUnitPrice(
  productId: string,
  partnerId?: string,
  channelId?: string
): Promise<number | null> {
  const supabase = createClient()

  // 1순위: 거래처 + 채널 조합
  if (partnerId && channelId) {
    const { data } = await supabase
      .from('partner_prices')
      .select('unit_price')
      .eq('product_id', productId)
      .eq('partner_id', partnerId)
      .eq('channel_id', channelId)
      .maybeSingle()
    if (data) return data.unit_price
  }

  // 2순위: 거래처 전용 (채널 무관)
  if (partnerId) {
    const { data } = await supabase
      .from('partner_prices')
      .select('unit_price')
      .eq('product_id', productId)
      .eq('partner_id', partnerId)
      .is('channel_id', null)
      .maybeSingle()
    if (data) return data.unit_price
  }

  // 3순위: 채널 전용
  if (channelId) {
    const { data } = await supabase
      .from('partner_prices')
      .select('unit_price')
      .eq('product_id', productId)
      .is('partner_id', null)
      .eq('channel_id', channelId)
      .maybeSingle()
    if (data) return data.unit_price
  }

  return null
}
