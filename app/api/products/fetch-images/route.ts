export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * POST /api/products/fetch-images
 * 이미지가 없는 상품들에 대해 네이버 쇼핑 API로 이미지를 일괄 수집
 * body: { productIds?: string[] }  — 없으면 전체 대상
 */
export async function POST(req: Request) {
  const clientId = process.env.NAVER_CLIENT_ID
  const clientSecret = process.env.NAVER_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 환경변수가 필요합니다.' },
      { status: 501 }
    )
  }

  const body = await req.json().catch(() => ({}))
  const productIds: string[] | undefined = body.productIds

  const supabase = adminClient()

  // 대상 상품 조회 (image_url이 없는 것만)
  let query = supabase
    .from('products')
    .select('id, name, barcode')
    .is('image_url', null)

  if (productIds?.length) {
    query = query.in('id', productIds)
  }

  const { data: products, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!products?.length) {
    return NextResponse.json({ updated: 0, message: '수집할 상품이 없습니다 (이미 모두 이미지 보유)' })
  }

  // 네이버 쇼핑 API 호출 (상품당 1회, 과부하 방지를 위해 순차 처리)
  async function fetchNaverImage(query: string): Promise<string | null> {
    try {
      const res = await fetch(
        `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(query)}&display=1`,
        {
          headers: {
            'X-Naver-Client-Id': clientId!,
            'X-Naver-Client-Secret': clientSecret!,
          },
        }
      )
      if (!res.ok) return null
      const json = await res.json()
      return json.items?.[0]?.image ?? null
    } catch {
      return null
    }
  }

  let updated = 0
  let failed = 0
  const results: { id: string; name: string; image_url: string | null; status: string }[] = []

  for (const product of products) {
    // 바코드 있으면 바코드로 먼저 검색, 없으면 상품명으로
    const searchQuery = product.barcode ?? product.name
    const imageUrl = await fetchNaverImage(searchQuery)

    // 바코드로 검색했는데 결과 없으면 상품명으로 재시도
    const finalUrl = imageUrl ?? (product.barcode ? await fetchNaverImage(product.name) : null)

    if (finalUrl) {
      const { error: updateError } = await supabase
        .from('products')
        .update({ image_url: finalUrl })
        .eq('id', product.id)

      if (!updateError) {
        updated++
        results.push({ id: product.id, name: product.name, image_url: finalUrl, status: 'ok' })
      } else {
        failed++
        results.push({ id: product.id, name: product.name, image_url: null, status: 'db_error' })
      }
    } else {
      failed++
      results.push({ id: product.id, name: product.name, image_url: null, status: 'not_found' })
    }

    // API 과부하 방지: 100ms 간격
    await new Promise(r => setTimeout(r, 100))
  }

  return NextResponse.json({
    total: products.length,
    updated,
    failed,
    results,
  })
}
