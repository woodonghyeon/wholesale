export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { sendTelegram, isTelegramConfigured } from '@/lib/telegram'
import { getApiSetting } from '@/lib/supabase/api-settings'

async function sendTelegramWithCredentials(
  botToken: string,
  chatId: string,
  text: string
): Promise<void> {
  const res = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    }
  )
  if (!res.ok) {
    const err = await res.text()
    let parsed: { description?: string } = {}
    try { parsed = JSON.parse(err) } catch { /* 무시 */ }
    throw new Error(`텔레그램 전송 실패 (${res.status}): ${parsed.description ?? err}`)
  }
}

export async function GET(req: NextRequest) {
  const businessId = req.nextUrl.searchParams.get('business_id') ?? undefined
  const long = req.nextUrl.searchParams.get('long') === '1'
  const text = long
    ? Array.from({ length: 20 }, (_, i) => `${i + 1}. 테스트 메시지 라인`).join('\n')
    : '✅ <b>도매 관리 시스템</b>\n텔레그램 알림 연결 테스트 성공!'

  // ── 사업자별 DB 인증 정보 사용 ──
  if (businessId) {
    try {
      const setting = await getApiSetting(businessId, 'telegram')
      const botToken = setting?.credentials?.bot_token?.trim()
      const chatId   = setting?.credentials?.chat_id?.trim()

      if (!botToken) {
        return NextResponse.json({
          success: false,
          error: 'Bot Token이 등록되지 않았습니다. 설정 > 외부연동 > 텔레그램 등록을 먼저 해주세요.',
        })
      }
      if (!chatId) {
        return NextResponse.json({
          success: false,
          error: 'Chat ID가 등록되지 않았습니다. 설정 > 외부연동 > 텔레그램에서 Chat ID를 입력해주세요.',
        })
      }

      await sendTelegramWithCredentials(botToken, chatId, text)
      return NextResponse.json({ success: true, message: '텔레그램 메시지 전송 성공!', source: 'db' })
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      return NextResponse.json({ success: false, error })
    }
  }

  // ── env 폴백 ──
  if (!isTelegramConfigured()) {
    return NextResponse.json({
      success: false,
      error: 'TELEGRAM_BOT_TOKEN 또는 TELEGRAM_CHAT_ID가 설정되지 않았습니다.',
    })
  }

  try {
    await sendTelegram(text)
    return NextResponse.json({ success: true, message: '텔레그램 메시지 전송 완료', source: 'env' })
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error })
  }
}
