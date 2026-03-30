export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/** GET /api/products/list?business_id=... — 상품 목록 (간략) */
export async function GET(req: NextRequest) {
  const businessId = req.nextUrl.searchParams.get('business_id')

  let query = adminClient()
    .from('products')
    .select('id, name, sell_price, barcode, category, image_url, business_id')
    .order('name')

  if (businessId && businessId !== 'all') {
    query = query.eq('business_id', businessId)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
