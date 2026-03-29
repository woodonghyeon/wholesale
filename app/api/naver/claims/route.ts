export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getNaverClaims } from '@/lib/naver/claims'

export async function GET(req: NextRequest) {
  const days = Number(req.nextUrl.searchParams.get('days') ?? '30')
  try {
    const claims = await getNaverClaims(days)
    return NextResponse.json({ success: true, count: claims.length, claims })
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error }, { status: 500 })
  }
}
