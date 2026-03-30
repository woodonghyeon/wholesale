export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { runNaverAutoSync } from '@/lib/naver/auto-sync'

/**
 * 네이버 자동 동기화 수동 트리거
 * GET /api/naver/auto-sync
 * — 텔레그램 알림 포함, cron과 동일한 로직 즉시 실행
 */
export async function GET() {
  try {
    const result = await runNaverAutoSync()
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 })
  }
}
