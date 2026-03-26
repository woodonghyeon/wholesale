import { createClient } from './client'

export interface StockLedgerRow {
  date: string
  product_id: string
  product_name: string
  warehouse_id: string
  warehouse_name: string
  in_qty: number       // 입고
  out_qty: number      // 출고
  adjust_qty: number   // 조정 (양수: 증가, 음수: 감소)
  return_qty: number   // 반품입고
  net_qty: number      // 순증감 = in + return + adjust - out
}

export interface MonthlyStockRow {
  month: string        // 'YYYY-MM'
  product_id: string
  product_name: string
  in_qty: number
  out_qty: number
  adjust_qty: number
  return_qty: number
  net_qty: number
}

export interface StockLedgerFilter {
  productId?: string
  warehouseId?: string
  from?: string
  to?: string
}

export async function getDailyStockLedger(filter: StockLedgerFilter = {}): Promise<StockLedgerRow[]> {
  const supabase = createClient()

  let q = supabase
    .from('stock_logs')
    .select('*, products(name), warehouses(name)')
    .order('created_at', { ascending: true })
    .limit(3000)

  if (filter.productId) q = q.eq('product_id', filter.productId)
  if (filter.warehouseId) q = q.eq('warehouse_id', filter.warehouseId)
  if (filter.from) q = q.gte('created_at', filter.from + 'T00:00:00')
  if (filter.to) q = q.lte('created_at', filter.to + 'T23:59:59')

  const { data, error } = await q
  if (error) throw new Error(error.message)

  // 날짜 × 상품 × 창고 기준 집계
  const map = new Map<string, StockLedgerRow>()
  for (const r of data ?? []) {
    const date = (r.created_at as string).slice(0, 10)
    const key = `${date}__${r.product_id}__${r.warehouse_id}`
    const existing = map.get(key) ?? {
      date,
      product_id: r.product_id,
      product_name: (r as any).products?.name ?? r.product_id,
      warehouse_id: r.warehouse_id,
      warehouse_name: (r as any).warehouses?.name ?? r.warehouse_id,
      in_qty: 0,
      out_qty: 0,
      adjust_qty: 0,
      return_qty: 0,
      net_qty: 0,
    }
    const qty: number = r.quantity ?? 0
    if (r.log_type === 'in') existing.in_qty += qty
    else if (r.log_type === 'out') existing.out_qty += Math.abs(qty)
    else if (r.log_type === 'return_in') existing.return_qty += qty
    else if (r.log_type === 'adjustment') {
      if (qty >= 0) existing.adjust_qty += qty
      else existing.out_qty += Math.abs(qty) // 음수 조정 → 출고로 표시
    }
    existing.net_qty = existing.in_qty + existing.return_qty + existing.adjust_qty - existing.out_qty
    map.set(key, existing)
  }

  return Array.from(map.values()).sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : a.product_name.localeCompare(b.product_name)
  )
}

export async function getMonthlyStockLedger(filter: StockLedgerFilter = {}): Promise<MonthlyStockRow[]> {
  const daily = await getDailyStockLedger(filter)
  const map = new Map<string, MonthlyStockRow>()
  for (const d of daily) {
    const month = d.date.slice(0, 7)
    const key = `${month}__${d.product_id}`
    const existing = map.get(key) ?? {
      month,
      product_id: d.product_id,
      product_name: d.product_name,
      in_qty: 0,
      out_qty: 0,
      adjust_qty: 0,
      return_qty: 0,
      net_qty: 0,
    }
    existing.in_qty += d.in_qty
    existing.out_qty += d.out_qty
    existing.adjust_qty += d.adjust_qty
    existing.return_qty += d.return_qty
    existing.net_qty += d.net_qty
    map.set(key, existing)
  }
  return Array.from(map.values()).sort((a, b) =>
    a.month < b.month ? -1 : a.month > b.month ? 1 : a.product_name.localeCompare(b.product_name)
  )
}

export interface StockLedgerSummary {
  total_in: number
  total_out: number
  total_adjust: number
  total_return: number
  net: number
}

export function calcStockSummary(rows: StockLedgerRow[]): StockLedgerSummary {
  return rows.reduce((acc, r) => ({
    total_in: acc.total_in + r.in_qty,
    total_out: acc.total_out + r.out_qty,
    total_adjust: acc.total_adjust + r.adjust_qty,
    total_return: acc.total_return + r.return_qty,
    net: acc.net + r.net_qty,
  }), { total_in: 0, total_out: 0, total_adjust: 0, total_return: 0, net: 0 })
}
