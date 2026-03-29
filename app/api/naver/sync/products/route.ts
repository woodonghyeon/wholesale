export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getNaverProducts } from '@/lib/naver/products'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * 네이버 스마트스토어 상품을 우리 DB 상품으로 동기화 (조회 전용)
 * - note 필드에 [naver]{originProductNo} 저장하여 중복 방지
 * - 기존 상품은 sell_price만 업데이트
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const supabase = adminClient()

    // business_id 미제공 시 DB에서 첫 번째 사업자 자동 사용
    let businessId: string = body.business_id
    if (!businessId) {
      const { data: biz } = await supabase
        .from('businesses')
        .select('id')
        .order('created_at')
        .limit(1)
        .single()
      if (!biz?.id) return NextResponse.json({ success: false, error: '사업자 없음' }, { status: 400 })
      businessId = biz.id
    }

    // 1. 네이버 상품 조회 (GET만 사용)
    const naverProducts = await getNaverProducts()
    if (naverProducts.length === 0) {
      return NextResponse.json({ success: true, synced: 0, updated: 0, message: '네이버 상품 없음' })
    }

    // 2. 이미 동기화된 상품 목록 확인
    const { data: existingProducts } = await supabase
      .from('products')
      .select('id, note, sell_price')
      .like('note', '[naver]%')
    const existingMap = new Map(
      (existingProducts ?? []).map(p => [p.note, p])
    )

    let synced = 0
    let updated = 0
    const errors: string[] = []

    for (const np of naverProducts) {
      const noteKey = `[naver]${np.originProductNo}`
      const existing = existingMap.get(noteKey)

      if (existing) {
        // 이미 있으면 판매가만 업데이트
        if (existing.sell_price !== np.salePrice) {
          const { error } = await supabase
            .from('products')
            .update({ sell_price: np.salePrice })
            .eq('id', existing.id)
          if (error) errors.push(`상품 ${np.name}: ${error.message}`)
          else updated++
        }
      } else {
        // 신규 상품 등록
        const { error } = await supabase.from('products').insert({
          business_id: businessId,
          name: np.name,
          category: null,
          unit: 'ea',
          buy_price: 0,
          sell_price: np.salePrice,
          min_stock: 0,
          is_bundle: false,
          note: noteKey,
        })
        if (error) errors.push(`상품 ${np.name}: ${error.message}`)
        else synced++
      }
    }

    return NextResponse.json({
      success: true,
      total: naverProducts.length,
      synced,
      updated,
      skipped: naverProducts.length - synced - updated - errors.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error }, { status: 500 })
  }
}
