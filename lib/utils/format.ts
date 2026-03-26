/**
 * 금액 포맷 (천단위 콤마, 소수점 없음)
 */
export function formatMoney(value: number): string {
  return Math.round(value).toLocaleString('ko-KR')
}

/**
 * 날짜 포맷 (YYYY-MM-DD)
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toISOString().slice(0, 10)
}

/**
 * 전표번호 생성
 */
export function generateSlipNo(type: 'sale' | 'purchase' | 'quote', seq: number): string {
  const prefix = type === 'sale' ? 'S' : type === 'purchase' ? 'P' : 'Q'
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const padded = String(seq).padStart(4, '0')
  return `${prefix}-${date}-${padded}`
}
