import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const supabase = createClient()

  let query = supabase
    .from('channel_orders')
    .select('*')
    .order('ordered_at', { ascending: false })
    .limit(200)

  const businessId = searchParams.get('businessId')
  if (businessId && businessId !== 'all') {
    query = query.eq('business_id', businessId)
  }

  const channelId = searchParams.get('channelId')
  if (channelId) query = query.eq('channel_id', channelId)

  const status = searchParams.get('status')
  if (status && status !== 'all') {
    if (status === 'cancelled') {
      query = query.in('order_status', ['cancelled', 'returned', 'cancel_request', 'return_request'])
    } else {
      query = query.eq('order_status', status)
    }
  }

  const from = searchParams.get('from')
  if (from) query = query.gte('ordered_at', from)

  const to = searchParams.get('to')
  if (to) query = query.lte('ordered_at', `${to}T23:59:59`)

  const search = searchParams.get('search')
  if (search) {
    query = query.or(
      `buyer_name.ilike.%${search}%,receiver_name.ilike.%${search}%,product_name.ilike.%${search}%,external_order_id.ilike.%${search}%`,
    )
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ orders: data ?? [], total: (data ?? []).length })
}
