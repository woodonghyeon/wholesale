const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const CHAT_ID = process.env.TELEGRAM_CHAT_ID

export function isTelegramConfigured(): boolean {
  return !!(BOT_TOKEN && CHAT_ID)
}

/**
 * 텔레그램 메시지 전송
 * HTML 파싱 모드 사용 (<b>, <i>, <code> 태그 지원)
 */
export async function sendTelegram(text: string): Promise<void> {
  if (!isTelegramConfigured()) return

  const res = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        parse_mode: 'HTML',
      }),
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`텔레그램 전송 실패 (${res.status}): ${err}`)
  }
}

/** 신규 주문 알림 */
export function buildOrderAlert(count: number, orders: { productName: string; totalPaymentAmount: number; ordererName: string }[]): string {
  const total = orders.reduce((s, o) => s + o.totalPaymentAmount, 0)
  const lines = orders.slice(0, 5).map(o =>
    `• ${o.productName} — ${o.totalPaymentAmount.toLocaleString()}원 (${o.ordererName})`
  )
  if (orders.length > 5) lines.push(`외 ${orders.length - 5}건 더`)

  return [
    `🛒 <b>네이버 신규 주문 ${count}건</b>`,
    `💰 합계: <b>${total.toLocaleString()}원</b>`,
    '',
    ...lines,
  ].join('\n')
}

/** 반품·취소 알림 */
export function buildClaimAlert(count: number, claims: { productName: string; claimType: string }[]): string {
  const typeLabel: Record<string, string> = { RETURN: '반품', CANCEL: '취소', EXCHANGE: '교환' }
  const lines = claims.slice(0, 5).map(c =>
    `• [${typeLabel[c.claimType] ?? c.claimType}] ${c.productName}`
  )
  if (claims.length > 5) lines.push(`외 ${claims.length - 5}건 더`)

  return [
    `⚠️ <b>반품·취소 ${count}건 발생</b>`,
    '',
    ...lines,
  ].join('\n')
}
