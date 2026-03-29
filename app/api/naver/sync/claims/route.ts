export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getNaverClaims } from '@/lib/naver/claims'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const REASON_MAP: Record<string, string> = {
  SIMPLE_CHANGING_MIND: 'simple',
  DEFECTIVE_PRODUCT: 'defect',
  WRONG_DELIVERY: 'wrong_delivery',
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const days: number = body.days ?? 30
    const businessId: string | undefined = body.business_id

    if (!businessId) {
      return NextResponse.json({ success: false, error: 'business_id 필수' }, { status: 400 })
    }

    const supabase = adminClient()

    // 1. 네이버 반품 클레임 조회
    const claims = await getNaverClaims(days)
    if (claims.length === 0) {
      return NextResponse.json({ success: true, synced: 0, message: '동기화할 반품 클레임 없음' })
    }

    // 2. 이미 동기화된 클레임 확인
    const { data: existingReturns } = await supabase
      .from('returns')
      .select('note')
      .like('note', '[naver]%')
    const syncedNotes = new Set((existingReturns ?? []).map(r => r.note))

    let synced = 0
    const errors: string[] = []

    for (const claim of claims) {
      const noteKey = `[naver]${claim.claimId}`
      if (syncedNotes.has(noteKey)) continue

      const reason = REASON_MAP[claim.claimReasonType] ?? 'other'
      const returnDate = claim.claimRequestDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)

      const { error } = await supabase.from('returns').insert({
        business_id: businessId,
        quantity: claim.quantity,
        reason,
        status: 'received',
        restock_done: false,
        note: noteKey,
        created_at: returnDate,
      })

      if (error) {
        errors.push(`클레임 ${claim.claimId}: ${error.message}`)
        continue
      }
      synced++
    }

    return NextResponse.json({
      success: true,
      total: claims.length,
      synced,
      skipped: claims.length - synced - errors.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error }, { status: 500 })
  }
}
