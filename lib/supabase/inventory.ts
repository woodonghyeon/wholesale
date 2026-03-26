import { createClient } from './client'

export interface InventoryRow {
  product_id: string
  product_name: string
  barcode: string | null
  category: string | null
  unit: string
  business_id: string | null
  warehouse_id: string
  warehouse_name: string
  quantity: number
  min_stock: number
  buy_price: number
  sell_price: number
}

export async function getInventory(businessId?: string, warehouseId?: string): Promise<InventoryRow[]> {
  const supabase = createClient()
  let query = supabase
    .from('inventory')
    .select(`
      product_id,
      quantity,
      business_id,
      warehouse_id,
      products ( name, barcode, category, unit, min_stock, buy_price, sell_price ),
      warehouses ( name )
    `)
    .order('quantity', { ascending: false })

  if (businessId && businessId !== 'all') query = query.eq('business_id', businessId)
  if (warehouseId && warehouseId !== 'all') query = query.eq('warehouse_id', warehouseId)

  const { data, error } = await query
  if (error) throw new Error('재고 조회 실패: ' + error.message)

  return (data ?? []).map((row: any) => ({
    product_id: row.product_id,
    product_name: row.products?.name ?? '-',
    barcode: row.products?.barcode ?? null,
    category: row.products?.category ?? null,
    unit: row.products?.unit ?? 'ea',
    business_id: row.business_id,
    warehouse_id: row.warehouse_id,
    warehouse_name: row.warehouses?.name ?? '-',
    quantity: row.quantity,
    min_stock: row.products?.min_stock ?? 0,
    buy_price: row.products?.buy_price ?? 0,
    sell_price: row.products?.sell_price ?? 0,
  }))
}

export async function adjustInventory(payload: {
  product_id: string
  business_id: string
  warehouse_id: string
  quantity: number
  note?: string
}): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.rpc('adjust_inventory', {
    p_product_id: payload.product_id,
    p_business_id: payload.business_id,
    p_warehouse_id: payload.warehouse_id,
    p_quantity: payload.quantity,
    p_note: payload.note ?? null,
  })
  if (error) throw new Error('재고 조정 실패: ' + error.message)
}
