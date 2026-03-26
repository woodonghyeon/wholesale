// ══════════════════════════════════════
// 공통 타입
// ══════════════════════════════════════

export type SlipType = 'sale' | 'purchase'
export type LogType = 'in' | 'out' | 'return_in' | 'return_out' | 'transfer_in' | 'transfer_out' | 'adjustment' | 'bundle_out'
export type PaymentMethod = 'cash' | 'transfer' | 'card' | 'note'
export type PaymentType = 'receive' | 'pay'
export type PartnerType = 'supplier' | 'customer' | 'both'
export type PriceType = 'partner' | 'grade' | 'quantity'
export type StocktakeStatus = 'open' | 'reviewing' | 'done'
export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired'
export type PurchaseOrderStatus = 'pending' | 'partial' | 'done' | 'cancelled'
export type ReturnReason = 'simple' | 'defect' | 'wrong_delivery' | 'other'
export type ReturnDisposition = 'restock' | 'dispose' | 'return_to_supplier'
export type ReturnStatus = 'received' | 'inspecting' | 'done'
export type NoteType = 'receivable' | 'payable'
export type NoteStatus = 'pending' | 'cleared' | 'bounced'
export type InvoiceType = 'issue' | 'receive' | 'amendment'
export type InvoiceStatus = 'draft' | 'issued' | 'cancelled'
export type CashType = 'in' | 'out'

// ══════════════════════════════════════
// 1. 기준 정보 타입
// ══════════════════════════════════════

export interface Business {
  id: string
  name: string
  business_no: string | null
  owner_name: string | null
  address: string | null
  phone: string | null
  email: string | null
  sort_order: number
  created_at: string
}

export interface Channel {
  id: string
  name: string
  commission_rate: number
  payment_fee_rate: number
  shipping_fee: number
  sort_order: number
}

export interface Warehouse {
  id: string
  business_id: string | null
  name: string
  address: string | null
  note: string | null
  created_at: string
}

export interface Partner {
  id: string
  name: string
  partner_type: PartnerType
  contact: string | null
  email: string | null
  phone: string | null
  address: string | null
  business_no: string | null
  credit_limit: number
  note: string | null
  created_at: string
}

export interface Staff {
  id: string
  business_id: string | null
  name: string
  phone: string | null
  email: string | null
  price_grade: number
  note: string | null
  is_active: boolean
  created_at: string
}

// ══════════════════════════════════════
// 2. 상품 타입
// ══════════════════════════════════════

export interface Product {
  id: string
  business_id: string | null
  barcode: string | null
  name: string
  category: string | null
  unit: string
  buy_price: number
  sell_price: number
  min_stock: number
  is_bundle: boolean
  note: string | null
  created_at: string
}

export interface ProductPrice {
  id: string
  product_id: string
  price_type: PriceType
  partner_id: string | null
  grade: number | null
  min_quantity: number
  price: number
  effective_from: string
  note: string | null
}

export interface BundleItem {
  id: string
  bundle_product_id: string
  component_product_id: string
  quantity: number
}

// ══════════════════════════════════════
// 3. 재고 타입
// ══════════════════════════════════════

export interface Inventory {
  id: string
  product_id: string
  business_id: string
  warehouse_id: string
  quantity: number
  updated_at: string
}

export interface StockLog {
  id: string
  product_id: string
  business_id: string
  warehouse_id: string
  log_type: LogType
  quantity: number
  unit_price: number | null
  ref_type: string | null
  ref_id: string | null
  partner_id: string | null
  channel_id: string | null
  staff_id: string | null
  note: string | null
  created_at: string
}

export interface StocktakeSession {
  id: string
  business_id: string
  warehouse_id: string
  name: string
  status: StocktakeStatus
  started_at: string
  closed_at: string | null
}

export interface StocktakeItem {
  id: string
  session_id: string
  product_id: string
  system_quantity: number
  actual_quantity: number | null
  difference: number
  counted_at: string | null
}

// ══════════════════════════════════════
// 4. 거래 타입
// ══════════════════════════════════════

export interface Slip {
  id: string
  slip_no: string | null
  slip_type: SlipType
  business_id: string
  partner_id: string | null
  staff_id: string | null
  channel_id: string | null
  warehouse_id: string | null
  slip_date: string
  due_date: string | null
  payment_type: 'cash' | 'credit' | 'mixed'
  cash_amount: number
  supply_amount: number
  tax_amount: number
  total_amount: number
  memo: string | null
  is_tax_invoice: boolean
  tax_invoice_no: string | null
  created_at: string
}

export interface SlipItem {
  id: string
  slip_id: string
  product_id: string | null
  product_name: string | null
  quantity: number
  unit_price: number
  supply_amount: number | null
  tax_amount: number
  note: string | null
  sort_order: number
}

// ══════════════════════════════════════
// 5. 외상 타입
// ══════════════════════════════════════

export interface Payment {
  id: string
  business_id: string
  partner_id: string
  payment_type: PaymentType
  payment_method: PaymentMethod
  amount: number
  payment_date: string
  ref_slip_id: string | null
  note: string | null
  created_at: string
}

// ══════════════════════════════════════
// 6. 어음 타입
// ══════════════════════════════════════

export interface Note {
  id: string
  business_id: string
  note_type: NoteType
  partner_id: string
  amount: number
  issue_date: string
  due_date: string
  bank_name: string | null
  note_no: string | null
  status: NoteStatus
  note: string | null
  created_at: string
}

// ══════════════════════════════════════
// 7. 현금 출납 타입
// ══════════════════════════════════════

export interface CashBook {
  id: string
  business_id: string
  cash_type: CashType
  amount: number
  category: string | null
  description: string | null
  cash_date: string
  ref_slip_id: string | null
  created_at: string
}

// ══════════════════════════════════════
// 8. 견적서·발주서 타입
// ══════════════════════════════════════

export interface Quote {
  id: string
  quote_no: string | null
  business_id: string
  partner_id: string | null
  staff_id: string | null
  quote_date: string
  valid_until: string | null
  status: QuoteStatus
  total_amount: number
  note: string | null
  created_at: string
}

export interface QuoteItem {
  id: string
  quote_id: string
  product_id: string | null
  product_name: string | null
  quantity: number
  unit_price: number
  amount: number | null
  note: string | null
  sort_order: number
}

export interface PurchaseOrder {
  id: string
  order_no: string | null
  business_id: string
  partner_id: string | null
  warehouse_id: string | null
  expected_date: string
  status: PurchaseOrderStatus
  note: string | null
  created_at: string
}

export interface PurchaseOrderItem {
  id: string
  order_id: string
  product_id: string | null
  quantity: number
  received_quantity: number
  unit_price: number | null
}

// ══════════════════════════════════════
// 9. 반품 타입
// ══════════════════════════════════════

export interface Return {
  id: string
  business_id: string
  partner_id: string | null
  product_id: string | null
  quantity: number
  reason: ReturnReason | null
  disposition: ReturnDisposition | null
  status: ReturnStatus
  restock_done: boolean
  ref_slip_id: string | null
  note: string | null
  created_at: string
}

// ══════════════════════════════════════
// 10. 정기 구매 고객 타입
// ══════════════════════════════════════

export interface RegularCustomer {
  id: string
  business_id: string
  partner_id: string | null
  order_cycle_days: number
  last_order_date: string | null
  channel_id: string | null
  note: string | null
  created_at: string
}

export interface RegularCustomerItem {
  id: string
  customer_id: string
  product_id: string | null
  usual_quantity: number
  usual_price: number | null
}

// ══════════════════════════════════════
// 11. 세금계산서 타입
// ══════════════════════════════════════

export interface TaxInvoice {
  id: string
  business_id: string
  partner_id: string | null
  ref_slip_id: string | null
  invoice_type: InvoiceType
  invoice_no: string | null
  supply_amount: number
  tax_amount: number
  total_amount: number
  issue_date: string
  status: InvoiceStatus
  hometax_synced: boolean
  note: string | null
  created_at: string
}

// ══════════════════════════════════════
// 12. 채널 주문 타입
// ══════════════════════════════════════

export interface ChannelOrder {
  id: string
  business_id: string
  channel: string
  external_order_id: string
  order_status: string | null
  ordered_at: string | null
  synced_at: string
  raw_data: Record<string, unknown> | null
  is_processed: boolean
  ref_slip_id: string | null
}

export interface ChannelOrderItem {
  id: string
  order_id: string
  product_id: string | null
  external_product_id: string | null
  product_name: string | null
  quantity: number | null
  unit_price: number | null
  is_matched: boolean
}

// ══════════════════════════════════════
// 13. 매출 목표 타입
// ══════════════════════════════════════

export interface SalesTarget {
  id: string
  business_id: string
  year_month: string
  target_revenue: number
  target_profit: number | null
  created_at: string
}

// ══════════════════════════════════════
// 14. 기본 거래처 타입
// ══════════════════════════════════════

export interface ProductDefaultPartner {
  id: string
  product_id: string
  partner_id: string
}
