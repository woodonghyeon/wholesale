'use client'

import type { InventoryWithProduct } from '@/lib/supabase/inventory'

function fmt(n: number) { return new Intl.NumberFormat('ko-KR').format(n) }

const CATEGORY_COLORS: Record<string, string> = {
  '필기구': '#007aff',
  '용지': '#34c759',
  '노트': '#ff9f0a',
  '파일': '#af52de',
  '사무용품': '#ff3b30',
  '테이프': '#5ac8fa',
}

function categoryColor(cat?: string) {
  if (!cat) return '#86868b'
  return CATEGORY_COLORS[cat] ?? '#007aff'
}

interface Props {
  items: InventoryWithProduct[]
  onSelect: (item: InventoryWithProduct) => void
}

export default function InventoryListView({ items, onSelect }: Props) {
  return (
    <div className="divide-y divide-gray-100">
      {items.map(item => {
        const isLow = item.quantity <= item.product.min_stock
        const color = categoryColor(item.product.category)
        const value = item.quantity * item.product.buy_price
        return (
          <div
            key={item.id}
            onClick={() => onSelect(item)}
            className="flex items-stretch gap-0 cursor-pointer hover:bg-blue-50/40 transition-colors"
          >
            {/* 카테고리 컬러바 */}
            <div className="w-1 rounded-full my-2 ml-1 flex-shrink-0" style={{ backgroundColor: color }} />

            <div className="flex-1 flex items-center justify-between px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[#1d1d1f] truncate">{item.product.name}</span>
                  {item.product.is_bundle && (
                    <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 text-[10px] font-medium flex-shrink-0">세트</span>
                  )}
                  {isLow && (
                    <span className="px-1.5 py-0.5 rounded-full bg-red-50 text-[#ff3b30] text-[10px] font-medium flex-shrink-0">저재고</span>
                  )}
                </div>
                <div className="text-xs text-[#86868b] mt-0.5 flex items-center gap-2">
                  <span>{item.product.category ?? '미분류'}</span>
                  <span>·</span>
                  <span>{item.warehouse.name}</span>
                  {item.product.barcode && (
                    <>
                      <span>·</span>
                      <span>{item.product.barcode}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="text-right flex-shrink-0 ml-4">
                <div className={`text-sm font-semibold tabular-nums ${isLow ? 'text-[#ff3b30]' : 'text-[#1d1d1f]'}`}>
                  {fmt(item.quantity)} {item.product.unit}
                </div>
                <div className="text-xs text-[#86868b] tabular-nums">₩{fmt(value)}</div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
