export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/products/search-images?q=검색어&display=8
 * 네이버 쇼핑 API로 이미지 후보 목록 반환
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  const display = Math.min(parseInt(req.nextUrl.searchParams.get('display') ?? '8'), 10)

  if (!q) return NextResponse.json({ error: 'q required' }, { status: 400 })

  const clientId = process.env.NAVER_CLIENT_ID
  const clientSecret = process.env.NAVER_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 미설정' }, { status: 501 })
  }

  try {
    const res = await fetch(
      `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(q)}&display=${display}`,
      {
        headers: {
          'X-Naver-Client-Id': clientId,
          'X-Naver-Client-Secret': clientSecret,
        },
      }
    )
    if (!res.ok) {
      return NextResponse.json({ error: `Naver API error: ${res.status}` }, { status: 502 })
    }
    const json = await res.json()
    const items = (json.items ?? []).map((item: { image: string; title: string; lprice: string }) => ({
      image: item.image,
      title: item.title.replace(/<[^>]+>/g, ''),
      price: parseInt(item.lprice) || 0,
    }))
    return NextResponse.json({ items })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
