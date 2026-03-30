export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/** GET /api/channels/mappings?product_id=... */
export async function GET(req: NextRequest) {
  const productId = req.nextUrl.searchParams.get('product_id')
  if (!productId) return NextResponse.json({ error: 'product_id 필수' }, { status: 400 })

  const { data, error } = await adminClient()
    .from('channel_product_mappings')
    .select('*, channel:channels(id, name, platform_type), combination:product_option_combinations(id, label)')
    .eq('product_id', productId)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

/** POST /api/channels/mappings — 저장 (upsert) */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { mappings } = body  // 배열로 받아 일괄 저장 (옵션 조합별)

    if (!mappings?.length) return NextResponse.json({ error: 'mappings 필수' }, { status: 400 })

    const supabase = adminClient()
    const results = []

    for (const m of mappings) {
      const { data, error } = await supabase
        .from('channel_product_mappings')
        .upsert({
          product_id: m.product_id,
          option_combination_id: m.option_combination_id ?? null,
          channel_id: m.channel_id,
          platform_product_id: m.platform_product_id,
          platform_option_id: m.platform_option_id ?? null,
          business_id: m.business_id ?? null,
          sync_price: m.sync_price ?? true,
          sync_inventory: m.sync_inventory ?? true,
        })
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      results.push(data)
    }

    return NextResponse.json({ success: true, data: results })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

/** PATCH /api/channels/mappings — 채널가격/채널명/동기화 플래그 수정 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, channel_price, channel_name, sync_price, sync_inventory, platform_product_id } = body
    if (!id) return NextResponse.json({ error: 'id 필수' }, { status: 400 })

    const updates: Record<string, unknown> = {}
    if (channel_price        !== undefined) updates.channel_price        = channel_price === '' ? null : Number(channel_price)
    if (channel_name         !== undefined) updates.channel_name         = channel_name  === '' ? null : channel_name
    if (sync_price           !== undefined) updates.sync_price           = sync_price
    if (sync_inventory       !== undefined) updates.sync_inventory       = sync_inventory
    if (platform_product_id  !== undefined) updates.platform_product_id  = platform_product_id

    const { data, error } = await adminClient()
      .from('channel_product_mappings')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, data })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

/** DELETE /api/channels/mappings?id=... */
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id 필수' }, { status: 400 })

  const { error } = await adminClient()
    .from('channel_product_mappings')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
