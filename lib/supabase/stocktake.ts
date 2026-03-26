import { createClient } from './client'
import { StocktakeSession, StocktakeItem } from '../types'

export type SessionRow = StocktakeSession & { warehouse_name?: string }
export type ItemRow = StocktakeItem & { product_name?: string; barcode?: string }

export async function getStocktakeSessions(businessId?: string): Promise<SessionRow[]> {
  const supabase = createClient()
  let q = supabase.from('stocktake_sessions').select('*, warehouses(name)').order('started_at', { ascending: false })
  if (businessId) q = q.eq('business_id', businessId)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []).map((r: any) => ({ ...r, warehouse_name: r.warehouses?.name ?? null }))
}

export async function createStocktakeSession(session: {
  business_id: string
  warehouse_id: string
  name: string
}): Promise<SessionRow> {
  const supabase = createClient()
  const payload = { ...session, status: 'open', started_at: new Date().toISOString() }
  const { data, error } = await supabase.from('stocktake_sessions').insert(payload).select('*, warehouses(name)').single()
  if (error) throw new Error(error.message)

  // Populate items from current inventory
  const { data: invData } = await supabase
    .from('inventory')
    .select('product_id, quantity')
    .eq('warehouse_id', session.warehouse_id)
    .eq('business_id', session.business_id)

  const items = (invData ?? []).map((inv: any) => ({
    session_id: data.id,
    product_id: inv.product_id,
    system_quantity: inv.quantity,
    actual_quantity: null,
    difference: 0,
  }))
  if (items.length > 0) {
    await supabase.from('stocktake_items').insert(items)
  }

  return { ...data, warehouse_name: (data as any).warehouses?.name ?? null }
}

export async function getStocktakeItems(sessionId: string): Promise<ItemRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('stocktake_items')
    .select('*, products(name, barcode)')
    .eq('session_id', sessionId)
    .order('id')
  if (error) throw new Error(error.message)
  return (data ?? []).map((r: any) => ({
    ...r,
    product_name: r.products?.name ?? null,
    barcode: r.products?.barcode ?? null,
  }))
}

export async function updateStocktakeItem(id: string, actualQty: number, systemQty: number) {
  const supabase = createClient()
  const { error } = await supabase.from('stocktake_items').update({
    actual_quantity: actualQty,
    difference: actualQty - systemQty,
    counted_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function applyStocktakeAdjustments(sessionId: string) {
  const supabase = createClient()

  const { data: session } = await supabase
    .from('stocktake_sessions')
    .select('warehouse_id, business_id')
    .eq('id', sessionId)
    .single()

  const { data: items } = await supabase
    .from('stocktake_items')
    .select('product_id, actual_quantity, system_quantity, difference')
    .eq('session_id', sessionId)
    .not('actual_quantity', 'is', null)
    .neq('difference', 0)

  for (const item of items ?? []) {
    await supabase.rpc('adjust_inventory', {
      p_product_id: item.product_id,
      p_business_id: session!.business_id,
      p_warehouse_id: session!.warehouse_id,
      p_delta: item.difference,
      p_log_type: 'adjustment',
      p_note: `재고 실사 조정`,
    })
  }

  const { error } = await supabase
    .from('stocktake_sessions')
    .update({ status: 'done', closed_at: new Date().toISOString() })
    .eq('id', sessionId)
  if (error) throw new Error(error.message)
}

export async function updateSessionStatus(id: string, status: 'open' | 'reviewing' | 'done') {
  const supabase = createClient()
  const payload: any = { status }
  if (status === 'done') payload.closed_at = new Date().toISOString()
  const { error } = await supabase.from('stocktake_sessions').update(payload).eq('id', id)
  if (error) throw new Error(error.message)
}
