'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/ui/PageHeader'
import { getBusinesses } from '@/lib/supabase/businesses'
import { getSalesByChannel, getChannelMonthlySales, ChannelSaleRow } from '@/lib/supabase/channel-sales'
import { Business } from '@/lib/types'
import { formatMoney } from '@/lib/utils/format'

const COLORS = ['bg-blue-500', 'bg-violet-500', 'bg-green-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500']
const TEXT_COLORS = ['text-blue-600', 'text-violet-600', 'text-green-600', 'text-orange-600', 'text-pink-600', 'text-teal-600']

function getPeriod(range: string): { from: string; to: string } {
  const today = new Date()
  const y = today.getFullYear()
  const m = today.getMonth()
  if (range === 'this_month') {
    return {
      from: new Date(y, m, 1).toISOString().slice(0, 10),
      to: new Date(y, m + 1, 0).toISOString().slice(0, 10),
    }
  }
  if (range === 'last_month') {
    return {
      from: new Date(y, m - 1, 1).toISOString().slice(0, 10),
      to: new Date(y, m, 0).toISOString().slice(0, 10),
    }
  }
  if (range === '3month') {
    return {
      from: new Date(y, m - 2, 1).toISOString().slice(0, 10),
      to: new Date(y, m + 1, 0).toISOString().slice(0, 10),
    }
  }
  if (range === '6month') {
    return {
      from: new Date(y, m - 5, 1).toISOString().slice(0, 10),
      to: new Date(y, m + 1, 0).toISOString().slice(0, 10),
    }
  }
  // this_year
  return { from: `${y}-01-01`, to: `${y}-12-31` }
}

export default function ChannelSalesPage() {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [bizFilter, setBizFilter] = useState('all')
  const [range, setRange] = useState('this_month')
  const [channels, setChannels] = useState<ChannelSaleRow[]>([])
  const [monthly, setMonthly] = useState<{ months: string[]; channels: string[]; data: Record<string, Record<string, number>> }>({ months: [], channels: [], data: {} })
  const [loading, setLoading] = useState(true)

  useEffect(() => { getBusinesses().then(setBusinesses) }, [])
  useEffect(() => { load() }, [bizFilter, range])

  async function load() {
    setLoading(true)
    try {
      const biz = bizFilter !== 'all' ? bizFilter : undefined
      const { from, to } = getPeriod(range)
      const [ch, mo] = await Promise.all([
        getSalesByChannel(biz, from, to),
        getChannelMonthlySales(biz, from, to),
      ])
      setChannels(ch)
      setMonthly(mo)
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setLoading(false) }
  }

  const totalSales = channels.reduce((s, c) => s + c.total_sales, 0)
  const totalNet = channels.reduce((s, c) => s + c.net_sales, 0)
  const totalCommission = channels.reduce((s, c) => s + c.commission_amount, 0)
  const maxSales = Math.max(...channels.map(c => c.total_sales), 1)
  const maxMonthly = Math.max(
    ...monthly.months.flatMap(m => monthly.channels.map(ch => monthly.data[m]?.[ch] ?? 0)),
    1
  )

  return (
    <div>
      <PageHeader
        title="채널별 매출 현황"
        description="네이버·쿠팡·자사몰 등 판매 채널별 매출 및 수수료 분석"
      />

      <div className="flex flex-wrap gap-2 mb-5">
        <select value={bizFilter} onChange={e => setBizFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">전체 사업자</option>
          {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={range} onChange={e => setRange(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="this_month">이번 달</option>
          <option value="last_month">지난 달</option>
          <option value="3month">최근 3개월</option>
          <option value="6month">최근 6개월</option>
          <option value="this_year">올해</option>
        </select>
      </div>

      {loading ? (
        <div className="py-24 text-center text-sm text-gray-400">불러오는 중...</div>
      ) : channels.length === 0 ? (
        <div className="py-24 text-center text-sm text-gray-400">
          <p>채널별 매출 데이터가 없습니다</p>
          <p className="text-xs mt-1">거래 입력 시 채널을 선택해야 집계됩니다</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* 요약 카드 */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border border-gray-100 rounded-2xl p-5">
              <p className="text-xs text-gray-500 mb-1">총 매출</p>
              <p className="text-2xl font-bold text-blue-600">{formatMoney(totalSales)}<span className="text-sm font-normal ml-1">원</span></p>
              <p className="text-xs text-gray-400 mt-1">{channels.reduce((s, c) => s + c.slip_count, 0).toLocaleString()}건</p>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-5">
              <p className="text-xs text-gray-500 mb-1">총 수수료</p>
              <p className="text-2xl font-bold text-red-500">{formatMoney(totalCommission)}<span className="text-sm font-normal ml-1">원</span></p>
              {totalSales > 0 && <p className="text-xs text-gray-400 mt-1">평균 {Math.round(totalCommission / totalSales * 100)}%</p>}
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-5">
              <p className="text-xs text-gray-500 mb-1">수수료 차감 순매출</p>
              <p className="text-2xl font-bold text-green-600">{formatMoney(totalNet)}<span className="text-sm font-normal ml-1">원</span></p>
              {totalSales > 0 && <p className="text-xs text-gray-400 mt-1">순이익률 {Math.round(totalNet / totalSales * 100)}%</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            {/* 채널별 막대 비교 */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="text-sm font-semibold text-gray-800 mb-4">채널별 매출 비교</p>
              <div className="space-y-4">
                {channels.map((ch, i) => {
                  const pct = (ch.total_sales / maxSales) * 100
                  const share = totalSales > 0 ? Math.round(ch.total_sales / totalSales * 100) : 0
                  return (
                    <div key={ch.channel_id}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-gray-700">{ch.channel_name}</span>
                        <span className={`font-bold ${TEXT_COLORS[i % TEXT_COLORS.length]}`}>
                          {formatMoney(ch.total_sales)}원 <span className="text-gray-400 font-normal">({share}%)</span>
                        </span>
                      </div>
                      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-2.5 ${COLORS[i % COLORS.length]} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex gap-3 mt-1 text-xs text-gray-400">
                        <span>{ch.slip_count}건</span>
                        <span>평균 {formatMoney(ch.avg_order)}원</span>
                        <span>수수료 {ch.commission_rate}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 채널별 수수료 상세 */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50">
                <p className="text-sm font-semibold text-gray-800">수수료 차감 순매출</p>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs">
                  <tr>
                    {['채널', '총매출', '수수료', '순매출'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {channels.map((ch, i) => (
                    <tr key={ch.channel_id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${COLORS[i % COLORS.length]}`} />
                          <span className="font-medium">{ch.channel_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-gray-700">{formatMoney(ch.total_sales)}</td>
                      <td className="px-4 py-2.5 text-red-500">-{formatMoney(ch.commission_amount)}</td>
                      <td className="px-4 py-2.5 font-bold text-green-600">{formatMoney(ch.net_sales)}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-semibold text-xs text-gray-700">
                    <td className="px-4 py-2.5">합계</td>
                    <td className="px-4 py-2.5">{formatMoney(totalSales)}</td>
                    <td className="px-4 py-2.5 text-red-500">-{formatMoney(totalCommission)}</td>
                    <td className="px-4 py-2.5 text-green-600">{formatMoney(totalNet)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 월별 채널 추이 (다기간 선택 시) */}
          {monthly.months.length > 1 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="text-sm font-semibold text-gray-800 mb-4">채널별 월간 추이</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-medium">월</th>
                      {monthly.channels.map((ch, i) => (
                        <th key={ch} className="px-4 py-2.5 text-left font-medium">
                          <span className={TEXT_COLORS[i % TEXT_COLORS.length]}>{ch}</span>
                        </th>
                      ))}
                      <th className="px-4 py-2.5 text-left font-medium">합계</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {monthly.months.map(m => {
                      const rowTotal = monthly.channels.reduce((s, ch) => s + (monthly.data[m]?.[ch] ?? 0), 0)
                      return (
                        <tr key={m} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 font-mono text-xs font-medium text-gray-600">{m}</td>
                          {monthly.channels.map((ch, i) => (
                            <td key={ch} className={`px-4 py-2.5 ${TEXT_COLORS[i % TEXT_COLORS.length]}`}>
                              {formatMoney(monthly.data[m]?.[ch] ?? 0)}
                            </td>
                          ))}
                          <td className="px-4 py-2.5 font-bold text-gray-800">{formatMoney(rowTotal)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* 스택 바 차트 */}
              <div className="mt-5">
                <div className="flex items-end gap-3" style={{ height: 100 }}>
                  {monthly.months.map(m => {
                    const total = monthly.channels.reduce((s, ch) => s + (monthly.data[m]?.[ch] ?? 0), 0)
                    const pct = total / maxMonthly * 100
                    return (
                      <div key={m} className="flex-1 flex flex-col items-center gap-0.5">
                        <div className="w-full flex flex-col-reverse rounded-t-sm overflow-hidden" style={{ height: `${pct}%`, minHeight: total > 0 ? '4px' : 0 }}>
                          {monthly.channels.map((ch, i) => {
                            const val = monthly.data[m]?.[ch] ?? 0
                            const segPct = total > 0 ? (val / total) * 100 : 0
                            return <div key={ch} className={COLORS[i % COLORS.length]} style={{ height: `${segPct}%` }} title={`${ch}: ${formatMoney(val)}원`} />
                          })}
                        </div>
                        <span className="text-xs text-gray-400">{m.slice(5)}월</span>
                      </div>
                    )
                  })}
                </div>
                <div className="flex flex-wrap gap-3 mt-2">
                  {monthly.channels.map((ch, i) => (
                    <span key={ch} className="flex items-center gap-1 text-xs text-gray-500">
                      <span className={`w-2.5 h-2.5 rounded-sm ${COLORS[i % COLORS.length]}`} />
                      {ch}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
