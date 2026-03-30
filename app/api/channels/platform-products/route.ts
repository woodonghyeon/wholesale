export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { naverAdapter } from '@/lib/channels/adapters/naver'
import { ChannelAdapter } from '@/lib/channels/types'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function getAdapter(platformType: string): ChannelAdapter | null {
  if (platformType === 'naver') return naverAdapter
  return null
}

/**
 * 플랫폼 상품 목록 조회 (일괄 연동 모달용)
 * GET /api/channels/platform-products?channel_id=...&business_id=...
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const channelId  = searchParams.get('channel_id')
  const businessId = searchParams.get('business_id') ?? undefined

  if (!channelId) {
    return NextResponse.json({ error: 'channel_id 필수' }, { status: 400 })
  }

  try {
    const supabase = adminClient()

    // 채널 플랫폼 타입 조회
    const { data: channel } = await supabase
      .from('channels')
      .select('platform_type, name')
      .eq('id', channelId)
      .single()

    if (!channel?.platform_type) {
      return NextResponse.json({ error: '플랫폼 타입이 설정되지 않은 채널입니다' }, { status: 400 })
    }

    const adapter = getAdapter(channel.platform_type)
    if (!adapter?.listProducts) {
      return NextResponse.json({ error: `${channel.platform_type} 플랫폼은 상품 목록 조회를 지원하지 않습니다` }, { status: 400 })
    }

    // 플랫폼 상품 목록 조회
    const products = await adapter.listProducts(businessId)

    // 이미 매핑된 platform_product_id 목록
    const { data: mappings } = await supabase
      .from('channel_product_mappings')
      .select('platform_product_id, product_id, product:products(name)')
      .eq('channel_id', channelId)
      .is('option_combination_id', null)

    const mappedIds = new Set((mappings ?? []).map((m: any) => m.platform_product_id))
    const mappedInfo = Object.fromEntries(
      (mappings ?? []).map((m: any) => [m.platform_product_id, { product_id: m.product_id, product_name: m.product?.name }])
    )

    return NextResponse.json({
      products: products.map(p => ({
        ...p,
        isMapped: mappedIds.has(p.platformProductId),
        mappedTo: mappedInfo[p.platformProductId] ?? null,
      })),
      channelName: channel.name,
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
