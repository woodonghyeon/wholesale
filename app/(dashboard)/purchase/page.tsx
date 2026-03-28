'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/ui/PageHeader'
import { getSlips, SlipWithItems } from '@/lib/supabase/slips'
import { getBusinesses } from '@/lib/supabase/businesses'
import { getPartners } from '@/lib/supabase/partners'
import { Business, Partner } from '@/lib/types'
import { formatMoney } from '@/lib/utils/format'

const PAYMENT_LABEL: Record<string, string> = { cash: '현금', credit: '외상', mixed: '혼합' }

export default function PurchasePage() {
  const [slips, setSlips] = useState<SlipWithItems[]>([])
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [bizFilter, setBizFilter] = useState('all')
  const [partnerFilter, setPartnerFilter] = useState('all')
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10)
  })
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10))

  useEffect(() => {
    Promise.all([getBusinesses(), getPartners('supplier')]).then(([b, p]) => { setBusinesses(b); setPartners(p) })
  }, [])
  useEffect(() => { load() }, [bizFilter, fromDate, toDate])

  async function load() {
    setLoading(true)
    try {
      const data = await getSlips('purchase', bizFilter !== 'all' ? bizFilter : undefined, fromDate, toDate)
      setSlips(data)
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setLoading(false) }
  }

  const filtered = partnerFilter === 'all' ? slips : slips.filter(s => s.partner_id === partnerFilter)
  const totalSupply = filtered.reduce((s, r) => s + r.supply_amount, 0)
  const totalTax = filtered.reduce((s, r) => s + r.tax_amount, 0)
  const totalAmount = filtered.reduce((s, r) => s + r.total_amount, 0)

  // 공급사별 집계
  const byPartner = filtered.reduce<Record<string, { name: string; amount: number; count: number }>>((acc, r) => {
    const key = r.partner_id ?? '__none__'
    if (!acc[key]) acc[key] = { name: r.partner_name ?? '(미지정)', amount: 0, count: 0 }
    acc[key].amount += r.total_amount
    acc[key].count += 1
    return acc
  }, {})
  const partnerRank = Object.values(byPartner).sort((a, b) => b.amount - a.amount)

  return (
    <div>
      <PageHeader title="매입 현황" />

      {/* 필터 */}
      <div className="flex flex-wrap gap-2 mb-5">
        <select value={bizFilter} onChange={e => setBizFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">전체 사업자</option>
          {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={partnerFilter} onChange={e => setPartnerFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">전체 공급사</option>
          {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
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
          <p className="text-2xl font-bold text-gray-900">{filtered.length}<span className="text-sm font-normal text-gray-400 ml-1">건</span></p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <p className="text-xs text-gray-500 mb-1">공급가액</p>
          <p className="text-2xl font-bold text-gray-700">{formatMoney(totalSupply)}<span className="text-sm font-normal text-gray-400 ml-1">원</span></p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <p className="text-xs text-gray-500 mb-1">부가세</p>
          <p className="text-2xl font-bold text-gray-700">{formatMoney(totalTax)}<span className="text-sm font-normal text-gray-400 ml-1">원</span></p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <p className="text-xs text-gray-500 mb-1">총 매입액</p>
          <p className="text-2xl font-bold text-red-600">{formatMoney(totalAmount)}<span className="text-sm font-normal text-gray-400 ml-1">원</span></p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* 전표 목록 */}
        <div className="col-span-2 bg-white rounded-xl border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-sm text-gray-400">불러오는 중...</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs">
                <tr>
                  {['날짜','공급사','결제','공급가','부가세','합계',''].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">매입 내역이 없습니다</td></tr>
                )}
                {filtered.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50 group">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{r.slip_date}</td>
                    <td className="px-4 py-3 font-medium">{r.partner_name ?? '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${r.payment_type === 'cash' ? 'bg-green-100 text-green-700' : r.payment_type === 'credit' ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700'}`}>
                        {PAYMENT_LABEL[r.payment_type] ?? r.payment_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">{formatMoney(r.supply_amount)}원</td>
                    <td className="px-4 py-3 text-gray-500">{formatMoney(r.tax_amount)}원</td>
                    <td className="px-4 py-3 font-bold">{formatMoney(r.total_amount)}원</td>
                    <td className="px-4 py-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => window.open(`/api/pdf/slip?id=${r.id}`, '_blank')}
                        className="text-xs text-gray-500 hover:text-blue-600 border border-gray-200 hover:border-blue-300 px-2 py-1 rounded"
                      >
                        🖨️ PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 공급사별 순위 */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <p className="text-sm font-semibold text-gray-800 mb-4">공급사별 매입액</p>
          <div className="space-y-3">
            {partnerRank.length === 0 && <p className="text-sm text-gray-400 text-center py-6">데이터 없음</p>}
            {partnerRank.slice(0, 8).map((p, i) => {
              const pct = totalAmount > 0 ? (p.amount / totalAmount) * 100 : 0
              return (
                <div key={p.name + i}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-700 font-medium truncate max-w-[120px]">{p.name}</span>
                    <span className="text-gray-500">{formatMoney(p.amount)}원</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full">
                    <div className="h-1.5 bg-orange-400 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
