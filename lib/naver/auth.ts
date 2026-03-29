import bcrypt from 'bcryptjs'
import { getNaverCredentials } from '@/lib/supabase/api-settings'

export const BASE_URL = 'https://api.commerce.naver.com'

// ── 토큰 캐시 (사업자 ID별 or 기본) ────────────────────────────
const _tokenCache = new Map<string, { token: string; expiresAt: number }>()

async function generateSignature(clientId: string, clientSecret: string, timestamp: number): Promise<string> {
  const password = `${clientId}_${timestamp}`
  const hashed = await bcrypt.hash(password, clientSecret)
  return Buffer.from(hashed).toString('base64')
}

/**
 * 네이버 Commerce Access Token 발급
 * @param businessId 사업자 ID (없으면 env 폴백)
 */
export async function getNaverAccessToken(businessId?: string): Promise<string> {
  const cacheKey = businessId ?? '__default__'
  const now = Date.now()

  // 캐시된 토큰이 있고 만료까지 60초 이상 남았으면 재사용
  const cached = _tokenCache.get(cacheKey)
  if (cached && cached.expiresAt > now + 60_000) {
    return cached.token
  }

  // DB 또는 env에서 인증 정보 조회
  const { clientId, clientSecret } = await getNaverCredentials(businessId)

  const timestamp = now
  const signature = await generateSignature(clientId, clientSecret, timestamp)

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    timestamp: String(timestamp),
    client_secret_sign: signature,
    type: 'SELF',
  })

  const res = await fetch(`${BASE_URL}/external/v1/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`네이버 토큰 발급 실패 (${res.status}): ${error}`)
  }

  const data = await res.json()
  const token = data.access_token as string
  const expiresIn: number = data.expires_in ?? 3600  // 초 단위

  _tokenCache.set(cacheKey, { token, expiresAt: now + expiresIn * 1000 })
  return token
}

export async function getNaverAuthHeaders(businessId?: string): Promise<Record<string, string>> {
  const token = await getNaverAccessToken(businessId)
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}
