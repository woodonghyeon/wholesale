import { createClient } from '@supabase/supabase-js'

export type ApiProvider = 'naver_commerce' | 'telegram'

// ── 입력값 정규화 ────────────────────────────────────────────────
// 1. .env.local 파일에서 직접 복사 시 \$ → $ (dotenv 이스케이프 복원)
//    예: \$2a\$04\$... → $2a$04$...
// 2. 한국어 Windows에서 ₩(U+20A9) → $ (bcrypt salt 구분자 복원)
// 3. 앞뒤 공백/개행 제거
function normalizeValue(val: string): string {
  return val
    .trim()
    .replace(/\\\$/g, '$')    // dotenv 이스케이프: \$ → $
    .replace(/\u20A9/g, '$')  // 한국어 원화기호: ₩ → $
}

export interface NaverCredentials {
  client_id: string
  client_secret: string
}

export interface TelegramCredentials {
  bot_token: string
  chat_id: string
}

export interface ApiSetting {
  id: string
  business_id: string
  provider: ApiProvider
  credentials: Record<string, string>
  is_active: boolean
  updated_at: string
}

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/** 특정 사업자의 특정 provider 설정 조회 */
export async function getApiSetting(
  businessId: string,
  provider: ApiProvider
): Promise<ApiSetting | null> {
  const supabase = adminClient()
  const { data } = await supabase
    .from('business_api_settings')
    .select('*')
    .eq('business_id', businessId)
    .eq('provider', provider)
    .eq('is_active', true)
    .maybeSingle()
  return data ?? null
}

/** 특정 사업자의 모든 API 설정 조회 */
export async function getApiSettings(businessId: string): Promise<ApiSetting[]> {
  const supabase = adminClient()
  const { data } = await supabase
    .from('business_api_settings')
    .select('*')
    .eq('business_id', businessId)
    .order('provider')
  return data ?? []
}

/** 모든 사업자의 모든 API 설정 조회 (설정 페이지용) */
export async function getAllApiSettings(): Promise<ApiSetting[]> {
  const supabase = adminClient()
  const { data } = await supabase
    .from('business_api_settings')
    .select('*')
    .order('business_id')
    .order('provider')
  return data ?? []
}

/** API 설정 저장 (upsert) */
export async function upsertApiSetting(
  businessId: string,
  provider: ApiProvider,
  credentials: Record<string, string>
): Promise<ApiSetting> {
  const supabase = adminClient()
  const { data, error } = await supabase
    .from('business_api_settings')
    .upsert(
      { business_id: businessId, provider, credentials, is_active: true },
      { onConflict: 'business_id,provider' }
    )
    .select('*')
    .single()
  if (error) throw new Error('API 설정 저장 실패: ' + error.message)
  return data
}

/** API 설정 비활성화 (삭제 대신) */
export async function deleteApiSetting(
  businessId: string,
  provider: ApiProvider
): Promise<void> {
  const supabase = adminClient()
  const { error } = await supabase
    .from('business_api_settings')
    .delete()
    .eq('business_id', businessId)
    .eq('provider', provider)
  if (error) throw new Error('API 설정 삭제 실패: ' + error.message)
}

/** 네이버 Commerce API 인증 정보 조회 (DB 우선, 없으면 env 폴백) */
export async function getNaverCredentials(businessId?: string): Promise<{
  clientId: string
  clientSecret: string
  source: 'db' | 'env'
}> {
  // DB에서 먼저 조회
  if (businessId) {
    const setting = await getApiSetting(businessId, 'naver_commerce')
    if (setting) {
      const { client_id, client_secret } = setting.credentials ?? {}
      if (client_id && client_secret) {
        // 정규화: trim + 한국어 ₩(U+20A9) → $ 변환
        const id  = normalizeValue(client_id)
        const sec = normalizeValue(client_secret)

        // bcrypt 형식 검증: Naver client_secret은 반드시 $2a$ / $2b$ 로 시작
        if (!sec.startsWith('$2')) {
          throw new Error(
            `Client Secret 형식 오류 (앞 4자리: "${sec.slice(0, 4)}"). ` +
            `네이버 커머스 API의 Client Secret은 "$2a$10$..." 형태로 시작해야 합니다. ` +
            `설정 > 외부연동 > 수정에서 값을 다시 입력해주세요.`
          )
        }
        return { clientId: id, clientSecret: sec, source: 'db' }
      }
      if (client_id && !client_secret) {
        // Client ID만 있고 Secret이 없는 경우 — env도 확인
        const envSecret = process.env.NAVER_COMMERCE_CLIENT_SECRET ?? ''
        if (envSecret) {
          return { clientId: client_id, clientSecret: envSecret, source: 'env' }
        }
        throw new Error(
          'Client Secret이 저장되지 않았습니다. 설정 > 외부연동 > 수정에서 다시 입력해주세요.'
        )
      }
    }
  }

  // businessId 없을 때 — DB에서 네이버 설정이 있는 첫 번째 사업자 자동 탐색
  if (!businessId) {
    const supabase = adminClient()
    const { data: anySetting } = await supabase
      .from('business_api_settings')
      .select('*')
      .eq('provider', 'naver_commerce')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    if (anySetting) {
      const { client_id, client_secret } = anySetting.credentials ?? {}
      if (client_id && client_secret) {
        const id  = normalizeValue(client_id)
        const sec = normalizeValue(client_secret)
        if (!sec.startsWith('$2')) {
          throw new Error(
            `Client Secret 형식 오류 (앞 4자리: "${sec.slice(0, 4)}"). ` +
            `네이버 커머스 API의 Client Secret은 "$2a$10$..." 형태로 시작해야 합니다. ` +
            `설정 > 외부연동 > 수정에서 값을 다시 입력해주세요.`
          )
        }
        return { clientId: id, clientSecret: sec, source: 'db' }
      }
    }
  }

  // 환경변수 폴백
  const clientId = process.env.NAVER_COMMERCE_CLIENT_ID ?? ''
  const clientSecret = process.env.NAVER_COMMERCE_CLIENT_SECRET ?? ''
  if (!clientId || !clientSecret) {
    throw new Error(
      '네이버 API 인증 정보가 없습니다.\n' +
      '설정 > 외부연동에서 사업자별 API 키(Client ID + Client Secret)를 등록해주세요.'
    )
  }
  return { clientId, clientSecret, source: 'env' }
}
