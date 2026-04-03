'use client'

import type { Order } from './types'
import { STATUS_BADGE, STATUS_LABEL, fmt } from './types'

interface Props {
  orders: Order[]
  onSelect: (order: Order) => void
}

export default function OrderTableView({ orders, onSelect }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-3 py-2.5 text-left font-semibold text-[#86868b] w-[110px]">주문번호</th>
            <th className="px-3 py-2.5 text-left font-semibold text-[#86868b] w-[36px]">채널</th>
            <th className="px-3 py-2.5 text-left font-semibold text-[#86868b]">상품명</th>
            <th className="px-3 py-2.5 text-left font-semibold text-[#86868b] w-[80px]">옵션</th>
            <th className="px-3 py-2.5 text-left font-semibold text-[#86868b] w-[72px]">구매자</th>
            <th className="px-3 py-2.5 text-left font-semibold text-[#86868b] w-[72px]">수령인</th>
            <th className="px-3 py-2.5 text-right font-semibold text-[#86868b] w-[36px]">수량</th>
            <th className="px-3 py-2.5 text-right font-semibold text-[#86868b] w-[88px]">단가</th>
            <th className="px-3 py-2.5 text-right font-semibold text-[#86868b] w-[96px]">합계</th>
            <th className="px-3 py-2.5 text-right font-semibold text-[#86868b] w-[72px]">배송비</th>
            <th className="px-3 py-2.5 text-center font-semibold text-[#86868b] w-[72px]">상태</th>
            <th className="px-3 py-2.5 text-left font-semibold text-[#86868b] w-[84px]">주문일</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order, idx) => {
            const badge = STATUS_BADGE[order.order_status] ?? 'bg-gray-100 text-gray-700'
            const label = STATUS_LABEL[order.order_status] ?? order.order_status
            return (
              <tr
                key={order.id}
                onClick={() => onSelect(order)}
                className={`border-b border-gray-100 hover:bg-blue-50/40 transition-colors cursor-pointer ${
                  idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'
                }`}
              >
                <td className="px-3 py-2 font-mono text-[11px] text-[#86868b]">
                  {(order.external_product_order_id ?? order.external_order_id).slice(-10)}
                </td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold bg-green-50 text-green-600">N</span>
                </td>
                <td className="px-3 py-2 text-[#1d1d1f] font-medium max-w-[160px] truncate">
                  {order.product_name || '—'}
                </td>
                <td className="px-3 py-2 text-[#86868b] max-w-[80px] truncate">
                  {order.option_info || '—'}
                </td>
                <td className="px-3 py-2 text-[#1d1d1f]">{order.buyer_name || '—'}</td>
                <td className="px-3 py-2 text-[#1d1d1f]">{order.receiver_name || '—'}</td>
                <td className="px-3 py-2 text-right tabular-nums text-[#1d1d1f]">{order.quantity}</td>
                <td className="px-3 py-2 text-right tabular-nums text-[#86868b]">{fmt(order.unit_price)}</td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold text-[#1d1d1f]">{fmt(order.total_amount)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-[#86868b]">
                  {order.shipping_fee > 0 ? fmt(order.shipping_fee) : '—'}
                </td>
                <td className="px-3 py-2 text-center">
                  <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium ${badge}`}>{label}</span>
                </td>
                <td className="px-3 py-2 text-[#86868b] whitespace-nowrap">
                  {new Date(order.ordered_at).toLocaleDateString('ko-KR')}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
