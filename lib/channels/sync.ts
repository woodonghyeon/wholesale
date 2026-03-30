import { createClient } from '@supabase/supabase-js'
import { naverAdapter } from './adapters/naver'
import { ChannelAdapter, SyncPayload } from './types'
import { SyncResult } from './types'

function getAdapter(platformType: string): ChannelAdapter | null {
  switch (platformType) {
    case 'naver': return naverAdapter
    default: return null
  }
}

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export interface SyncProductResult {
  mappingId: string
  channelName: string
  success: boolean
  error?: string
}

/**
 * 특정 상품의 모든 채널 매핑에 대해 동기화 실행
 * syncPrice, syncInventory 플래그를 각 매핑 설정에 따라 적용
 */
export async function syncProductToAllChannels(
  productId: string,
  businessId: string,
  options?: { forceSyncPrice?: boolean; forceSyncInventory?: boolean }
): Promise<SyncProductResult[]> {
  const supabase = adminClient()
  const results: SyncProductResult[] = []

  // 1. 이 상품의 모든 채널 매핑 조회
  const { data: mappings, error: mapErr } = await supabase
    .from('channel_product_mappings')
    .select('*, channel:channels(id, name, platform_type)')
    .eq('product_id', productId)
  if (mapErr || !mappings) return results

  // 2. 현재 상품 가격 조회
  const { data: product } = await supabase
    .from('products')
    .select('sell_price')
    .eq('id', productId)
    .single()

  // 3. 상품 옵션 조합 목록 조회
  const { data: combinations } = await supabase
    .from('product_option_combinations')
    .select('id, label, add_price')
    .eq('product_id', productId)

  // 4. 현재 재고 조회 (창고 전체 합산)
  const { data: inventoryRows } = await supabase
    .from('inventory')
    .select('quantity, option_combination_id')
    .eq('product_id', productId)
    .eq('business_id', businessId)

  // platform_product_id 기준으로 매핑 그룹핑 (여러 옵션 조합이 같은 플랫폼 상품에 묶임)
  const platformGroups = new Map<string, typeof mappings>()
  for (const m of mappings) {
    const key = `${(m as any).channel_id}::${m.platform_product_id}`
    if (!platformGroups.has(key)) platformGroups.set(key, [])
    platformGroups.get(key)!.push(m)
  }

  for (const [, groupMappings] of platformGroups) {
    const representative = groupMappings[0] as any
    const channel = representative.channel
    if (!channel?.platform_type) continue

    const adapter = getAdapter(channel.platform_type)
    if (!adapter) {
      results.push({ mappingId: representative.id, channelName: channel.name, success: false, error: '지원하지 않는 플랫폼' })
      continue
    }

    const doPrice = options?.forceSyncPrice ?? representative.sync_price
    const doInventory = options?.forceSyncInventory ?? representative.sync_inventory

    const payload: SyncPayload = {}

    // 가격 결정: 채널별 가격 우선, 없으면 기본가
    if (doPrice && product) {
      const { data: channelPrice } = await supabase
        .from('product_prices')
        .select('unit_price')
        .eq('product_id', productId)
        .eq('channel_id', representative.channel_id)
        .maybeSingle()
      payload.price = channelPrice?.unit_price ?? product.sell_price
    }

    // 재고 매핑
    if (doInventory) {
      const inventoryMap = new Map<string | null, number>()

      if (groupMappings.every((m: any) => !m.option_combination_id)) {
        // 옵션 없는 상품: 전체 합산
        const total = (inventoryRows ?? []).reduce((sum: number, r: any) => sum + (r.quantity ?? 0), 0)
        inventoryMap.set(null, total)
      } else {
        // 옵션 있는 상품: 조합별 매핑
        for (const m of groupMappings as any[]) {
          if (!m.option_combination_id || !m.platform_option_id) continue
          const inv = (inventoryRows ?? []).find((r: any) => r.option_combination_id === m.option_combination_id)
          inventoryMap.set(m.platform_option_id, inv?.quantity ?? 0)
        }
      }
      payload.inventory = inventoryMap
    }

    // 5. 동기화 실행
    const result: SyncResult = await adapter.syncProduct(
      representative.platform_product_id,
      payload,
      businessId,
    )

    // 6. 매핑 상태 업데이트
    const updatePayload = {
      last_synced_at: new Date().toISOString(),
      last_sync_status: result.success ? 'success' : 'failed',
      last_sync_error: result.error ?? null,
    }
    for (const m of groupMappings) {
      await supabase.from('channel_product_mappings').update(updatePayload).eq('id', m.id)
    }

    // 7. 이력 저장
    await supabase.from('channel_sync_logs').insert({
      business_id: businessId,
      product_id: productId,
      channel_id: representative.channel_id,
      sync_type: doPrice && doInventory ? 'both' : doPrice ? 'price' : 'inventory',
      old_value: {},
      new_value: {
        price: payload.price,
        inventory: payload.inventory ? Object.fromEntries(payload.inventory) : undefined,
      },
      status: result.success ? 'success' : 'failed',
      error_msg: result.error ?? null,
    })

    results.push({
      mappingId: representative.id,
      channelName: channel.name,
      success: result.success,
      error: result.error,
    })
  }

  return results
}
