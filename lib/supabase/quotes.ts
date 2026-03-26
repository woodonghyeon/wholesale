import { createClient } from './client'
import { Quote, QuoteItem, QuoteStatus, PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus } from '@/lib/types'

export interface QuoteWithItems extends Quote {
  items: QuoteItem[]
  partner_name?: string
}

export interface PurchaseOrderWithItems extends PurchaseOrder {
  items: (PurchaseOrderItem & { product_name?: string })[]
  partner_name?: string
}

// ── 견적서 ──
export async function getQuotes(businessId?: string): Promise<QuoteWithItems[]> {
  const supabase = createClient()
  let query = supabase
    .from('quotes')
    .select('*, partners(name), quote_items(*)')
    .order('quote_date', { ascending: false })
  if (businessId && businessId !== 'all') query = query.eq('business_id', businessId)
  const { data, error } = await query
  if (error) throw new Error('견적서 조회 실패: ' + error.message)
  return (data ?? []).map((r: any) => ({ ...r, items: r.quote_items ?? [], partner_name: r.partners?.name ?? null }))
}

export async function createQuote(
  quote: Omit<Quote, 'id' | 'quote_no' | 'created_at'>,
  items: Omit<QuoteItem, 'id' | 'quote_id'>[]
): Promise<Quote> {
  const supabase = createClient()
  const { data, error } = await supabase.from('quotes').insert(quote).select().single()
  if (error) throw new Error('견적서 생성 실패: ' + error.message)
  if (items.length > 0) {
    const { error: ie } = await supabase.from('quote_items').insert(items.map((item, i) => ({ ...item, quote_id: data.id, sort_order: i })))
    if (ie) throw new Error('품목 저장 실패: ' + ie.message)
  }
  return data
}

export async function updateQuoteStatus(id: string, status: QuoteStatus): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('quotes').update({ status }).eq('id', id)
  if (error) throw new Error('상태 변경 실패: ' + error.message)
}

export async function deleteQuote(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('quotes').delete().eq('id', id)
  if (error) throw new Error('삭제 실패: ' + error.message)
}

// ── 발주서 ──
export async function getPurchaseOrders(businessId?: string): Promise<PurchaseOrderWithItems[]> {
  const supabase = createClient()
  let query = supabase
    .from('purchase_orders')
    .select('*, partners(name), purchase_order_items(*, products(name))')
    .order('expected_date', { ascending: true })
  if (businessId && businessId !== 'all') query = query.eq('business_id', businessId)
  const { data, error } = await query
  if (error) throw new Error('발주서 조회 실패: ' + error.message)
  return (data ?? []).map((r: any) => ({
    ...r,
    partner_name: r.partners?.name ?? null,
    items: (r.purchase_order_items ?? []).map((item: any) => ({
      ...item,
      product_name: item.products?.name ?? null,
    })),
  }))
}

export async function createPurchaseOrder(
  order: Omit<PurchaseOrder, 'id' | 'order_no' | 'created_at'>,
  items: Omit<PurchaseOrderItem, 'id' | 'order_id'>[]
): Promise<PurchaseOrder> {
  const supabase = createClient()
  const { data, error } = await supabase.from('purchase_orders').insert(order).select().single()
  if (error) throw new Error('발주서 생성 실패: ' + error.message)
  if (items.length > 0) {
    const { error: ie } = await supabase.from('purchase_order_items').insert(items.map(item => ({ ...item, order_id: data.id })))
    if (ie) throw new Error('품목 저장 실패: ' + ie.message)
  }
  return data
}

export async function updateOrderStatus(id: string, status: PurchaseOrderStatus): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('purchase_orders').update({ status }).eq('id', id)
  if (error) throw new Error('상태 변경 실패: ' + error.message)
}

export async function deletePurchaseOrder(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('purchase_orders').delete().eq('id', id)
  if (error) throw new Error('삭제 실패: ' + error.message)
}
