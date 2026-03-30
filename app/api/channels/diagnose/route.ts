export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getNaverAuthHeaders, BASE_URL } from '@/lib/naver/auth'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/**
 * 채널 매핑 ID 진단
 * GET /api/channels/diagnose?mapping_id=...
 * 저장된 platform_product_id로 실제 API 호출 결과를 반환
 */
export async function GET(req: NextRequest) {
  const mappingId  = req.nextUrl.searchParams.get('mapping_id')
  const businessId = req.nextUrl.searchParams.get('business_id') ?? undefined

  if (!mappingId) return NextResponse.json({ error: 'mapping_id 필수' }, { status: 400 })

  const supabase = adminClient()

  // 매핑 조회
  const { data: mapping } = await supabase
    .from('channel_product_mappings')
    .select('platform_product_id, channel_id, product_id')
    .eq('id', mappingId)
    .single()

  if (!mapping) return NextResponse.json({ error: '매핑을 찾을 수 없습니다' }, { status: 404 })

  const pid = mapping.platform_product_id
  const steps: Record<string, unknown> = { stored_platform_product_id: pid }

  try {
    const headers = await getNaverAuthHeaders(businessId)

    // STEP 1: originProducts 직접 조회
    const r1 = await fetch(`${BASE_URL}/external/v1/products/origin-products/${pid}`, { headers })
    steps['step1_origin_GET'] = { status: r1.status, ok: r1.ok }
    if (r1.ok) {
      const d = await r1.json()
      steps['step1_result'] = { originProductNo: (d as any).originProductNo, name: (d as any).originProduct?.name }
      return NextResponse.json({ success: true, resolved_id: pid, steps })
    }
    steps['step1_error'] = await r1.text()

    // STEP 2: channelProducts 직접 조회
    const r2 = await fetch(`${BASE_URL}/external/v1/products/channel-products/${pid}`, { headers })
    steps['step2_channel_GET'] = { status: r2.status, ok: r2.ok }
    if (r2.ok) {
      const d = await r2.json()
      steps['step2_result'] = d
      const originNo = (d as any).originProductNo ?? (d as any).originProduct?.originProductNo
      if (originNo) {
        steps['resolved_origin_id'] = String(originNo)
        // 실제로 조회 가능한지 확인
        const r3 = await fetch(`${BASE_URL}/external/v1/products/origin-products/${originNo}`, { headers })
        steps['step3_verify'] = { status: r3.status, ok: r3.ok }
        if (r3.ok) {
          const d3 = await r3.json()
          steps['step3_result'] = { name: (d3 as any).originProduct?.name }
          return NextResponse.json({ success: true, resolved_id: String(originNo), steps })
        }
      }
    } else {
      steps['step2_error'] = await r2.text()
    }

    // STEP 3: POST /search 전체 탐색
    const r4 = await fetch(`${BASE_URL}/external/v1/products/search`, {
      method: 'POST', headers, body: JSON.stringify({ page: 1, size: 100 }),
    })
    steps['step3_search_POST'] = { status: r4.status, ok: r4.ok }
    if (r4.ok) {
      const d = await r4.json()
      steps['step3_totalElements'] = d.totalElements
      steps['step3_first3'] = (d.contents ?? []).slice(0, 3).map((c: any) => ({
        originProductNo: c.originProductNo,
        name: c.name,
        channelProductNos: (c.channelProducts ?? []).map((ch: any) => ch.channelProductNo),
      }))
    } else {
      steps['step3_error'] = await r4.text()
    }

    return NextResponse.json({ success: false, steps })
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message, steps })
  }
}
