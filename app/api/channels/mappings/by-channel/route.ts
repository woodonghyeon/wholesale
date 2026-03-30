export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/**
 * 채널별 매핑 현황 조회 (channel-sync 페이지용)
 * GET /api/channels/mappings/by-channel?channel_id=...&business_id=...
 * 상품 단위 대표 행만 반환 (option_combination_id IS NULL)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const channelId  = searchParams.get('channel_id')
  const businessId = searchParams.get('business_id')

  if (!channelId) return NextResponse.json({ error: 'channel_id 필수' }, { status: 400 })

  const supabase = adminClient()

  let query = supabase
    .from('channel_product_mappings')
    .select(`
      id,
      product_id,
      platform_product_id,
      channel_price,
      channel_name,
      sync_price,
      sync_inventory,
      last_synced_at,
      last_sync_status,
      last_sync_error,
      product:products(id, name, image_url, business_id)
    `)
    .eq('channel_id', channelId)
    .is('option_combination_id', null)
    .order('created_at', { ascending: false })

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // business_id 필터 (JS 레벨)
  const rows = (data ?? []).filter((r: any) => {
    if (!businessId || businessId === 'all') return true
    return r.product?.business_id === businessId
  })

  // 옵션 조합 개수 집계
  const productIds = Array.from(new Set(rows.map((r: any) => r.product_id as string)))
  let comboCounts: Record<string, number> = {}
  if (productIds.length > 0) {
    const { data: combos } = await supabase
      .from('channel_product_mappings')
      .select('product_id')
      .eq('channel_id', channelId)
      .not('option_combination_id', 'is', null)
      .in('product_id', productIds)
    for (const c of combos ?? []) {
      comboCounts[c.product_id] = (comboCounts[c.product_id] ?? 0) + 1
    }
  }

  const result = rows.map((r: any) => ({
    mapping_id:       r.id,
    product_id:       r.product_id,
    product_name:     r.product?.name ?? '-',
    product_image:    r.product?.image_url ?? null,
    platform_product_id: r.platform_product_id,
    channel_price:    r.channel_price ?? null,
    sync_price:       r.sync_price,
    sync_inventory:   r.sync_inventory,
    last_synced_at:   r.last_synced_at,
    last_sync_status: r.last_sync_status,
    last_sync_error:  r.last_sync_error,
    combination_count: comboCounts[r.product_id] ?? 0,
  }))

  return NextResponse.json(result)
}
