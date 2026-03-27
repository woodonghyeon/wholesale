import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'

export interface BarcodeLookupResult {
  found: boolean
  source: 'db' | 'naver' | 'none'
  product?: {
    id?: string
    name: string
    barcode: string
    category?: string
    buy_price?: number
    sell_price?: number
    unit?: string
    image?: string
  }
}

export async function GET(req: NextRequest) {
  const barcode = req.nextUrl.searchParams.get('barcode')?.trim()
  if (!barcode) return NextResponse.json({ error: 'barcode required' }, { status: 400 })

  // 1. 내부 DB 조회
  const supabase = createClient()
  const { data: dbProduct } = await supabase
    .from('products')
    .select('id, name, barcode, category, buy_price, sell_price, unit')
    .eq('barcode', barcode)
    .maybeSingle()

  if (dbProduct) {
    return NextResponse.json({
      found: true,
      source: 'db',
      product: dbProduct,
    } satisfies BarcodeLookupResult)
  }

  // 2. Naver 쇼핑 검색 API (NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 필요)
  const clientId = process.env.NAVER_CLIENT_ID
  const clientSecret = process.env.NAVER_CLIENT_SECRET
  if (clientId && clientSecret) {
    try {
      const res = await fetch(
        `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(barcode)}&display=5`,
        {
          headers: {
            'X-Naver-Client-Id': clientId,
            'X-Naver-Client-Secret': clientSecret,
          },
        }
      )
      if (res.ok) {
        const json = await res.json()
        const item = json.items?.[0]
        if (item) {
          // HTML 태그 제거
          const name = item.title.replace(/<[^>]+>/g, '')
          const price = parseInt(item.lprice) || 0
          return NextResponse.json({
            found: true,
            source: 'naver',
            product: {
              name,
              barcode,
              category: [item.category1, item.category2, item.category3]
                .filter(Boolean)
                .slice(0, 2)
                .join(' > '),
              buy_price: Math.round(price * 0.7),
              sell_price: price,
              unit: 'ea',
              image: item.image,
            },
          } satisfies BarcodeLookupResult)
        }
      }
    } catch {
      // Naver API 실패 시 무시
    }
  }

  return NextResponse.json({ found: false, source: 'none' } satisfies BarcodeLookupResult)
}
