'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getBusinesses } from '@/lib/supabase/businesses'
import { Business } from '@/lib/types'

interface QuarterData {
  quarter: 1 | 2 | 3 | 4
  label: string
  months: string[]
  sales: number
  purchase: number
  profit: number
  margin: number
}

const FMT = (n: number) => n.toLocaleString() + '원'
const PCT = (n: number) => n.toFixed(1) + '%'

function buildQuarters(year: number): QuarterData[] {
  return [
    { quarter: 1, label: '1분기', months: [`${year}-01`, `${year}-02`, `${year}-03`], sales: 0, purchase: 0, profit: 0, margin: 0 },
    { quarter: 2, label: '2분기', months: [`${year}-04`, `${year}-05`, `${year}-06`], sales: 0, purchase: 0, profit: 0, margin: 0 },
    { quarter: 3, label: '3분기', months: [`${year}-07`, `${year}-08`, `${year}-09`], sales: 0, purchase: 0, profit: 0, margin: 0 },
    { quarter: 4, label: '4분기', months: [`${year}-10`, `${year}-11`, `${year}-12`], sales: 0, purchase: 0, profit: 0, margin: 0 },
  ]
}

const MONTH_LABELS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']

export default function QuarterlyPage() {
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [bizFilter, setBizFilter] = useState('all')
  const [quarters, setQuarters] = useState<QuarterData[]>([])
  const [monthlyDetail, setMonthlyDetail] = useState<{ month: string; sales: number; purchase: number; profit: number }[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { getBusinesses().then(setBusinesses) }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      let q = supabase
        .from('slips')
        .select('slip_type, slip_date, total_amount')
        .gte('slip_date', `${year}-01-01`)
        .lte('slip_date', `${year}-12-31`)
      if (bizFilter !== 'all') q = q.eq('business_id', bizFilter)
      const { data, error } = await q
      if (error) throw new Error(error.message)

      // 월별 집계
      const monthMap = new Map<string, { sales: number; purchase: number }>()
      for (const row of data ?? []) {
        const m = (row.slip_date as string).slice(0, 7)
        const existing = monthMap.get(m) ?? { sales: 0, purchase: 0 }
        if (row.slip_type === 'sale') existing.sales += row.total_amount
        else existing.purchase += row.total_amount
        monthMap.set(m, existing)
      }

      // 분기별 집계
      const qs = buildQuarters(year).map(q => {
        for (const m of q.months) {
          const md = monthMap.get(m)
          if (md) { q.sales += md.sales; q.purchase += md.purchase }
        }
        q.profit = q.sales - q.purchase
        q.margin = q.sales > 0 ? (q.profit / q.sales) * 100 : 0
        return q
      })
      setQuarters(qs)

      // 월별 상세
      const detail = Array.from({ length: 12 }, (_, i) => {
        const m = `${year}-${String(i + 1).padStart(2, '0')}`
        const md = monthMap.get(m) ?? { sales: 0, purchase: 0 }
        return { month: m, sales: md.sales, purchase: md.purchase, profit: md.sales - md.purchase }
      })
      setMonthlyDetail(detail)
    } finally {
      setLoading(false)
    }
  }, [year, bizFilter])

  useEffect(() => { load() }, [load])

  const annual = quarters.reduce((acc, q) => ({
    sales: acc.sales + q.sales,
    purchase: acc.purchase + q.purchase,
    profit: acc.profit + q.profit,
  }), { sales: 0, purchase: 0, profit: 0 })
  const annualMargin = annual.sales > 0 ? (annual.profit / annual.sales) * 100 : 0

  const thCls = 'px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200'
  const tdCls = 'px-3 py-2 text-sm border-b border-gray-100 text-right'

  function handlePrint() {
    window.print()
  }

  return (
    <div className="p-6 space-y-6 print:p-4">
      <div className="flex items-center justify-between print:block">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">분기별 집계표</h1>
          <p className="text-sm text-gray-500 mt-1">연간 분기별 매출·매입·손익 현황 (세무 신고용)</p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <select value={bizFilter} onChange={e => setBizFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="all">전체 사업자</option>
            {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <div className="flex items-center gap-1 border border-gray-300 rounded-lg px-1">
            <button onClick={() => setYear(y => y - 1)} className="px-2 py-2 text-gray-500 hover:text-gray-800">‹</button>
            <span className="px-3 py-2 text-sm font-semibold">{year}년</span>
            <button onClick={() => setYear(y => y + 1)} className="px-2 py-2 text-gray-500 hover:text-gray-800">›</button>
          </div>
          <button onClick={handlePrint}
            className="px-4 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50 flex items-center gap-1">
            🖨 인쇄
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-400">로딩 중...</div>
      ) : (
        <>
          {/* 연간 요약 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: `${year}년 총 매출`, value: annual.sales, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
              { label: `${year}년 총 매입`, value: annual.purchase, color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
              { label: '연간 이익', value: annual.profit, color: annual.profit >= 0 ? 'text-green-700' : 'text-red-700', bg: annual.profit >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200' },
              { label: '이익률', value: null, display: PCT(annualMargin), color: annualMargin >= 0 ? 'text-purple-700' : 'text-red-700', bg: 'bg-purple-50 border-purple-200' },
            ].map(c => (
              <div key={c.label} className={`rounded-xl border p-4 ${c.bg}`}>
                <p className="text-xs text-gray-500 mb-1">{c.label}</p>
                <p className={`text-xl font-bold ${c.color}`}>
                  {c.display ?? FMT(c.value ?? 0)}
                </p>
              </div>
            ))}
          </div>

          {/* 분기별 카드 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {quarters.map(q => (
              <div key={q.quarter} className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-800">{q.label}</span>
                  <span className="text-xs text-gray-400">{q.months[0].slice(5)}~{q.months[2].slice(5)}월</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">매출</span><span className="text-blue-700 font-medium">{FMT(q.sales)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">매입</span><span className="text-orange-700 font-medium">{FMT(q.purchase)}</span></div>
                  <div className="border-t border-gray-100 pt-1 flex justify-between font-semibold">
                    <span>이익</span>
                    <span className={q.profit >= 0 ? 'text-green-700' : 'text-red-600'}>{FMT(q.profit)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">이익률</span>
                    <span className={q.margin >= 0 ? 'text-green-600' : 'text-red-500'}>{PCT(q.margin)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 월별 상세표 */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 font-semibold text-gray-800">
              {year}년 월별 집계 상세
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className={thCls + ' text-left'}>월</th>
                    <th className={thCls}>매출</th>
                    <th className={thCls}>매입</th>
                    <th className={thCls}>이익</th>
                    <th className={thCls}>이익률</th>
                    <th className={thCls + ' text-left text-xs text-gray-300'}>분기</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyDetail.map((m, i) => {
                    const marginPct = m.sales > 0 ? (m.profit / m.sales) * 100 : 0
                    const isQuarterBoundary = (i + 1) % 3 === 0
                    const qNum = Math.floor(i / 3) + 1
                    return (
                      <tr key={m.month} className={`hover:bg-gray-50 ${isQuarterBoundary ? 'border-b-2 border-blue-100' : ''}`}>
                        <td className="px-3 py-2 text-sm border-b border-gray-100 font-medium">{MONTH_LABELS[i]}</td>
                        <td className={tdCls + ' text-blue-700'}>{m.sales > 0 ? FMT(m.sales) : '-'}</td>
                        <td className={tdCls + ' text-orange-700'}>{m.purchase > 0 ? FMT(m.purchase) : '-'}</td>
                        <td className={`${tdCls} ${m.profit >= 0 ? 'text-green-700' : 'text-red-600'} font-medium`}>
                          {m.sales > 0 || m.purchase > 0 ? FMT(m.profit) : '-'}
                        </td>
                        <td className={`${tdCls} text-xs ${marginPct >= 0 ? 'text-gray-600' : 'text-red-500'}`}>
                          {m.sales > 0 ? PCT(marginPct) : '-'}
                        </td>
                        {isQuarterBoundary ? (
                          <td className="px-3 py-2 text-xs text-blue-400 border-b border-gray-100" rowSpan={1}>
                            {qNum}Q 소계: {FMT(quarters[qNum - 1]?.sales ?? 0)}
                          </td>
                        ) : (
                          <td className="px-3 py-2 border-b border-gray-100" />
                        )}
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="bg-gray-50 font-semibold">
                  <tr>
                    <td className="px-3 py-2 text-sm">연 합계</td>
                    <td className={tdCls + ' text-blue-700'}>{FMT(annual.sales)}</td>
                    <td className={tdCls + ' text-orange-700'}>{FMT(annual.purchase)}</td>
                    <td className={`${tdCls} ${annual.profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>{FMT(annual.profit)}</td>
                    <td className={tdCls}>{PCT(annualMargin)}</td>
                    <td className="px-3 py-2 border-b border-gray-100" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}

      {/* 인쇄 전용 스타일 */}
      <style jsx global>{`
        @media print {
          nav, aside, .print\\:hidden { display: none !important; }
          body { font-size: 12px; }
        }
      `}</style>
    </div>
  )
}
