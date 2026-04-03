'use client'

import type { Order } from './types'
import { STATUS_BADGE, STATUS_LABEL, fmt } from './types'

interface Props {
  orders: Order[]
  onSelect: (order: Order) => void
}

export default function OrderCardView({ orders, onSelect }: Props) {
  return (
    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {orders.map(order => {
        const badge = STATUS_BADGE[order.order_status] ?? 'bg-gray-100 text-gray-700'
        const label = STATUS_LABEL[order.order_status] ?? order.order_status
        const isSameRecipient = order.receiver_name === order.buyer_name

        return (
          <div
            key={order.id}
            onClick={() => onSelect(order)}
            className="border border-gray-100 rounded-xl p-3.5 hover:border-blue-200 hover:shadow-sm transition-all cursor-pointer bg-white"
          >
            {/* 헤더: 채널 + 주문번호 + 상태 */}
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold bg-green-50 text-green-700">N</span>
                <span className="font-mono text-xs text-[#86868b]">
                  ...{(order.external_product_order_id ?? order.external_order_id).slice(-8)}
                </span>
              </div>
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${badge}`}>
                {label}
              </span>
            </div>

            {/* 상품명 */}
            <p className="text-sm font-medium text-[#1d1d1f] line-clamp-2 mb-1 leading-snug">
              {order.product_name || '—'}
            </p>
            {order.option_info && (
              <p className="text-xs text-[#86868b] truncate mb-2">{order.option_info}</p>
            )}

            <div className="border-t border-gray-100 my-2.5" />

            {/* 구매자 / 수령인 */}
            <div className="flex items-start gap-1.5 mb-1">
              <svg className="w-3 h-3 text-[#86868b] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <p className="text-xs text-[#1d1d1f] truncate">
                {order.buyer_name || '—'}
                {!isSameRecipient && order.receiver_name && (
                  <span className="text-[#86868b]"> → {order.receiver_name}</span>
                )}
              </p>
            </div>
            {order.receiver_address && (
              <div className="flex items-start gap-1.5 mb-2.5">
                <svg className="w-3 h-3 text-[#86868b] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-xs text-[#86868b] line-clamp-1">{order.receiver_address}</p>
              </div>
            )}

            {/* 금액 + 날짜 */}
            <div className="flex items-end justify-between mt-auto">
              <div>
                <p className="text-xs text-[#86868b]">{order.quantity}개</p>
                <p className="text-base font-semibold text-[#1d1d1f] tabular-nums">{fmt(order.total_amount)}원</p>
              </div>
              <p className="text-xs text-[#86868b]">
                {new Date(order.ordered_at).toLocaleDateString('ko-KR')}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
