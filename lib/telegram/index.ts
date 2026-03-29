const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const CHAT_ID = process.env.TELEGRAM_CHAT_ID

export function isTelegramConfigured(): boolean {
  return !!(BOT_TOKEN && CHAT_ID)
}

const MAX_LEN = 4096

/**
 * 텔레그램 단일 청크 전송 (내부용)
 */
async function sendChunk(text: string): Promise<void> {
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

/**
 * 텔레그램 메시지 전송
 * 4096자 초과 시 줄 단위로 자동 분할하여 순차 전송
 * HTML 파싱 모드 사용 (<b>, <i>, <code> 태그 지원)
 */
export async function sendTelegram(text: string): Promise<void> {
  if (!isTelegramConfigured()) return

  if (text.length <= MAX_LEN) {
    await sendChunk(text)
    return
  }

  // 줄 단위로 분할하여 4096자 이하 청크로 묶기
  const lines = text.split('\n')
  let chunk = ''
  for (const line of lines) {
    const candidate = chunk ? chunk + '\n' + line : line
    if (candidate.length > MAX_LEN) {
      if (chunk) await sendChunk(chunk)
      // 단일 줄이 MAX_LEN 초과하는 극단적 경우
      chunk = line.slice(0, MAX_LEN)
    } else {
      chunk = candidate
    }
  }
  if (chunk) await sendChunk(chunk)
}

/** 신규 주문 알림 (전체 목록, 자동 분할 전송은 sendTelegram에서 처리) */
export function buildOrderAlert(
  count: number,
  orders: { productName: string; totalPaymentAmount: number; ordererName: string; productOption?: string; quantity?: number }[]
): string {
  const total = orders.reduce((s, o) => s + o.totalPaymentAmount, 0)
  const lines = orders.map(o => {
    const option = o.productOption ? ` / ${o.productOption}` : ''
    const qty = o.quantity && o.quantity > 1 ? ` × ${o.quantity}개` : ''
    return `• ${o.productName}${option}${qty} — ${o.totalPaymentAmount.toLocaleString()}원 (${o.ordererName})`
  })
  return [
    `🛒 <b>네이버 신규 주문 ${count}건</b>`,
    `💰 합계: <b>${total.toLocaleString()}원</b>`,
    '',
    ...lines,
  ].join('\n')
}

/** 반품·취소 알림 (전체 목록) */
export function buildClaimAlert(count: number, claims: { productName: string; claimType: string }[]): string {
  const typeLabel: Record<string, string> = { RETURN: '반품', CANCEL: '취소', EXCHANGE: '교환' }
  const lines = claims.map(c =>
    `• [${typeLabel[c.claimType] ?? c.claimType}] ${c.productName}`
  )
  return [
    `⚠️ <b>반품·취소 ${count}건 발생</b>`,
    '',
    ...lines,
  ].join('\n')
}
