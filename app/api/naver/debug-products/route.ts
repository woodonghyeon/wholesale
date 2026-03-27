import { NextResponse } from 'next/server'
import { getNaverAuthHeaders, BASE_URL } from '@/lib/naver/auth'

export async function GET() {
  try {
    const headers = await getNaverAuthHeaders()
    // POST 방식 + 올바른 엔드포인트 시도
    const res = await fetch(
      `${BASE_URL}/external/v1/products/search`,
      {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productStatusType: 'SALE',
          page: 1,
          size: 10,
        }),
      }
    )
    const text = await res.text()
    return NextResponse.json({
      status: res.status,
      ok: res.ok,
      body: text,
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
