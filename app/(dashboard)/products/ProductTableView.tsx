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

export default function ProductTableView({ products, onSelect }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/60">
            <th className="text-left px-4 py-2.5 font-medium text-[#86868b] w-[150px]">바코드</th>
            <th className="text-left px-4 py-2.5 font-medium text-[#86868b]">상품명</th>
            <th className="text-left px-4 py-2.5 font-medium text-[#86868b] w-[80px]">카테고리</th>
            <th className="text-left px-4 py-2.5 font-medium text-[#86868b] w-[50px]">단위</th>
            <th className="text-right px-4 py-2.5 font-medium text-[#86868b] w-[90px]">매입가</th>
            <th className="text-right px-4 py-2.5 font-medium text-[#86868b] w-[90px]">판매가</th>
            <th className="text-right px-4 py-2.5 font-medium text-[#86868b] w-[70px]">마진율</th>
            <th className="text-right px-4 py-2.5 font-medium text-[#86868b] w-[70px]">안전재고</th>
            <th className="text-center px-4 py-2.5 font-medium text-[#86868b] w-[50px]">구분</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {products.map((p, i) => {
            const m = margin(p.buy_price, p.sell_price)
            return (
              <tr
                key={p.id}
                onClick={() => onSelect(p)}
                className={`cursor-pointer hover:bg-blue-50/40 transition-colors ${i % 2 === 1 ? 'bg-gray-50/40' : ''}`}
              >
                <td className="px-4 py-2.5 font-mono text-[#86868b]">
                  {p.barcode ?? <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-2.5 font-medium text-[#1d1d1f]">{p.name}</td>
                <td className="px-4 py-2.5 text-[#86868b]">
                  {p.category ?? <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-2.5 text-[#86868b]">{p.unit}</td>
                <td className="px-4 py-2.5 text-right text-[#86868b]">{fmt(p.buy_price)}</td>
                <td className="px-4 py-2.5 text-right font-medium text-[#1d1d1f]">{fmt(p.sell_price)}</td>
                <td className="px-4 py-2.5 text-right">
                  <span className={`font-medium ${m >= 30 ? 'text-[#34c759]' : m >= 10 ? 'text-[#007aff]' : 'text-[#ff3b30]'}`}>
                    {m}%
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right text-[#86868b]">{fmt(p.min_stock)}</td>
                <td className="px-4 py-2.5 text-center">
                  {p.is_bundle
                    ? <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">세트</span>
                    : <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">단일</span>
                  }
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
