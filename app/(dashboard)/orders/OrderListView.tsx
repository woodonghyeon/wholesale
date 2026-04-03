'use client'

import type { Order } from './types'
import { STATUS_LABEL, fmt } from './types'

interface Props {
  orders: Order[]
  onSelect: (order: Order) => void
}

// 상태별 좌측 강조 색
const STATUS_BAR: Record<string, string> = {
  payment_waiting: 'bg-yellow-400',
  paid:            'bg-green-400',
  shipping:        'bg-blue-400',
  delivered:       'bg-emerald-400',
  confirmed:       'bg-purple-400',
  cancel_request:  'bg-orange-400',
  return_request:  'bg-orange-400',
  exchange_request:'bg-indigo-400',
  cancelled:       'bg-red-400',
  returned:        'bg-red-300',
  exchanged:       'bg-indigo-300',
}

const STATUS_TEXT: Record<string, string> = {
  payment_waiting: 'text-yellow-600',
  paid:            'text-green-600',
  shipping:        'text-blue-600',
  delivered:       'text-emerald-600',
  confirmed:       'text-purple-600',
  cancel_request:  'text-orange-500',
  return_request:  'text-orange-500',
  exchange_request:'text-indigo-500',
  cancelled:       'text-red-500',
  returned:        'text-red-400',
  exchanged:       'text-indigo-400',
}

export default function OrderListView({ orders, onSelect }: Props) {
  return (
    <div className="divide-y divide-gray-100">
      {orders.map(order => {
        const barColor  = STATUS_BAR[order.order_status]  ?? 'bg-gray-300'
        const textColor = STATUS_TEXT[order.order_status] ?? 'text-gray-500'
        const label     = STATUS_LABEL[order.order_status] ?? order.order_status
        const isSameRecipient = order.receiver_name === order.buyer_name

        return (
          <div
            key={order.id}
            onClick={() => onSelect(order)}
            className="relative flex items-stretch gap-0 hover:bg-blue-50/30 transition-colors cursor-pointer group"
          >
            {/* 좌측 상태 강조 바 */}
            <div className={`w-1 shrink-0 ${barColor} opacity-70 group-hover:opacity-100 transition-opacity`} />

            {/* 콘텐츠 */}
            <div className="flex-1 px-5 py-3.5 min-w-0">
              {/* 1행: 채널 뱃지 + 상품명 + 금액 */}
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold bg-green-50 text-green-600 border border-green-100">
                    N
                  </span>
                  <p className="text-sm font-semibold text-[#1d1d1f] truncate">
                    {order.product_name || '—'}
                  </p>
                  {order.option_info && (
                    <span className="shrink-0 text-xs text-[#86868b] bg-gray-100 rounded px-1.5 py-0.5 truncate max-w-[120px]">
                      {order.option_info}
                    </span>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-[#1d1d1f] tabular-nums">
                    {fmt(order.total_amount)}원
                  </p>
                  {order.shipping_fee > 0 && (
                    <p className="text-[11px] text-[#86868b]">+{fmt(order.shipping_fee)} 배송비</p>
                  )}
                </div>
              </div>

              {/* 2행: 구매자 · 주소 · 수량 · 날짜 · 상태 */}
              <div className="flex items-center gap-3 flex-wrap">
                {/* 구매자 → 수령인 */}
                <span className="flex items-center gap-1 text-xs text-[#86868b]">
                  <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="text-[#1d1d1f] font-medium">{order.buyer_name || '—'}</span>
                  {!isSameRecipient && order.receiver_name && (
                    <>
                      <span className="text-gray-300">→</span>
                      <span>{order.receiver_name}</span>
                    </>
                  )}
                </span>

                {/* 주소 */}
                {order.receiver_address && (
                  <>
                    <span className="text-gray-200">·</span>
                    <span className="flex items-center gap-1 text-xs text-[#86868b] max-w-[200px] truncate">
                      <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {order.receiver_address}
                    </span>
                  </>
                )}

                {/* 수량 */}
                <span className="text-gray-200">·</span>
                <span className="text-xs text-[#86868b]">{order.quantity}개</span>

                {/* 날짜 */}
                <span className="text-gray-200">·</span>
                <span className="text-xs text-[#86868b]">
                  {new Date(order.ordered_at).toLocaleDateString('ko-KR')}
                </span>

                {/* 주문번호 */}
                <span className="text-gray-200">·</span>
                <span className="font-mono text-[11px] text-[#86868b]">
                  ...{(order.external_product_order_id ?? order.external_order_id).slice(-8)}
                </span>

                {/* 상태 (우측 정렬) */}
                <span className={`ml-auto text-xs font-semibold ${textColor}`}>
                  {label}
                </span>
              </div>
            </div>

            {/* 미처리 표시 */}
            {!order.is_processed && (
              <div className="shrink-0 flex items-center pr-4">
                <span className="w-1.5 h-1.5 rounded-full bg-[#007aff]" title="미처리" />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
