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
 * 채널 상품 조회 + 우리 시스템 값과 비교
 * GET /api/channels/preview?channel_id=...&platform_product_id=...&product_id=...
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const channelId = searchParams.get('channel_id')
  const platformProductId = searchParams.get('platform_product_id')
  const productId = searchParams.get('product_id')

  if (!channelId || !platformProductId) {
    return NextResponse.json({ error: 'channel_id, platform_product_id 필수' }, { status: 400 })
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
    if (!adapter) {
      return NextResponse.json({ error: `${channel.platform_type} 플랫폼은 아직 지원하지 않습니다` }, { status: 400 })
    }

    // 사업자 ID 조회 (API 인증용)
    let businessId: string | undefined
    if (productId) {
      const { data: product } = await supabase
        .from('products')
        .select('business_id')
        .eq('id', productId)
        .single()
      businessId = product?.business_id ?? undefined
    }

    // 플랫폼 상품 조회
    const platformProduct = await adapter.getProduct(platformProductId, businessId)

    // 우리 시스템 현재 값 (productId 제공 시)
    let ourData: { price: number; channelPrice?: number; inventory: { label: string; quantity: number; combinationId?: string }[] } | null = null

    if (productId) {
      const { data: product } = await supabase
        .from('products')
        .select('sell_price')
        .eq('id', productId)
        .single()

      const { data: channelPrice } = await supabase
        .from('product_prices')
        .select('unit_price')
        .eq('product_id', productId)
        .eq('channel_id', channelId)
        .maybeSingle()

      // 재고 (옵션별 or 합산)
      const { data: combinations } = await supabase
        .from('product_option_combinations')
        .select('id, label')
        .eq('product_id', productId)

      const { data: inventoryRows } = await supabase
        .from('inventory')
        .select('quantity, option_combination_id')
        .eq('product_id', productId)

      const inventoryList: typeof ourData.inventory = []
      if (combinations && combinations.length > 0) {
        for (const combo of combinations) {
          const inv = inventoryRows?.find(r => r.option_combination_id === combo.id)
          inventoryList.push({ label: combo.label, quantity: inv?.quantity ?? 0, combinationId: combo.id })
        }
      } else {
        const total = (inventoryRows ?? []).reduce((s, r) => s + (r.quantity ?? 0), 0)
        inventoryList.push({ label: '기본', quantity: total })
      }

      ourData = {
        price: product?.sell_price ?? 0,
        channelPrice: channelPrice?.unit_price ?? undefined,
        inventory: inventoryList,
      }
    }

    return NextResponse.json({
      platform: { ...platformProduct, rawData: undefined },  // rawData 제외
      our: ourData,
      channelName: channel.name,
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
