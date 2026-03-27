import { NextResponse } from 'next/server'
import { getNaverAuthHeaders, BASE_URL } from '@/lib/naver/auth'

export async function GET() {
  const headers = await getNaverAuthHeaders()
  const from = new Date()
  from.setDate(from.getDate() - 30)

  const res = await fetch(
    `${BASE_URL}/external/v1/pay-order/seller/product-orders?from=${from.toISOString()}`,
    { headers }
  )
  const data = await res.json()

  // 실제 응답 구조의 최상위 키 + pagination 위치 파악
  return NextResponse.json({
    topLevelKeys: Object.keys(data),
    dataKeys: data.data ? Object.keys(data.data) : null,
    contentsLength: data.data?.contents?.length ?? data.contents?.length ?? 0,
    paginationViaData: data.data?.pagination ?? null,
    paginationDirect: data.pagination ?? null,
    nextTokenViaData: data.data?.pagination?.nextToken ?? null,
    nextTokenDirect: data.nextToken ?? null,
    totalElements: data.data?.pagination?.totalElements ?? data.totalElements ?? null,
  })
}
