export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getNaverAccessToken } from '@/lib/naver/auth'

export async function GET(req: NextRequest) {
  const businessId = req.nextUrl.searchParams.get('business_id') ?? undefined

  try {
    const token = await getNaverAccessToken(businessId)

    return NextResponse.json({
      success: true,
      token_preview: token.slice(0, 20) + '...',
      message: '네이버 커머스 API 토큰 발급 성공!',
      source: businessId ? `사업자 DB 키 (${businessId})` : '환경변수',
    })
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err)
    // 500이 아닌 200으로 반환 — 프론트엔드에서 success:false 처리
    return NextResponse.json({
      success: false,
      error,
      hint: 'Client ID / Client Secret 값 또는 앱 권한 설정을 확인하세요.',
    })
  }
}
