export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

/**
 * GET /api/settings/env-check
 * 현재 서버에 로드된 환경변수 설정 여부를 반환 (값 자체는 노출 안 함)
 */
export async function GET() {
  return NextResponse.json({
    naver: {
      hasClientId:     !!process.env.NAVER_COMMERCE_CLIENT_ID,
      hasClientSecret: !!process.env.NAVER_COMMERCE_CLIENT_SECRET,
      configured:      !!(process.env.NAVER_COMMERCE_CLIENT_ID && process.env.NAVER_COMMERCE_CLIENT_SECRET),
    },
    telegram: {
      hasBotToken: !!process.env.TELEGRAM_BOT_TOKEN,
      hasChatId:   !!process.env.TELEGRAM_CHAT_ID,
      configured:  !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
    },
  })
}
