import { NextResponse } from 'next/server'
import { getNaverAccessToken } from '@/lib/naver/auth'

export async function GET() {
  try {
    const token = await getNaverAccessToken()

    return NextResponse.json({
      success: true,
      token_preview: token.slice(0, 20) + '...',
      message: '네이버 커머스 API 토큰 발급 성공!',
    })
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      {
        success: false,
        error,
        hint: 'CLIENT_ID / CLIENT_SECRET 값 또는 앱 권한 설정을 확인하세요.',
      },
      { status: 500 }
    )
  }
}
