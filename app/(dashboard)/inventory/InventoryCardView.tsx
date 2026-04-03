'use client'

import type { InventoryWithProduct } from '@/lib/supabase/inventory'

function fmt(n: number) { return new Intl.NumberFormat('ko-KR').format(n) }

const CATEGORY_COLORS: Record<string, string> = {
  '필기구': 'bg-blue-50 text-blue-600',
  '용지': 'bg-green-50 text-green-600',
  '노트': 'bg-orange-50 text-orange-600',
  '파일': 'bg-purple-50 text-purple-600',
  '사무용품': 'bg-red-50 text-red-600',
  '테이프': 'bg-sky-50 text-sky-600',
}

function categoryClass(cat?: string) {
  if (!cat) return 'bg-gray-50 text-[#86868b]'
  return CATEGORY_COLORS[cat] ?? 'bg-blue-50 text-blue-600'
}

interface Props {
  items: InventoryWithProduct[]
  onSelect: (item: InventoryWithProduct) => void
}

export default function InventoryCardView({ items, onSelect }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-1">
      {items.map(item => {
        const isLow = item.quantity <= item.product.min_stock
        const value = item.quantity * item.product.buy_price
        const stockPct = item.product.min_stock > 0
          ? Math.min(100, Math.round((item.quantity / item.product.min_stock) * 100))
          : 100

        return (
          <div
            key={item.id}
            onClick={() => onSelect(item)}
            className="bg-white/80 backdrop-blur-xl border border-black/[0.06] rounded-2xl p-4 cursor-pointer hover:shadow-md transition-all duration-200"
          >
            {/* 카테고리 배지 */}
            <div className="flex items-center justify-between mb-3">
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${categoryClass(item.product.category)}`}>
                {item.product.category ?? '미분류'}
              </span>
              {item.product.is_bundle && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">세트</span>
              )}
            </div>

            {/* 상품명 */}
            <div className="text-sm font-semibold text-[#1d1d1f] leading-tight mb-1 line-clamp-2">{item.product.name}</div>
            <div className="text-xs text-[#86868b] mb-3">{item.warehouse.name}</div>

            <div className="border-t border-gray-100 pt-3 space-y-2">
              {/* 재고 수량 */}
              <div className="flex items-end justify-between">
                <span className="text-xs text-[#86868b]">현재 재고</span>
                <span className={`text-xl font-bold tabular-nums ${isLow ? 'text-[#ff3b30]' : 'text-[#1d1d1f]'}`}>
                  {fmt(item.quantity)}
                  <span className="text-xs font-normal text-[#86868b] ml-0.5">{item.product.unit}</span>
                </span>
              </div>

              {/* 재고 바 */}
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${isLow ? 'bg-[#ff3b30]' : 'bg-[#34c759]'}`}
                  style={{ width: `${stockPct}%` }}
                />
              </div>

              {/* 안전재고 / 금액 */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#86868b]">안전재고 {fmt(item.product.min_stock)}</span>
                <span className="font-medium text-[#1d1d1f]">₩{fmt(value)}</span>
              </div>
            </div>

            {isLow && (
              <div className="mt-2 flex items-center gap-1 text-[10px] font-medium text-[#ff3b30]">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                저재고 경고
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
