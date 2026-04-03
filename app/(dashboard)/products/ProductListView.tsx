'use client'

import type { Product } from '@/lib/types'

interface Props {
  products: Product[]
  onSelect: (p: Product) => void
}

function fmt(n: number) {
  return new Intl.NumberFormat('ko-KR').format(n)
}

function margin(buy: number, sell: number) {
  if (sell === 0) return 0
  return Math.round(((sell - buy) / sell) * 100)
}

// 카테고리별 좌측 강조 색
const CAT_BAR: Record<string, string> = {
  '필기구': 'bg-blue-400',
  '용지':   'bg-yellow-400',
  '노트':   'bg-green-400',
  '바인더': 'bg-purple-400',
  '메모':   'bg-pink-400',
  '파일':   'bg-orange-400',
  '책상용품': 'bg-teal-400',
  '사무용품': 'bg-indigo-400',
}

const CAT_TEXT: Record<string, string> = {
  '필기구': 'text-blue-600',
  '용지':   'text-yellow-600',
  '노트':   'text-green-600',
  '바인더': 'text-purple-600',
  '메모':   'text-pink-600',
  '파일':   'text-orange-500',
  '책상용품': 'text-teal-600',
  '사무용품': 'text-indigo-600',
}

export default function ProductListView({ products, onSelect }: Props) {
  return (
    <div className="divide-y divide-gray-100">
      {products.map(p => {
        const m       = margin(p.buy_price, p.sell_price)
        const barColor  = CAT_BAR[p.category ?? '']  ?? 'bg-gray-300'
        const textColor = CAT_TEXT[p.category ?? ''] ?? 'text-gray-500'

        return (
          <div
            key={p.id}
            onClick={() => onSelect(p)}
            className="relative flex items-stretch hover:bg-blue-50/30 transition-colors cursor-pointer group"
          >
            {/* 좌측 카테고리 강조 바 */}
            <div className={`w-1 shrink-0 ${barColor} opacity-60 group-hover:opacity-100 transition-opacity`} />

            <div className="flex-1 px-5 py-3.5 min-w-0">
              {/* 1행: 상품명 + 판매가 */}
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="text-sm font-semibold text-[#1d1d1f] truncate">{p.name}</p>
                  {p.is_bundle && (
                    <span className="shrink-0 text-[10px] font-medium bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5">세트</span>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-[#1d1d1f] tabular-nums">{fmt(p.sell_price)}원</p>
                  <p className="text-[11px] text-[#86868b]">매입 {fmt(p.buy_price)}원</p>
                </div>
              </div>

              {/* 2행: 바코드 · 카테고리 · 단위 · 마진율 · 안전재고 */}
              <div className="flex items-center gap-3 flex-wrap">
                {p.barcode && (
                  <span className="font-mono text-[11px] text-[#86868b]">{p.barcode}</span>
                )}
                {p.barcode && <span className="text-gray-200">·</span>}

                {p.category && (
                  <span className={`text-xs font-medium ${textColor}`}>{p.category}</span>
                )}

                <span className="text-gray-200">·</span>
                <span className="text-xs text-[#86868b]">{p.unit}</span>

                <span className="text-gray-200">·</span>
                <span className={`text-xs font-semibold ${m >= 30 ? 'text-[#34c759]' : m >= 10 ? 'text-[#007aff]' : 'text-[#ff3b30]'}`}>
                  마진 {m}%
                </span>

                {p.min_stock > 0 && (
                  <>
                    <span className="text-gray-200">·</span>
                    <span className="text-xs text-[#86868b]">안전재고 {fmt(p.min_stock)}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
