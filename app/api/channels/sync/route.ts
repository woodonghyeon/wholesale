export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { syncProductToAllChannels } from '@/lib/channels/sync'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/**
 * 채널 동기화 실행
 * POST /api/channels/sync
 * body: { product_id, business_id?, sync_price?, sync_inventory? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { product_id, sync_price, sync_inventory } = body

    if (!product_id) {
      return NextResponse.json({ error: 'product_id 필수' }, { status: 400 })
    }

    // business_id 미제공 시 상품에서 조회
    let businessId: string = body.business_id
    if (!businessId) {
      const { data: product } = await adminClient()
        .from('products')
        .select('business_id')
        .eq('id', product_id)
        .single()
      if (!product?.business_id) {
        return NextResponse.json({ error: '사업자 정보를 찾을 수 없습니다' }, { status: 400 })
      }
      businessId = product.business_id
    }

    const results = await syncProductToAllChannels(product_id, businessId, {
      forceSyncPrice: sync_price,
      forceSyncInventory: sync_inventory,
    })

    const allSuccess = results.every(r => r.success)
    const failed = results.filter(r => !r.success)

    return NextResponse.json({
      success: allSuccess,
      total: results.length,
      failed: failed.length,
      results,
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
