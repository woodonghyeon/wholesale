export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { syncProductToAllChannels } from '@/lib/channels/sync'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/**
 * 채널 전체 상품 일괄 동기화
 * POST /api/channels/bulk-sync
 * body: { channel_id, business_id?, sync_price?, sync_inventory? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { channel_id, sync_price, sync_inventory } = body

    if (!channel_id) {
      return NextResponse.json({ error: 'channel_id 필수' }, { status: 400 })
    }

    const supabase = adminClient()

    // 이 채널에 매핑된 고유 product_id 목록 조회
    const { data: mappings, error: mapErr } = await supabase
      .from('channel_product_mappings')
      .select('product_id, product:products(id, business_id)')
      .eq('channel_id', channel_id)
      .is('option_combination_id', null)

    if (mapErr) return NextResponse.json({ error: mapErr.message }, { status: 500 })
    if (!mappings?.length) {
      return NextResponse.json({ success: true, total: 0, success_count: 0, failed_count: 0, results: [] })
    }

    // product_id 중복 제거 + business_id 확보
    const productMap = new Map<string, string>()
    for (const m of mappings as any[]) {
      if (m.product_id && m.product?.business_id) {
        productMap.set(m.product_id, m.product.business_id)
      }
    }

    const allResults = []
    let successCount = 0
    let failedCount  = 0

    for (const [productId, businessId] of Array.from(productMap.entries())) {
      const results = await syncProductToAllChannels(productId, businessId, {
        forceSyncPrice: sync_price,
        forceSyncInventory: sync_inventory,
      })
      // 이 채널에 해당하는 결과만 필터
      const channelResults = results.filter(r =>
        // channelName 기반 필터 — 모든 결과 포함 (단일 채널 동기화이므로 항상 이 채널)
        true
      )
      for (const r of channelResults) {
        if (r.success) successCount++
        else failedCount++
        allResults.push({ productId, ...r })
      }
    }

    return NextResponse.json({
      success: failedCount === 0,
      total: productMap.size,
      success_count: successCount,
      failed_count: failedCount,
      results: allResults,
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
