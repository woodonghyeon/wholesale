'use client'

import { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/ui/PageHeader'
import { getBusinesses } from '@/lib/supabase/businesses'
import { Business } from '@/lib/types'
import { formatMoney } from '@/lib/utils/format'
import type { ProfitByProduct, ProfitByPartner } from '@/app/api/analytics/profit/route'

type Tab = 'product' | 'partner'
type SortKey = 'profit' | 'revenue' | 'margin' | 'qty'

const thisYear = new Date().getFullYear()

function marginColor(rate: number) {
  if (rate >= 30) return 'text-green-600'
  if (rate >= 15) return 'text-blue-600'
  if (rate >= 0) return 'text-gray-600'
  return 'text-red-500'
}

function marginBg(rate: number) {
  if (rate >= 30) return 'bg-green-100 text-green-700'
  if (rate >= 15) return 'bg-blue-100 text-blue-700'
  if (rate >= 0) return 'bg-gray-100 text-gray-600'
  return 'bg-red-100 text-red-600'
}

export default function ProfitPage() {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [bizFilter, setBizFilter] = useState('all')
  const [from, setFrom] = useState(`${thisYear}-01-01`)
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10))
  const [tab, setTab] = useState<Tab>('product')
  const [sortKey, setSortKey] = useState<SortKey>('profit')
  const [loading, setLoading] = useState(false)
  const [byProduct, setByProduct] = useState<ProfitByProduct[]>([])
  const [byPartner, setByPartner] = useState<ProfitByPartner[]>([])
  const [summary, setSummary] = useState({ totalRevenue: 0, totalCost: 0, totalProfit: 0, marginRate: 0 })
  const [categoryFilter, setCategoryFilter] = useState('')

  useEffect(() => { getBusinesses().then(setBusinesses) }, [])
  useEffect(() => { load() }, [bizFilter, from, to])

  async function load() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ from, to })
      if (bizFilter !== 'all') params.set('businessId', bizFilter)
      const res = await fetch(`/api/analytics/profit?${params}`)
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setByProduct(data.byProduct)
      setByPartner(data.byPartner)
      setSummary(data.summary)
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setLoading(false) }
  }

  function setPreset(months: number) {
    const end = new Date()
    const start = new Date()
    start.setMonth(start.getMonth() - months)
    setFrom(start.toISOString().slice(0, 10))
    setTo(end.toISOString().slice(0, 10))
  }

  const categories = useMemo(() => {
    const set = new Set(byProduct.map(p => p.category ?? '미분류'))
    return Array.from(set).sort()
  }, [byProduct])

  const sortedProducts = useMemo(() => {
    const filtered = categoryFilter
      ? byProduct.filter(p => (p.category ?? '미분류') === categoryFilter)
      : byProduct
    return [...filtered].sort((a, b) => {
      if (sortKey === 'profit') return b.total_profit - a.total_profit
      if (sortKey === 'revenue') return b.total_revenue - a.total_revenue
      if (sortKey === 'margin') return b.margin_rate - a.margin_rate
      if (sortKey === 'qty') return b.total_qty - a.total_qty
      return 0
    })
  }, [byProduct, sortKey, categoryFilter])

  const sortedPartners = useMemo(() => {
    return [...byPartner].sort((a, b) => {
      if (sortKey === 'profit') return b.total_profit - a.total_profit
      if (sortKey === 'revenue') return b.total_revenue - a.total_revenue
      if (sortKey === 'margin') return b.margin_rate - a.margin_rate
      return 0
    })
  }, [byPartner, sortKey])

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <button onClick={() => setSortKey(k)}
      className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${sortKey === k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
      {label}
    </button>
  )

  return (
    <div>
      <PageHeader title="이익 분석" description="품목별·거래처별 매출·원가·이익 분석" />

      {/* 필터 */}
      <div className="flex flex-wrap gap-2 mb-5 items-center">
        <select value={bizFilter} onChange={e => setBizFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">전체 사업자</option>
          {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <span className="text-gray-400 text-sm">~</span>
        <input type="date" value={to} onChange={e => setTo(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <div className="flex gap-1 ml-1">
          {[['이번달', 1], ['3개월', 3], ['6개월', 6], ['올해', 12]].map(([label, n]) => (
            <button key={label} onClick={() => setPreset(Number(n))}
              className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: '총 매출', value: formatMoney(summary.totalRevenue) + '원', sub: '(공급가액 기준)' },
          { label: '총 원가', value: formatMoney(summary.totalCost) + '원', sub: '(매입가 기준)', valueColor: 'text-red-500' },
          { label: '총 이익', value: formatMoney(summary.totalProfit) + '원', sub: '', valueColor: summary.totalProfit >= 0 ? 'text-green-600' : 'text-red-500' },
          { label: '평균 이익률', value: `${summary.marginRate}%`, sub: '', valueColor: marginColor(summary.marginRate) },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500 mb-1">{card.label}</p>
            <p className={`text-xl font-bold ${card.valueColor ?? 'text-gray-900'}`}>{card.value}</p>
            {card.sub && <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>}
          </div>
        ))}
      </div>

      {/* 탭 */}
      <div className="flex gap-1 mb-4">
        <button onClick={() => setTab('product')}
          className={`px-4 py-2 text-sm rounded-lg transition-colors ${tab === 'product' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
          품목별 이익
        </button>
        <button onClick={() => setTab('partner')}
          className={`px-4 py-2 text-sm rounded-lg transition-colors ${tab === 'partner' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
          거래처별 이익
        </button>
      </div>

      {/* 정렬 + 필터 */}
      <div className="flex gap-2 mb-3 items-center">
        <span className="text-xs text-gray-500">정렬:</span>
        <SortBtn k="profit" label="이익순" />
        <SortBtn k="revenue" label="매출순" />
        <SortBtn k="margin" label="이익률순" />
        {tab === 'product' && <SortBtn k="qty" label="수량순" />}

        {tab === 'product' && categories.length > 1 && (
          <>
            <span className="text-xs text-gray-400 ml-2">카테고리:</span>
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white">
              <option value="">전체</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </>
        )}
      </div>

      {/* 테이블 */}
      {loading ? (
        <div className="py-16 text-center text-sm text-gray-400">분석 중...</div>
      ) : tab === 'product' ? (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>
                {['#', '상품명', '카테고리', '판매수량', '매출', '원가', '이익', '이익률'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sortedProducts.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">데이터가 없습니다</td></tr>
              )}
              {sortedProducts.map((p, i) => (
                <tr key={p.product_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{p.product_name}</td>
                  <td className="px-4 py-3">
                    {p.category
                      ? <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{p.category}</span>
                      : <span className="text-gray-300">-</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.total_qty.toLocaleString()}개</td>
                  <td className="px-4 py-3 text-gray-700">{formatMoney(p.total_revenue)}원</td>
                  <td className="px-4 py-3 text-red-400">{formatMoney(p.total_cost)}원</td>
                  <td className="px-4 py-3 font-semibold">
                    <span className={p.total_profit >= 0 ? 'text-green-600' : 'text-red-500'}>
                      {p.total_profit >= 0 ? '' : '-'}{formatMoney(Math.abs(p.total_profit))}원
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${marginBg(p.margin_rate)}`}>
                      {p.margin_rate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>
                {['#', '거래처', '거래 횟수', '매출', '원가', '이익', '이익률'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sortedPartners.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">데이터가 없습니다</td></tr>
              )}
              {sortedPartners.map((p, i) => (
                <tr key={p.partner_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{p.partner_name}</td>
                  <td className="px-4 py-3 text-gray-600">{p.order_count}건</td>
                  <td className="px-4 py-3 text-gray-700">{formatMoney(p.total_revenue)}원</td>
                  <td className="px-4 py-3 text-red-400">{formatMoney(p.total_cost)}원</td>
                  <td className="px-4 py-3 font-semibold">
                    <span className={p.total_profit >= 0 ? 'text-green-600' : 'text-red-500'}>
                      {p.total_profit >= 0 ? '' : '-'}{formatMoney(Math.abs(p.total_profit))}원
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${marginBg(p.margin_rate)}`}>
                      {p.margin_rate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
