export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getNaverAuthHeaders, BASE_URL } from '@/lib/naver/auth'

export async function GET() {
  const headers = await getNaverAuthHeaders()
  const from = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)

  const res = await fetch(
    `${BASE_URL}/external/v1/pay-order/seller/product-orders?from=${from.toISOString()}`,
    { headers }
  )
  const data = await res.json()
  const firstItem = data.data?.contents?.[0]

  return NextResponse.json({
    topKeys: firstItem ? Object.keys(firstItem) : [],
    contentKeys: firstItem?.content ? Object.keys(firstItem.content) : [],
    orderKeys: firstItem?.content?.order ? Object.keys(firstItem.content.order) : [],
    productOrderKeys: firstItem?.content?.productOrder ? Object.keys(firstItem.content.productOrder) : [],
    sample: firstItem,
  })
}
