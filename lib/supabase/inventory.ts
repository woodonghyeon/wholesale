import { createClient } from '@/lib/supabase/client'
import type { Inventory, StockLog } from '@/lib/types'

export interface InventoryFilter {
  businessId: string
  warehouseId?: string
  category?: string
  search?: string
  lowStockOnly?: boolean
}

export interface InventoryWithProduct {
  id: string
  product_id: string
  business_id: string
  warehouse_id: string
  quantity: number
  updated_at: string
  product: {
    id: string
    name: string
    barcode?: string
    category?: string
    unit: string
    buy_price: number
    sell_price: number
    min_stock: number
    is_bundle: boolean
  }
  business: { id: string; name: string }
  warehouse: { id: string; name: string }
}

export async function fetchInventory(filter: InventoryFilter): Promise<InventoryWithProduct[]> {
  const supabase = createClient()
  let query = supabase
    .from('inventory')
    .select(`
      *,
      product:products(id, name, barcode, category, unit, buy_price, sell_price, min_stock, is_bundle),
      business:businesses(id, name),
      warehouse:warehouses(id, name)
    `)
    .order('updated_at', { ascending: false })

  if (filter.businessId !== 'all') {
    query = query.eq('business_id', filter.businessId)
  }
  if (filter.warehouseId) {
    query = query.eq('warehouse_id', filter.warehouseId)
  }

  const { data, error } = await query
  if (error) throw error

  let result = (data ?? []) as InventoryWithProduct[]

  if (filter.category) {
    result = result.filter(r => r.product?.category === filter.category)
  }
  if (filter.search) {
    const kw = filter.search.toLowerCase()
    result = result.filter(r =>
      r.product?.name.toLowerCase().includes(kw) ||
      (r.product?.barcode ?? '').toLowerCase().includes(kw) ||
      (r.product?.category ?? '').toLowerCase().includes(kw)
    )
  }
  if (filter.lowStockOnly) {
    result = result.filter(r => r.quantity <= (r.product?.min_stock ?? 0))
  }

  return result
}

export interface InventoryStats {
  totalSkus: number
  totalValue: number
  lowStockCount: number
  warehouseCount: number
}

export async function fetchInventoryStats(businessId: string): Promise<InventoryStats> {
  const supabase = createClient()
  let query = supabase
    .from('inventory')
    .select('quantity, product:products(buy_price, min_stock), warehouse_id')

  if (businessId !== 'all') {
    query = query.eq('business_id', businessId)
  }

  const { data, error } = await query
  if (error) throw error

  const rows = (data ?? []) as unknown as Array<{
    quantity: number
    product: { buy_price: number; min_stock: number } | null
    warehouse_id: string
  }>

  const warehouseSeen = new Set<string>()
  let totalValue = 0
  let lowStockCount = 0

  for (const r of rows) {
    totalValue += r.quantity * (r.product?.buy_price ?? 0)
    if (r.quantity <= (r.product?.min_stock ?? 0)) lowStockCount++
    if (r.warehouse_id) warehouseSeen.add(r.warehouse_id)
  }

  return {
    totalSkus: rows.length,
    totalValue,
    lowStockCount,
    warehouseCount: warehouseSeen.size,
  }
}

export async function adjustInventoryDirect(params: {
  productId: string
  businessId: string
  warehouseId: string
  newQuantity: number
  currentQuantity: number
  note?: string
}): Promise<void> {
  const supabase = createClient()
  const delta = params.newQuantity - params.currentQuantity
  const { error } = await supabase.rpc('adjust_inventory', {
    p_product_id: params.productId,
    p_business_id: params.businessId,
    p_warehouse_id: params.warehouseId,
    p_quantity: delta,
    p_note: params.note ?? '재고 직접 조정',
  })
  if (error) throw error
}

export async function fetchStockLogs(
  productId: string,
  businessId: string,
  limit = 20
): Promise<StockLog[]> {
  const supabase = createClient()
  let query = supabase
    .from('stock_logs')
    .select('*, product:products(id, name, unit)')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (businessId !== 'all') {
    query = query.eq('business_id', businessId)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as StockLog[]
}

export async function fetchWarehouses(businessId: string) {
  const supabase = createClient()
  let query = supabase.from('warehouses').select('id, name').order('name')
  if (businessId !== 'all') {
    query = query.eq('business_id', businessId)
  }
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}
