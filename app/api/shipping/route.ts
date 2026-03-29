export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// 택배사별 추적 URL
const CARRIER_URLS: Record<string, string> = {
  'CJ대한통운': 'https://trace.cjlogistics.com/next/tracking.html?wblNo=',
  '우체국': 'https://service.epost.go.kr/trace.RetrieveEmsRigiTraceList.comm?sid1=',
  '롯데택배': 'https://www.lotteglogis.com/home/reservation/tracking/linkView?InvNo=',
  '한진택배': 'https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillResult.do?mCode=MN038&schLang=KR&wbl_num=',
  '로젠택배': 'https://www.ilogen.com/web/personal/trace/',
  '쿠팡로켓': 'https://www.coupang.com/np/search?q=',
  '직접배송': '',
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const businessId = searchParams.get('businessId')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const status = searchParams.get('status')
  const q = searchParams.get('q')

  const supabase = adminClient()
  let query = supabase
    .from('shipping_labels')
    .select('*')
    .order('created_at', { ascending: false })

  if (businessId && businessId !== 'all') query = query.eq('business_id', businessId)
  if (from) query = query.gte('shipped_at', from)
  if (to) query = query.lte('shipped_at', to)
  if (status) query = query.eq('status', status)
  if (q) query = query.or(`tracking_no.ilike.%${q}%,recipient_name.ilike.%${q}%,product_name.ilike.%${q}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [], carriers: Object.keys(CARRIER_URLS) })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const supabase = adminClient()
  const { data, error } = await supabase.from('shipping_labels').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function PATCH(req: NextRequest) {
  const { id, ...updates } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const supabase = adminClient()
  const { data, error } = await supabase.from('shipping_labels').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const supabase = adminClient()
  const { error } = await supabase.from('shipping_labels').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
