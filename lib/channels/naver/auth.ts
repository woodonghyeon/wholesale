import bcrypt from 'bcryptjs'

const TOKEN_ENDPOINT = 'https://api.commerce.naver.com/external/v1/oauth2/token'

let cachedToken: string | null = null
let tokenExpiry = 0

/**
 * Naver Commerce API OAuth2 토큰 발급
 * POST /external/v1/oauth2/token (form-urlencoded)
 * expires_in: ~10800초(3시간)
 */
export async function getNaverAccessToken(): Promise<string> {
  const now = Date.now()
  if (cachedToken && now < tokenExpiry) {
    return cachedToken
  }

  const clientId = process.env.NAVER_COMMERCE_CLIENT_ID
  const clientSecret = process.env.NAVER_COMMERCE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('NAVER_COMMERCE_CLIENT_ID 또는 NAVER_COMMERCE_CLIENT_SECRET 환경변수가 없습니다.')
  }

  const timestamp = now
  const hashed = bcrypt.hashSync(`${clientId}_${timestamp}`, clientSecret)
  const clientSecretSign = Buffer.from(hashed).toString('base64')

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    timestamp: String(timestamp),
    client_secret_sign: clientSecretSign,
    type: 'SELF',
  })

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Naver 토큰 발급 실패 ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = await res.json() as { access_token: string; expires_in: number }
  cachedToken = data.access_token
  // expires_in(초) - 5분 여유
  tokenExpiry = now + (data.expires_in - 300) * 1000
  return cachedToken
}

/** Authorization 헤더용 */
export async function getNaverAuthHeader(): Promise<string> {
  const token = await getNaverAccessToken()
  return `Bearer ${token}`
}
