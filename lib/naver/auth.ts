import bcrypt from 'bcryptjs'

const CLIENT_ID = process.env.NAVER_COMMERCE_CLIENT_ID!
const CLIENT_SECRET = process.env.NAVER_COMMERCE_CLIENT_SECRET!
export const BASE_URL = 'https://api.commerce.naver.com'

// ── 토큰 캐시 (프로세스 메모리, 만료 1분 전 갱신) ──────────────────────
let _tokenCache: { token: string; expiresAt: number } | null = null

async function generateSignature(timestamp: number): Promise<string> {
  const password = `${CLIENT_ID}_${timestamp}`
  const hashed = await bcrypt.hash(password, CLIENT_SECRET)
  return Buffer.from(hashed).toString('base64')
}

export async function getNaverAccessToken(): Promise<string> {
  const now = Date.now()
  // 캐시된 토큰이 있고 만료까지 60초 이상 남았으면 재사용
  if (_tokenCache && _tokenCache.expiresAt > now + 60_000) {
    return _tokenCache.token
  }

  const timestamp = now
  const signature = await generateSignature(timestamp)

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: CLIENT_ID,
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

  _tokenCache = { token, expiresAt: now + expiresIn * 1000 }
  return token
}

export async function getNaverAuthHeaders(): Promise<Record<string, string>> {
  const token = await getNaverAccessToken()
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}
