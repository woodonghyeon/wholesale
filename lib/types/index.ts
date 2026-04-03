// ============================================================
// 열거형 타입
// ============================================================

export type SlipType = 'sale' | 'purchase'
export type LogType = 'in' | 'out' | 'return_in' | 'return_out' | 'transfer_in' | 'transfer_out' | 'adjustment' | 'bundle_out'
export type PaymentMethod = 'cash' | 'transfer' | 'card' | 'note'
export type PaymentType = 'cash' | 'credit' | 'mixed'
export type PartnerType = 'supplier' | 'customer' | 'both'
export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired'
export type OrderStatus = 'pending' | 'partial' | 'done' | 'cancelled'
export type NoteType = 'receivable' | 'payable'
export type NoteStatus = 'pending' | 'cleared' | 'bounced'
export type ReturnStatus = 'received' | 'inspecting' | 'approved' | 'rejected'
export type ReturnDisposition = 'restock' | 'discard' | 'repair'
export type StocktakeStatus = 'open' | 'reviewing' | 'done'
export type InvoiceType = 'issue' | 'receive' | 'amendment'
export type CashType = 'in' | 'out'

// ============================================================
// 사업자 / 조직
// ============================================================

export interface Business {
  id: string
  name: string
  business_no: string
  owner_name: string
  phone?: string
  email?: string
  address?: string
  sort_order: number
  created_at: string
}

export interface Channel {
  id: string
  business_id?: string
  name: string
  commission_rate: number       // %
  payment_fee_rate: number      // %
  shipping_fee: number          // 원
  platform_type?: string
  sort_order: number
  created_at: string
  business?: Business
}

export interface Warehouse {
  id: string
  business_id: string
  name: string
  address?: string
  created_at: string
  business?: Business
}

// ============================================================
// 거래처 / 직원
// ============================================================

export interface Partner {
  id: string
  name: string
  partner_type: PartnerType
  phone?: string
  email?: string
  address?: string
  business_no?: string
  credit_limit: number
  note?: string
  created_at: string
}

export interface Staff {
  id: string
  business_id: string
  name: string
  role: string
  phone?: string
  email?: string
  created_at: string
}

// ============================================================
// 상품
// ============================================================

export interface Product {
  id: string
  business_id: string
  barcode?: string
  name: string
  category?: string
  unit: string
  buy_price: number
  sell_price: number
  min_stock: number
  is_bundle: boolean
  note?: string
  created_at: string
  business?: Business
}

export interface ProductPrice {
  id: string
  partner_id: string
  product_id: string
  channel_id?: string
  unit_price: number
  created_at: string
  partner?: Partner
  product?: Product
  channel?: Channel
}

export interface BundleItem {
  id: string
  bundle_product_id: string
  component_product_id: string
  quantity: number
  component?: Product
}

// ============================================================
// 재고
// ============================================================

export interface Inventory {
  id: string
  product_id: string
  business_id: string
  warehouse_id: string
  quantity: number
  updated_at: string
  product?: Product
  business?: Business
  warehouse?: Warehouse
}

export interface StockLog {
  id: string
  product_id: string
  business_id?: string
  warehouse_id?: string
  log_type: LogType
  quantity: number
  ref_type?: string
  ref_id?: string
  note?: string
  created_at: string
  product?: Product
}

export interface StocktakeSession {
  id: string
  business_id: string
  warehouse_id: string
  name: string
  status: StocktakeStatus
  created_at: string
  updated_at: string
  business?: Business
  warehouse?: Warehouse
  items?: StocktakeItem[]
}

export interface StocktakeItem {
  id: string
  session_id: string
  product_id: string
  system_quantity: number
  actual_quantity: number
  difference: number
  product?: Product
}

// ============================================================
// 거래전표
// ============================================================

export interface Slip {
  id: string
  slip_no: string
  slip_type: SlipType
  business_id: string
  partner_id?: string
  channel_id?: string
  warehouse_id?: string
  slip_date: string
  payment_type: PaymentType
  supply_amount: number
  tax_amount: number
  total_amount: number
  paid_amount: number
  memo?: string
  tax_invoice_issued: boolean
  created_at: string
  business?: Business
  partner?: Partner
  channel?: Channel
  warehouse?: Warehouse
  items?: SlipItem[]
}

export interface SlipItem {
  id: string
  slip_id: string
  product_id: string
  quantity: number
  unit_price: number
  supply_amount: number
  tax_amount: number
  product?: Product
}

// ============================================================
// 결제 / 채권채무
// ============================================================

export interface Payment {
  id: string
  slip_id?: string
  partner_id: string
  payment_type: 'receive' | 'pay'
  payment_method: PaymentMethod
  amount: number
  payment_date: string
  memo?: string
  created_at: string
  partner?: Partner
}

export interface Note {
  id: string
  business_id: string
  partner_id?: string
  note_type: NoteType
  amount: number
  issue_date: string
  due_date: string
  bank?: string
  note_no?: string
  status: NoteStatus
  memo?: string
  created_at: string
  business?: Business
  partner?: Partner
}

export interface CashBook {
  id: string
  business_id: string
  cash_type: CashType
  amount: number
  category: string
  description?: string
  cash_date: string
  created_at: string
  business?: Business
}

// ============================================================
// 견적서 / 발주서
// ============================================================

export interface Quote {
  id: string
  quote_no: string
  business_id: string
  partner_id: string
  quote_date: string
  valid_until?: string
  status: QuoteStatus
  supply_amount: number
  tax_amount: number
  total_amount: number
  memo?: string
  created_at: string
  business?: Business
  partner?: Partner
  items?: QuoteItem[]
}

export interface QuoteItem {
  id: string
  quote_id: string
  product_id: string
  quantity: number
  unit_price: number
  supply_amount: number
  tax_amount: number
  product?: Product
}

export interface PurchaseOrder {
  id: string
  order_no: string
  business_id: string
  partner_id: string
  order_date: string
  expected_date?: string
  status: OrderStatus
  supply_amount: number
  tax_amount: number
  total_amount: number
  memo?: string
  created_at: string
  business?: Business
  partner?: Partner
  items?: PurchaseOrderItem[]
}

export interface PurchaseOrderItem {
  id: string
  order_id: string
  product_id: string
  quantity: number
  received_quantity: number
  unit_price: number
  supply_amount: number
  tax_amount: number
  product?: Product
}

// ============================================================
// 반품
// ============================================================

export interface Return {
  id: string
  business_id: string
  partner_id?: string
  product_id: string
  slip_id?: string
  quantity: number
  reason?: string
  disposition?: ReturnDisposition
  status: ReturnStatus
  restock_done: boolean
  created_at: string
  business?: Business
  partner?: Partner
  product?: Product
}

// ============================================================
// 세금계산서
// ============================================================

export interface TaxInvoice {
  id: string
  business_id: string
  slip_id?: string
  partner_id?: string
  invoice_type: InvoiceType
  invoice_no?: string
  invoice_date: string
  supply_amount: number
  tax_amount: number
  total_amount: number
  status: 'draft' | 'issued' | 'cancelled'
  hometax_synced: boolean
  memo?: string
  created_at: string
  business?: Business
  partner?: Partner
}

// ============================================================
// 고객 / 채널 주문
// ============================================================

export interface RegularCustomer {
  id: string
  business_id: string
  name: string
  phone?: string
  email?: string
  address?: string
  memo?: string
  total_purchase: number
  visit_count: number
  last_visit?: string
  created_at: string
}

export interface ChannelOrder {
  id: string
  external_order_id: string
  channel_id?: string
  business_id?: string
  order_status: string
  ordered_at: string
  buyer_name?: string
  buyer_phone?: string
  receiver_name?: string
  receiver_phone?: string
  receiver_address?: string
  total_amount: number
  raw_data?: Record<string, unknown>
  is_processed: boolean
  ref_slip_id?: string
  created_at: string
  items?: ChannelOrderItem[]
}

export interface ChannelOrderItem {
  id: string
  order_id: string
  product_id?: string
  product_name: string
  quantity: number
  unit_price: number
  total_price: number
}

// ============================================================
// 활동 로그
// ============================================================

export interface ActivityLog {
  id: string
  user_id?: string
  action_type: string
  resource_type: string
  resource_id?: string
  description: string
  metadata?: Record<string, unknown>
  ip_address?: string
  user_agent?: string
  created_at: string
}

// ============================================================
// 통계 / 집계
// ============================================================

export interface DashboardStats {
  monthSales: number
  monthPurchase: number
  monthProfit: number
  inventoryValue: number
  lowStockCount: number
  salesTrend: { month: string; amount: number }[]
  recentSlips: Slip[]
}

export interface SalesTarget {
  id: string
  business_id: string
  channel_id?: string
  year: number
  month: number
  target_amount: number
  actual_amount?: number
}
