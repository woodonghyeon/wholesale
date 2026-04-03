export interface ChannelConfig {
  clientId: string
  clientSecret: string
  businessId?: string
  channelId?: string
}

export interface OrderFetchParams {
  fromDate: Date
  toDate: Date
  status?: string
}

export interface MappedOrder {
  business_id?: string
  channel_id?: string
  platform_type: string
  external_order_id: string
  external_product_order_id?: string
  order_status: string
  ordered_at: string
  buyer_name?: string
  buyer_phone?: string
  buyer_email?: string
  receiver_name?: string
  receiver_phone?: string
  receiver_address?: string
  receiver_zipcode?: string
  product_name?: string
  option_info?: string
  quantity: number
  unit_price: number
  total_amount: number
  shipping_fee: number
  commission_amount: number
  tracking_number?: string
  shipping_company?: string
  raw_data: Record<string, unknown>
  updated_at: string
}

export interface SyncResult {
  synced: number
  errors: string[]
}
