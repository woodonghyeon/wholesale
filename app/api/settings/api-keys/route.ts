export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import {
  getAllApiSettings,
  getApiSetting,
  upsertApiSetting,
  deleteApiSetting,
  ApiProvider,
} from '@/lib/supabase/api-settings'

/** GET /api/settings/api-keys */
export async function GET() {
  try {
    const settings = await getAllApiSettings()

    // credentials 마스킹 처리 (client_secret 등 민감 필드)
    const masked = settings.map(s => ({
      ...s,
      credentials: maskCredentials(s.provider as ApiProvider, s.credentials),
    }))

    return NextResponse.json({ success: true, settings: masked })
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error }, { status: 500 })
  }
}

/** POST /api/settings/api-keys — 저장 시 민감 필드 비어있으면 기존 값 유지 */
export async function POST(req: NextRequest) {
  try {
    const { business_id, provider, credentials } = await req.json()
    if (!business_id || !provider || !credentials) {
      return NextResponse.json({ success: false, error: '필수 파라미터 누락' }, { status: 400 })
    }

    // 모든 문자열 값 정규화
    // - trim: 복사-붙여넣기 시 개행문자·공백 제거
    // - normalizeCredential: 한국어 Windows에서 ₩(U+20A9)가 \로 입력되는 문제 보정
    //   bcrypt salt($2a$10$...) 및 텔레그램 bot_token 등에는 ₩이 사용되지 않음
    const trimmed: Record<string, string> = {}
    for (const [k, v] of Object.entries(credentials as Record<string, string>)) {
      trimmed[k] = typeof v === 'string' ? normalizeCredential(v) : v
    }

    // 기존 설정 조회 — 민감 필드가 비어있으면 기존 값 보존
    const existing = await getApiSetting(business_id, provider as ApiProvider)
    const mergedCredentials = { ...(existing?.credentials ?? {}), ...trimmed }

    // 빈 문자열 필드는 기존 값 유지
    const SENSITIVE_FIELDS = ['client_secret', 'bot_token']
    for (const field of SENSITIVE_FIELDS) {
      if (trimmed[field] === '' && existing?.credentials?.[field]) {
        mergedCredentials[field] = existing.credentials[field]
      }
    }

    const setting = await upsertApiSetting(business_id, provider as ApiProvider, mergedCredentials)
    return NextResponse.json({ success: true, setting })
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error }, { status: 500 })
  }
}

/** DELETE /api/settings/api-keys */
export async function DELETE(req: NextRequest) {
  try {
    const { business_id, provider } = await req.json()
    if (!business_id || !provider) {
      return NextResponse.json({ success: false, error: '필수 파라미터 누락' }, { status: 400 })
    }

    await deleteApiSetting(business_id, provider as ApiProvider)
    return NextResponse.json({ success: true })
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error }, { status: 500 })
  }
}

// ── 입력값 정규화 ────────────────────────────────────────────────
// 1. .env.local에서 직접 복사 시 \$ → $ (dotenv 이스케이프 복원)
//    .env 파일에서 \$2a\$04\$... 형태로 저장된 값을 그대로 붙여넣으면
//    브라우저에는 \$가 그대로 들어오므로 $로 변환 필요
// 2. 한국어 Windows에서 ₩(U+20A9) → $ (bcrypt salt 구분자 복원)
// 3. 앞뒤 공백/개행 제거
function normalizeCredential(val: string): string {
  return val
    .trim()
    .replace(/\\\$/g, '$')    // dotenv 이스케이프: \$ → $
    .replace(/\u20A9/g, '$')  // 한국어 원화기호: ₩ → $
}

// ── 민감 필드 마스킹 ─────────────────────────────────────────────
function maskCredentials(
  provider: ApiProvider,
  credentials: Record<string, string>
): Record<string, string> {
  const masked = { ...credentials }
  const sensitiveKeys = ['client_secret', 'bot_token']
  for (const key of sensitiveKeys) {
    if (masked[key]) {
      const val = masked[key]
      masked[key] = val.length > 8 ? val.slice(0, 4) + '****' + val.slice(-4) : '****'
    }
  }
  return masked
}
