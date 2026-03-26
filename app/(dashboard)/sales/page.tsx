'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/ui/PageHeader'
import { getSalesSlips, getSalesByProduct, SalesSummaryRow, SalesByProduct } from '@/lib/supabase/sales'
import { getBusinesses } from '@/lib/supabase/businesses'
import { getChannels } from '@/lib/supabase/channels'
import { Business, Channel } from '@/lib/types'
import { formatMoney } from '@/lib/utils/format'

type ViewTab = 'slip' | 'product'

const PAYMENT_LABEL: Record<string, string> = { cash: '현금', credit: '외상', mixed: '혼합' }

export default function SalesPage() {
  const [slips, setSlips] = useState<SalesSummaryRow[]>([])
  const [byProduct, setByProduct] = useState<SalesByProduct[]>([])
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<ViewTab>('slip')
  const [bizFilter, setBizFilter] = useState('all')
  const [chFilter, setChFilter] = useState('all')
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10)
  })
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10))

  useEffect(() => {
    Promise.all([getBusinesses(), getChannels()]).then(([b, c]) => { setBusinesses(b); setChannels(c) })
  }, [])
  useEffect(() => { load() }, [bizFilter, chFilter, fromDate, toDate])

  async function load() {
    setLoading(true)
    try {
      const biz = bizFilter !== 'all' ? bizFilter : undefined
      const ch = chFilter !== 'all' ? chFilter : undefined
      const [s, p] = await Promise.all([
        getSalesSlips(biz, fromDate, toDate, ch),
        getSalesByProduct(biz, fromDate, toDate),
      ])
      setSlips(s); setByProduct(p)
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setLoading(false) }
  }

  const totalSupply = slips.reduce((s, r) => s + r.supply_amount, 0)
  const totalTax = slips.reduce((s, r) => s + r.tax_amount, 0)
  const totalAmount = slips.reduce((s, r) => s + r.total_amount, 0)
  const cashCount = slips.filter(r => r.payment_type === 'cash').length
  const creditCount = slips.filter(r => r.payment_type === 'credit').length

  // 날짜별 집계
  const byDate = slips.reduce<Record<string, number>>((acc, r) => {
    acc[r.slip_date] = (acc[r.slip_date] ?? 0) + r.total_amount
    return acc
  }, {})
  const topDate = Object.entries(byDate).sort((a, b) => b[1] - a[1])[0]

  return (
    <div>
      <PageHeader title="매출 현황" />

      {/* 필터 */}
      <div className="flex flex-wrap gap-2 mb-5">
        <select value={bizFilter} onChange={e => setBizFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">전체 사업자</option>
          {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={chFilter} onChange={e => setChFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">전체 채널</option>
          {channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <span className="text-gray-400 self-center text-sm">~</span>
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <p className="text-xs text-gray-500 mb-1">전표 수</p>
          <p className="text-2xl font-bold text-gray-900">{slips.length}<span className="text-sm font-normal text-gray-400 ml-1">건</span></p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <p className="text-xs text-gray-500 mb-1">공급가액 합계</p>
          <p className="text-2xl font-bold text-blue-600">{formatMoney(totalSupply)}<span className="text-sm font-normal text-gray-400 ml-1">원</span></p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <p className="text-xs text-gray-500 mb-1">부가세 합계</p>
          <p className="text-2xl font-bold text-gray-700">{formatMoney(totalTax)}<span className="text-sm font-normal text-gray-400 ml-1">원</span></p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <p className="text-xs text-gray-500 mb-1">합계</p>
          <p className="text-2xl font-bold text-gray-900">{formatMoney(totalAmount)}<span className="text-sm font-normal text-gray-400 ml-1">원</span></p>
          <p className="text-xs text-gray-400 mt-0.5">현금 {cashCount}건 · 외상 {creditCount}건</p>
        </div>
      </div>

      {/* 뷰 탭 */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {([['slip', '전표별'], ['product', '상품별']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setView(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${view === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-900'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">불러오는 중...</div>
        ) : view === 'slip' ? (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>
                {['날짜','거래처','채널','결제','공급가','부가세','합계','세금계산서'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {slips.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">매출 내역이 없습니다</td></tr>
              )}
              {slips.map(r => (
                <tr key={r.slip_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{r.slip_date}</td>
                  <td className="px-4 py-3">{r.partner_name ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{r.channel_name ?? '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${r.payment_type === 'cash' ? 'bg-green-100 text-green-700' : r.payment_type === 'credit' ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700'}`}>
                      {PAYMENT_LABEL[r.payment_type] ?? r.payment_type}
                    </span>
                  </td>
                  <td className="px-4 py-3">{formatMoney(r.supply_amount)}원</td>
                  <td className="px-4 py-3 text-gray-500">{formatMoney(r.tax_amount)}원</td>
                  <td className="px-4 py-3 font-bold">{formatMoney(r.total_amount)}원</td>
                  <td className="px-4 py-3">
                    {r.is_tax_invoice ? <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">발행</span> : <span className="text-gray-300 text-xs">-</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>
                {['순위','상품명','카테고리','판매수량','공급가합계'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {byProduct.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400">데이터가 없습니다</td></tr>
              )}
              {byProduct.map((p, i) => (
                <tr key={p.product_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400 font-bold text-xs">{i + 1}</td>
                  <td className="px-4 py-3 font-medium">{p.product_name}</td>
                  <td className="px-4 py-3 text-gray-500">{p.category ?? '-'}</td>
                  <td className="px-4 py-3">{p.total_quantity.toLocaleString()}</td>
                  <td className="px-4 py-3 font-bold">{formatMoney(p.total_amount)}원</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
