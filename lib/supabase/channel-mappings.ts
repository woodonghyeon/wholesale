import { createClient } from './client'
import { ChannelProductMapping, ChannelSyncLog, SyncStatus } from '@/lib/types'

/** 특정 상품의 채널 매핑 전체 조회 (채널 정보 + 조합 정보 포함) */
export async function getChannelMappings(productId: string): Promise<ChannelProductMapping[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('channel_product_mappings')
    .select(`
      *,
      channel:channels(id, name, platform_type),
      combination:product_option_combinations(id, label, add_price)
    `)
    .eq('product_id', productId)
    .order('created_at')

  if (error) throw new Error('채널 매핑 조회 실패: ' + error.message)
  return (data ?? []) as ChannelProductMapping[]
}

/** 채널 매핑 저장 (upsert) */
export async function upsertChannelMapping(
  mapping: Omit<ChannelProductMapping, 'id' | 'created_at' | 'channel' | 'combination' | 'last_synced_at' | 'last_sync_status' | 'last_sync_error'> & { id?: string }
): Promise<ChannelProductMapping> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('channel_product_mappings')
    .upsert(mapping)
    .select()
    .single()
  if (error) throw new Error('채널 매핑 저장 실패: ' + error.message)
  return data
}

/** 채널 매핑 삭제 */
export async function deleteChannelMapping(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('channel_product_mappings')
    .delete()
    .eq('id', id)
  if (error) throw new Error('채널 매핑 삭제 실패: ' + error.message)
}

/** 동기화 상태 업데이트 */
export async function updateMappingSyncStatus(
  id: string,
  status: SyncStatus,
  error?: string,
): Promise<void> {
  const supabase = createClient()
  const { error: dbErr } = await supabase
    .from('channel_product_mappings')
    .update({
      last_synced_at: new Date().toISOString(),
      last_sync_status: status,
      last_sync_error: error ?? null,
    })
    .eq('id', id)
  if (dbErr) throw new Error('동기화 상태 업데이트 실패: ' + dbErr.message)
}

/** 동기화 이력 저장 */
export async function saveSyncLog(log: Omit<ChannelSyncLog, 'id' | 'synced_at'>): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('channel_sync_logs').insert(log)
  if (error) console.error('동기화 이력 저장 실패:', error.message)
}

/** /channel-sync 페이지용: 전체 상품-채널 매핑 현황 조회 */
export interface MappingStatusRow {
  product_id: string
  product_name: string
  product_image: string | null
  channel_id: string
  channel_name: string
  platform_type: string | null
  platform_product_id: string
  mapping_id: string
  sync_price: boolean
  sync_inventory: boolean
  last_synced_at: string | null
  last_sync_status: SyncStatus | null
  last_sync_error: string | null
  // 조합별 개수 (옵션 있는 상품)
  combination_count: number
}

export async function getAllMappingsStatus(businessId?: string): Promise<MappingStatusRow[]> {
  const supabase = createClient()

  let query = supabase
    .from('channel_product_mappings')
    .select(`
      id,
      product_id,
      channel_id,
      platform_product_id,
      option_combination_id,
      sync_price,
      sync_inventory,
      last_synced_at,
      last_sync_status,
      last_sync_error,
      channel:channels(id, name, platform_type),
      product:products(id, name, image_url, business_id)
    `)
    .is('option_combination_id', null)  // 대표 행만 (옵션 없는 상품 or 상품 단위)
    .order('created_at', { ascending: false })

  const { data, error } = await query
  if (error) throw new Error('매핑 현황 조회 실패: ' + error.message)

  // businessId 필터 (JS레벨 - 조인된 product.business_id 기준)
  const rows = (data ?? []).filter((r: any) => {
    if (!businessId || businessId === 'all') return true
    return r.product?.business_id === businessId
  })

  // 옵션 있는 상품의 경우 option_combination_id IS NOT NULL 행들도 별도 집계
  // 여기서는 단순하게 상품+채널 기준 대표 행만 반환
  return rows.map((r: any) => ({
    product_id: r.product_id,
    product_name: r.product?.name ?? '-',
    product_image: r.product?.image_url ?? null,
    channel_id: r.channel_id,
    channel_name: r.channel?.name ?? '-',
    platform_type: r.channel?.platform_type ?? null,
    platform_product_id: r.platform_product_id,
    mapping_id: r.id,
    sync_price: r.sync_price,
    sync_inventory: r.sync_inventory,
    last_synced_at: r.last_synced_at,
    last_sync_status: r.last_sync_status,
    last_sync_error: r.last_sync_error,
    combination_count: 0,
  }))
}
