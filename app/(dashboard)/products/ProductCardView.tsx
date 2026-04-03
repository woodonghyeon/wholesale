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

const CAT_BADGE: Record<string, string> = {
  '필기구': 'bg-blue-50 text-blue-600',
  '용지':   'bg-yellow-50 text-yellow-700',
  '노트':   'bg-green-50 text-green-600',
  '바인더': 'bg-purple-50 text-purple-600',
  '메모':   'bg-pink-50 text-pink-600',
  '파일':   'bg-orange-50 text-orange-600',
  '책상용품': 'bg-teal-50 text-teal-600',
  '사무용품': 'bg-indigo-50 text-indigo-600',
}

export default function ProductCardView({ products, onSelect }: Props) {
  return (
    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {products.map(p => {
        const m = margin(p.buy_price, p.sell_price)
        const catBadge = CAT_BADGE[p.category ?? ''] ?? 'bg-gray-100 text-gray-500'

        return (
          <div
            key={p.id}
            onClick={() => onSelect(p)}
            className="border border-gray-100 rounded-xl p-3.5 hover:border-blue-200 hover:shadow-sm transition-all cursor-pointer bg-white"
          >
            {/* 헤더: 카테고리 뱃지 + 세트 여부 */}
            <div className="flex items-center justify-between mb-2.5">
              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${catBadge}`}>
                {p.category ?? '기타'}
              </span>
              {p.is_bundle && (
                <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">
                  세트
                </span>
              )}
            </div>

            {/* 상품명 */}
            <p className="text-sm font-semibold text-[#1d1d1f] line-clamp-2 leading-snug mb-1">{p.name}</p>

            {/* 바코드 */}
            {p.barcode && (
              <p className="font-mono text-[10px] text-[#86868b] mb-2.5 truncate">{p.barcode}</p>
            )}

            <div className="border-t border-gray-100 my-2.5" />

            {/* 가격 정보 */}
            <div className="space-y-1 mb-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#86868b]">매입가</span>
                <span className="text-xs tabular-nums text-[#86868b]">{fmt(p.buy_price)}원</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#86868b]">판매가</span>
                <span className="text-sm font-bold tabular-nums text-[#1d1d1f]">{fmt(p.sell_price)}원</span>
              </div>
            </div>

            {/* 마진율 + 단위·안전재고 */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#86868b]">{p.unit} · 안전재고 {fmt(p.min_stock)}</span>
              <span className={`text-sm font-bold tabular-nums ${m >= 30 ? 'text-[#34c759]' : m >= 10 ? 'text-[#007aff]' : 'text-[#ff3b30]'}`}>
                {m}%
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
