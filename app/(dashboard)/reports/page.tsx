'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/ui/PageHeader'
import { getBusinesses } from '@/lib/supabase/businesses'
import { getSalesByProduct } from '@/lib/supabase/sales'
import { createClient } from '@/lib/supabase/client'
import { Business } from '@/lib/types'
import { formatMoney } from '@/lib/utils/format'

interface MonthData { month: string; sales: number; purchase: number; profit: number }
interface TopProduct { product_name: string; total_amount: number; total_quantity: number }

export default function ReportsPage() {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [bizFilter, setBizFilter] = useState('all')
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [monthlyData, setMonthlyData] = useState<MonthData[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { getBusinesses().then(setBusinesses) }, [])
  useEffect(() => { load() }, [bizFilter, year])

  async function load() {
    setLoading(true)
    try {
      const biz = bizFilter !== 'all' ? bizFilter : undefined
      const from = `${year}-01-01`
      const to   = `${year}-12-31`

      // ─── 단 2번의 병렬 쿼리로 처리 (기존 36회 → 2회) ───
      const supabase = createClient()
      let q = supabase
        .from('slips')
        .select('slip_type, slip_date, total_amount')
        .gte('slip_date', from)
        .lte('slip_date', to)
      if (biz) q = q.eq('business_id', biz)

      const [{ data: slipData, error }, prods] = await Promise.all([
        q,
        getSalesByProduct(biz, from, to),
      ])
      if (error) throw new Error(error.message)

      // 월별 집계 (클라이언트 그룹핑)
      const monthly: MonthData[] = Array.from({ length: 12 }, (_, i) => {
        const m = i + 1
        const monthStr = String(m).padStart(2, '0')
        const monthSlips = (slipData ?? []).filter(
          (s: any) => s.slip_date?.slice(5, 7) === monthStr
        )
        const sales = monthSlips
          .filter((s: any) => s.slip_type === 'sale')
          .reduce((sum: number, s: any) => sum + s.total_amount, 0)
        const purchase = monthSlips
          .filter((s: any) => s.slip_type === 'purchase')
          .reduce((sum: number, s: any) => sum + s.total_amount, 0)
        return { month: `${m}월`, sales, purchase, profit: sales - purchase }
      })

      setMonthlyData(monthly)
      setTopProducts(
        prods.slice(0, 10).map(p => ({
          product_name: p.product_name,
          total_amount: p.total_amount,
          total_quantity: p.total_quantity,
        }))
      )
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setLoading(false) }
  }

  const totalSales    = monthlyData.reduce((s, r) => s + r.sales, 0)
  const totalPurchase = monthlyData.reduce((s, r) => s + r.purchase, 0)
  const totalProfit   = totalSales - totalPurchase
  const maxSales      = Math.max(...monthlyData.map(m => m.sales), 1)
  const years         = [2023, 2024, 2025, 2026]

  return (
    <div>
      <PageHeader title="보고서" description={`${year}년 손익 분석`} />

      <div className="flex flex-wrap gap-2 mb-5">
        <select value={bizFilter} onChange={e => setBizFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">전체 사업자</option>
          {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={year} onChange={e => setYear(parseInt(e.target.value))}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          {years.map(y => <option key={y} value={y}>{y}년</option>)}
        </select>
      </div>

      {loading ? (
        <div className="py-24 text-center text-sm text-gray-400">불러오는 중...</div>
      ) : (
        <div className="space-y-6">
          {/* 연간 요약 카드 */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border border-gray-100 rounded-2xl p-5">
              <p className="text-xs text-gray-500 mb-1">{year}년 총 매출</p>
              <p className="text-2xl font-bold text-blue-600">
                {formatMoney(totalSales)}<span className="text-sm font-normal ml-1">원</span>
              </p>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-5">
              <p className="text-xs text-gray-500 mb-1">{year}년 총 매입</p>
              <p className="text-2xl font-bold text-gray-700">
                {formatMoney(totalPurchase)}<span className="text-sm font-normal ml-1">원</span>
              </p>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-5">
              <p className="text-xs text-gray-500 mb-1">{year}년 총 이익</p>
              <p className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {formatMoney(totalProfit)}<span className="text-sm font-normal ml-1">원</span>
              </p>
              {totalSales > 0 && (
                <p className="text-xs text-gray-400 mt-0.5">
                  마진율 {Math.round((totalProfit / totalSales) * 100)}%
                </p>
              )}
            </div>
          </div>

          {/* 월별 막대 차트 */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-sm font-semibold text-gray-800 mb-4">월별 매출 / 매입</p>
            <div className="flex items-end gap-2" style={{ height: 160 }}>
              {monthlyData.map((m, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                  <div className="w-full flex gap-0.5 items-end" style={{ height: 120 }}>
                    <div
                      className="flex-1 bg-blue-400 rounded-t-sm transition-all"
                      style={{ height: `${(m.sales / maxSales) * 100}%` }}
                      title={`매출: ${formatMoney(m.sales)}원`}
                    />
                    <div
                      className="flex-1 bg-orange-300 rounded-t-sm transition-all"
                      style={{ height: `${(m.purchase / maxSales) * 100}%` }}
                      title={`매입: ${formatMoney(m.purchase)}원`}
                    />
                  </div>
                  <span className="text-xs text-gray-400">{m.month}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 bg-blue-400 rounded-sm inline-block" />매출
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 bg-orange-300 rounded-sm inline-block" />매입
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            {/* 월별 손익 테이블 */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50">
                <p className="text-sm font-semibold text-gray-800">월별 손익</p>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs">
                  <tr>
                    {['월', '매출', '매입', '이익'].map(h => (
                      <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {monthlyData.map((m, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium">{m.month}</td>
                      <td className="px-4 py-2 text-blue-600">{formatMoney(m.sales)}</td>
                      <td className="px-4 py-2 text-gray-600">{formatMoney(m.purchase)}</td>
                      <td className={`px-4 py-2 font-medium ${m.profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {formatMoney(m.profit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 text-xs font-semibold text-gray-700">
                  <tr>
                    <td className="px-4 py-2">합계</td>
                    <td className="px-4 py-2 text-blue-600">{formatMoney(totalSales)}</td>
                    <td className="px-4 py-2 text-gray-600">{formatMoney(totalPurchase)}</td>
                    <td className={`px-4 py-2 ${totalProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {formatMoney(totalProfit)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* 매출 TOP 10 */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="text-sm font-semibold text-gray-800 mb-4">매출 TOP 10 상품</p>
              {topProducts.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">데이터 없음</p>
              ) : (
                <div className="space-y-2.5">
                  {topProducts.map((p, i) => {
                    const maxAmt = topProducts[0].total_amount
                    const pct = maxAmt > 0 ? (p.total_amount / maxAmt) * 100 : 0
                    return (
                      <div key={i}>
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="text-gray-700 truncate max-w-[150px]">
                            <span className="text-gray-400 mr-1">{i + 1}.</span>{p.product_name}
                          </span>
                          <span className="text-gray-600 font-medium ml-2 shrink-0">
                            {formatMoney(p.total_amount)}원
                          </span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full">
                          <div className="h-1.5 bg-blue-400 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-gray-400 text-xs mt-0.5">{p.total_quantity.toLocaleString()}개</p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
