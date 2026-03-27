import { NextResponse } from 'next/server'
import { sendTelegram, isTelegramConfigured } from '@/lib/telegram'

export async function GET() {
  if (!isTelegramConfigured()) {
    return NextResponse.json(
      { success: false, error: 'TELEGRAM_BOT_TOKEN 또는 TELEGRAM_CHAT_ID가 설정되지 않았습니다.' },
      { status: 400 }
    )
  }

  try {
    await sendTelegram('✅ <b>도매 관리 시스템</b>\n텔레그램 알림 연결 테스트 성공!')
    return NextResponse.json({ success: true, message: '텔레그램 메시지 전송 완료' })
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error }, { status: 500 })
  }
}
