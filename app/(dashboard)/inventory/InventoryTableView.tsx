'use client'

import type { InventoryWithProduct } from '@/lib/supabase/inventory'

function fmt(n: number) { return new Intl.NumberFormat('ko-KR').format(n) }

interface Props {
  items: InventoryWithProduct[]
  onSelect: (item: InventoryWithProduct) => void
}

export default function InventoryTableView({ items, onSelect }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-100">
            {['상품명', '바코드', '카테고리', '단위', '창고', '현재수량', '안전재고', '상태', '재고금액'].map(h => (
              <th key={h} className="text-left py-2.5 px-3 font-medium text-[#86868b] whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map((item, i) => {
            const isLow = item.quantity <= item.product.min_stock
            return (
              <tr
                key={item.id}
                onClick={() => onSelect(item)}
                className={`cursor-pointer hover:bg-blue-50/40 transition-colors ${i % 2 === 1 ? 'bg-gray-50/40' : ''}`}
              >
                <td className="py-2.5 px-3 font-medium text-[#1d1d1f] max-w-[160px] truncate">
                  {item.product.name}
                  {item.product.is_bundle && (
                    <span className="ml-1.5 px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 text-[10px]">세트</span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-[#86868b]">{item.product.barcode ?? '-'}</td>
                <td className="py-2.5 px-3 text-[#86868b]">{item.product.category ?? '-'}</td>
                <td className="py-2.5 px-3 text-[#86868b]">{item.product.unit}</td>
                <td className="py-2.5 px-3 text-[#86868b]">{item.warehouse.name}</td>
                <td className={`py-2.5 px-3 font-semibold tabular-nums ${isLow ? 'text-[#ff3b30]' : 'text-[#1d1d1f]'}`}>
                  {fmt(item.quantity)}
                </td>
                <td className="py-2.5 px-3 text-[#86868b] tabular-nums">{fmt(item.product.min_stock)}</td>
                <td className="py-2.5 px-3">
                  {isLow ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-[#ff3b30] text-[10px] font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#ff3b30]" />
                      저재고
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-[#34c759] text-[10px] font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#34c759]" />
                      정상
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-3 tabular-nums text-[#1d1d1f]">
                  ₩{fmt(item.quantity * item.product.buy_price)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
