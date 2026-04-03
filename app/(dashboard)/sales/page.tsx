'use client'

import { useEffect, useState, useCallback } from 'react'
import { useBusinessStore } from '@/store/businessStore'
import {
  fetchSalesKPI, fetchMonthlySales, fetchPartnerSales,
  fetchChannelSalesAgg, fetchSalesSlips,
  type SalesFilter, type SalesKPI, type MonthlySales,
  type PartnerSales, type ChannelSales, type SalesSlip,
} from '@/lib/supabase/sales'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { toast } from 'sonner'
import SlipDetailModal from '../transactions/SlipDetailModal'

function fmt(n: number) { return new Intl.NumberFormat('ko-KR').format(n) }

const PAYMENT_LABEL: Record<string, string> = { cash: '현금', credit: '외상', mixed: '혼합' }
const PAYMENT_COLOR: Record<string, string> = {
  cash: 'bg-green-50 text-[#34c759]',
  credit: 'bg-orange-50 text-[#ff9f0a]',
  mixed: 'bg-purple-50 text-purple-500',
}

function getDefaultRange() {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
  return { from, to }
}

type PageSize = 10 | 50 | 100

export default function SalesPage() {
  const { selectedBusinessId } = useBusinessStore()

  const defaultRange = getDefaultRange()
  const [dateFrom, setDateFrom] = useState(defaultRange.from)
  const [dateTo, setDateTo] = useState(defaultRange.to)
  const [paymentType, setPaymentType] = useState('')

  const [kpi, setKpi] = useState<SalesKPI>({ totalSales: 0, slipCount: 0, supplyAmount: 0, unpaid: 0 })
  const [monthly, setMonthly] = useState<MonthlySales[]>([])
  const [partnerRows, setPartnerRows] = useState<PartnerSales[]>([])
  const [channelRows, setChannelRows] = useState<ChannelSales[]>([])
  const [slips, setSlips] = useState<SalesSlip[]>([])
  const [loading, setLoading] = useState(true)

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState<PageSize>(50)
  const [keyword, setKeyword] = useState('')
  const [detailSlipId, setDetailSlipId] = useState<string | null>(null)

  const filter: SalesFilter = {
    businessId: selectedBusinessId,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    paymentType: paymentType || undefined,
  }

  const load = useCallback(async () => {
    setLoading(true)
    setCurrentPage(1)
    try {
      const [k, m, p, c, s] = await Promise.all([
        fetchSalesKPI(filter),
        fetchMonthlySales(selectedBusinessId),
        fetchPartnerSales(filter),
        fetchChannelSalesAgg(filter),
        fetchSalesSlips(filter),
      ])
      setKpi(k)
      setMonthly(m)
      setPartnerRows(p)
      setChannelRows(c)
      setSlips(s)
    } catch {
      toast.error('데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBusinessId, dateFrom, dateTo, paymentType])

  useEffect(() => { load() }, [load])
  useEffect(() => { setCurrentPage(1) }, [pageSize])

  const filtered = keyword
    ? slips.filter(s => {
        const kw = keyword.toLowerCase()
        return (
          s.slip_no.toLowerCase().includes(kw) ||
          (s.partner?.name ?? '').toLowerCase().includes(kw) ||
          (s.channel?.name ?? '').toLowerCase().includes(kw)
        )
      })
    : slips

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const totalPartner = partnerRows.reduce((s, r) => s + r.amount, 0)
  const totalChannel = channelRows.reduce((s, r) => s + r.amount, 0)

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#1d1d1f]">매출 집계</h1>
          <p className="text-sm text-[#86868b] mt-0.5">기간별 매출 현황 및 분석</p>
        </div>
      </div>

      {/* 필터 */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-black/[0.06] shadow-card p-4">
        <div className="flex flex-wrap gap-3 items-center">
          {/* 날짜 범위 */}
          <div className="flex items-center gap-1.5">
            <input
              type="date" value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="rounded-lg border border-gray-300/60 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <span className="text-xs text-[#86868b]">~</span>
            <input
              type="date" value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="rounded-lg border border-gray-300/60 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* 결제 방식 */}
          <select
            value={paymentType}
            onChange={e => setPaymentType(e.target.value)}
            className="rounded-lg border border-gray-300/60 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">결제 전체</option>
            <option value="cash">현금</option>
            <option value="credit">외상</option>
            <option value="mixed">혼합</option>
          </select>

          {/* 빠른 기간 */}
          <div className="inline-flex bg-gray-100 rounded-lg p-0.5">
            {[
              { label: '이번달', fn: () => { const r = getDefaultRange(); setDateFrom(r.from); setDateTo(r.to) } },
              { label: '3개월', fn: () => { const now = new Date(); setDateFrom(new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().slice(0, 10)); setDateTo(now.toISOString().slice(0, 10)) } },
              { label: '6개월', fn: () => { const now = new Date(); setDateFrom(new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().slice(0, 10)); setDateTo(now.toISOString().slice(0, 10)) } },
              { label: '올해', fn: () => { const y = new Date().getFullYear(); setDateFrom(`${y}-01-01`); setDateTo(`${y}-12-31`) } },
            ].map(({ label, fn }) => (
              <button key={label} onClick={fn}
                className="px-3 py-1.5 text-xs font-medium rounded-md text-[#86868b] hover:bg-white hover:text-[#1d1d1f] hover:shadow-sm transition">
                {label}
              </button>
            ))}
          </div>

          <button onClick={() => { const r = getDefaultRange(); setDateFrom(r.from); setDateTo(r.to); setPaymentType('') }}
            className="text-xs text-[#86868b] hover:text-[#ff3b30] transition ml-auto">
            초기화
          </button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: '매출 합계', value: `₩${fmt(kpi.totalSales)}`, sub: '부가세 포함', color: 'text-[#007aff]' },
          { label: '전표 건수', value: `${fmt(kpi.slipCount)}건`, sub: '매출 전표', color: 'text-[#1d1d1f]' },
          { label: '공급가액', value: `₩${fmt(kpi.supplyAmount)}`, sub: '부가세 제외', color: 'text-[#1d1d1f]' },
          { label: '미수금', value: `₩${fmt(kpi.unpaid)}`, sub: '외상 미회수', color: kpi.unpaid > 0 ? 'text-[#ff9f0a]' : 'text-[#34c759]' },
        ].map(card => (
          <div key={card.label} className="bg-white/80 backdrop-blur-xl rounded-2xl border border-black/[0.06] shadow-card p-5">
            <p className="text-xs font-medium text-[#86868b] mb-1">{card.label}</p>
            <p className={`text-xl font-semibold ${card.color}`}>{loading ? '–' : card.value}</p>
            <p className="text-xs text-[#86868b] mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* 6개월 추이 차트 */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-black/[0.06] shadow-card p-5">
        <h2 className="text-sm font-semibold text-[#1d1d1f] mb-4">최근 6개월 매출·매입 추이</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={monthly} barSize={20} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#86868b' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#86868b' }} axisLine={false} tickLine={false}
              tickFormatter={v => `${(v / 10000).toFixed(0)}만`} />
            <Tooltip
              formatter={(value, name) => [`₩${fmt(Number(value ?? 0))}`, name === 'sales' ? '매출' : '매입'] as [string, string]}
              contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', fontSize: 12 }}
            />
            <Legend formatter={v => v === 'sales' ? '매출' : '매입'} iconType="circle" iconSize={8}
              wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="sales" fill="#007aff" radius={[4, 4, 0, 0]} />
            <Bar dataKey="purchase" fill="#e5e5ea" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 거래처별 + 채널별 매출 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 거래처별 */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-black/[0.06] shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-[#1d1d1f]">거래처별 매출 상위</h2>
          </div>
          {loading ? (
            <div className="py-8 text-center text-sm text-[#86868b]">불러오는 중...</div>
          ) : partnerRows.length === 0 ? (
            <div className="py-8 text-center text-sm text-[#86868b]">데이터 없음</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {partnerRows.slice(0, 8).map((row, i) => {
                const pct = totalPartner > 0 ? (row.amount / totalPartner) * 100 : 0
                return (
                  <div key={row.partnerId} className="px-5 py-3 flex items-center gap-3">
                    <span className="w-5 text-xs font-medium text-[#86868b]">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-[#1d1d1f] truncate">{row.partnerName}</span>
                        <span className="text-xs font-semibold text-[#007aff] ml-2 flex-shrink-0">₩{fmt(row.amount)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-[#007aff] rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-[#86868b] w-10 text-right">{pct.toFixed(1)}%</span>
                        <span className="text-xs text-[#86868b] w-8 text-right">{row.count}건</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 채널별 */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-black/[0.06] shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-[#1d1d1f]">채널별 매출</h2>
          </div>
          {loading ? (
            <div className="py-8 text-center text-sm text-[#86868b]">불러오는 중...</div>
          ) : channelRows.length === 0 ? (
            <div className="py-8 text-center text-sm text-[#86868b]">데이터 없음</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {channelRows.map((row, i) => {
                const pct = totalChannel > 0 ? (row.amount / totalChannel) * 100 : 0
                const colors = ['#007aff', '#34c759', '#ff9f0a', '#ff3b30', '#af52de', '#5ac8fa']
                const color = colors[i % colors.length]
                return (
                  <div key={row.channelId} className="px-5 py-3 flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-[#1d1d1f] truncate">{row.channelName}</span>
                        <span className="text-xs font-semibold ml-2 flex-shrink-0" style={{ color }}>₩{fmt(row.amount)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                        </div>
                        <span className="text-xs text-[#86868b] w-10 text-right">{pct.toFixed(1)}%</span>
                        <span className="text-xs text-[#86868b] w-8 text-right">{row.count}건</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* 전표 목록 */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-black/[0.06] shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-sm font-semibold text-[#1d1d1f]">매출 전표 목록</h2>
          <div className="flex items-center gap-2">
            <input
              type="text" value={keyword} onChange={e => setKeyword(e.target.value)}
              placeholder="전표번호·거래처·채널 검색..."
              className="rounded-lg border border-gray-300/60 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-48"
            />
            <select
              value={pageSize}
              onChange={e => setPageSize(Number(e.target.value) as PageSize)}
              className="rounded-lg border border-gray-300/60 bg-white px-2 py-1.5 text-xs focus:outline-none"
            >
              <option value={10}>10개</option>
              <option value={50}>50개</option>
              <option value={100}>100개</option>
            </select>
            <span className="text-xs text-[#86868b]">총 {filtered.length}건</span>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-[#86868b]">불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-[#86868b]">매출 전표가 없습니다.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50/80">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-[#86868b]">전표번호</th>
                    <th className="text-left px-4 py-3 font-medium text-[#86868b]">일자</th>
                    <th className="text-left px-4 py-3 font-medium text-[#86868b]">거래처</th>
                    <th className="text-left px-4 py-3 font-medium text-[#86868b]">채널</th>
                    <th className="text-left px-4 py-3 font-medium text-[#86868b]">결제</th>
                    <th className="text-right px-4 py-3 font-medium text-[#86868b]">공급가액</th>
                    <th className="text-right px-4 py-3 font-medium text-[#86868b]">부가세</th>
                    <th className="text-right px-4 py-3 font-medium text-[#86868b]">합계</th>
                    <th className="text-right px-4 py-3 font-medium text-[#86868b]">미수금</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginated.map((slip, idx) => {
                    const unpaid = slip.total_amount - slip.paid_amount
                    return (
                      <tr
                        key={slip.id}
                        onClick={() => setDetailSlipId(slip.id)}
                        className={`hover:bg-blue-50/40 transition cursor-pointer ${idx % 2 === 1 ? 'bg-gray-50/40' : ''}`}
                      >
                        <td className="px-4 py-3 font-medium text-[#1d1d1f]">{slip.slip_no}</td>
                        <td className="px-4 py-3 text-[#86868b] whitespace-nowrap">
                          {new Date(slip.slip_date).toLocaleDateString('ko-KR')}
                        </td>
                        <td className="px-4 py-3 text-[#86868b]">
                          {slip.partner?.name ?? <span className="text-gray-300">–</span>}
                        </td>
                        <td className="px-4 py-3 text-[#86868b]">
                          {slip.channel?.name ?? <span className="text-gray-300">–</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${PAYMENT_COLOR[slip.payment_type] ?? ''}`}>
                            {PAYMENT_LABEL[slip.payment_type] ?? slip.payment_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-[#86868b]">₩{fmt(slip.supply_amount)}</td>
                        <td className="px-4 py-3 text-right text-[#86868b]">₩{fmt(slip.tax_amount)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-[#1d1d1f]">₩{fmt(slip.total_amount)}</td>
                        <td className="px-4 py-3 text-right">
                          {unpaid > 0
                            ? <span className="font-medium text-[#ff3b30]">₩{fmt(unpaid)}</span>
                            : <span className="text-[#34c759]">완납</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition"
                >
                  이전
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    let page: number
                    if (totalPages <= 7) page = i + 1
                    else if (currentPage <= 4) page = i + 1
                    else if (currentPage >= totalPages - 3) page = totalPages - 6 + i
                    else page = currentPage - 3 + i
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-7 h-7 text-xs rounded-lg transition ${
                          currentPage === page
                            ? 'bg-[#007aff] text-white font-medium'
                            : 'text-[#86868b] hover:bg-gray-100'
                        }`}
                      >
                        {page}
                      </button>
                    )
                  })}
                </div>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition"
                >
                  다음
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {detailSlipId && (
        <SlipDetailModal
          slipId={detailSlipId}
          onClose={() => setDetailSlipId(null)}
          onDeleted={() => { setDetailSlipId(null); load() }}
        />
      )}
    </div>
  )
}
