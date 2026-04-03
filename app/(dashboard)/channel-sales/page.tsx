'use client'

import { useEffect, useState, useCallback } from 'react'
import { useBusinessStore } from '@/store/businessStore'
import {
  fetchChannelSalesAgg, fetchChannelMonthlyBreakdown, fetchSalesSlips,
  type SalesFilter, type ChannelSales, type ChannelMonthlyBreakdown, type SalesSlip,
} from '@/lib/supabase/sales'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { toast } from 'sonner'
import SlipDetailModal from '../transactions/SlipDetailModal'

function fmt(n: number) { return new Intl.NumberFormat('ko-KR').format(n) }

const CHANNEL_COLORS = ['#007aff', '#34c759', '#ff9f0a', '#ff3b30', '#af52de', '#5ac8fa', '#ff6b35', '#32d74b']

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

export default function ChannelSalesPage() {
  const { selectedBusinessId } = useBusinessStore()

  const defaultRange = getDefaultRange()
  const [dateFrom, setDateFrom] = useState(defaultRange.from)
  const [dateTo, setDateTo] = useState(defaultRange.to)
  const [selectedChannelId, setSelectedChannelId] = useState('')

  const [channelRows, setChannelRows] = useState<ChannelSales[]>([])
  const [breakdown, setBreakdown] = useState<ChannelMonthlyBreakdown>({ months: [], series: [] })
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
    channelId: selectedChannelId || undefined,
  }

  const load = useCallback(async () => {
    setLoading(true)
    setCurrentPage(1)
    try {
      const [c, b, s] = await Promise.all([
        fetchChannelSalesAgg(filter),
        fetchChannelMonthlyBreakdown(selectedBusinessId),
        fetchSalesSlips(filter),
      ])
      setChannelRows(c)
      setBreakdown(b)
      setSlips(s)
    } catch {
      toast.error('데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBusinessId, dateFrom, dateTo, selectedChannelId])

  useEffect(() => { load() }, [load])
  useEffect(() => { setCurrentPage(1) }, [pageSize])

  // Recharts용 grouped bar 데이터 변환
  const chartData = breakdown.months.map((month, mi) => {
    const row: Record<string, string | number> = { month }
    for (const s of breakdown.series) {
      row[s.channelName] = s.data[mi]
    }
    return row
  })

  const totalSales = channelRows.reduce((s, r) => s + r.amount, 0)

  const filteredSlips = keyword
    ? slips.filter(s => {
        const kw = keyword.toLowerCase()
        return (
          s.slip_no.toLowerCase().includes(kw) ||
          (s.partner?.name ?? '').toLowerCase().includes(kw) ||
          (s.channel?.name ?? '').toLowerCase().includes(kw)
        )
      })
    : slips

  const totalPages = Math.max(1, Math.ceil(filteredSlips.length / pageSize))
  const paginated = filteredSlips.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // KPI 계산
  const topChannel = channelRows[0]
  const avgPerSlip = slips.length > 0 ? Math.round(totalSales / slips.length) : 0

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-xl font-semibold text-[#1d1d1f]">채널별 매출</h1>
        <p className="text-sm text-[#86868b] mt-0.5">판매채널별 매출 현황 및 추이 분석</p>
      </div>

      {/* 필터 */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-black/[0.06] shadow-card p-4">
        <div className="flex flex-wrap gap-3 items-center">
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

          {/* 채널 필터 */}
          <select
            value={selectedChannelId}
            onChange={e => setSelectedChannelId(e.target.value)}
            className="rounded-lg border border-gray-300/60 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">채널 전체</option>
            {channelRows.map(c => (
              <option key={c.channelId} value={c.channelId}>{c.channelName}</option>
            ))}
          </select>

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

          <button
            onClick={() => { const r = getDefaultRange(); setDateFrom(r.from); setDateTo(r.to); setSelectedChannelId('') }}
            className="text-xs text-[#86868b] hover:text-[#ff3b30] transition ml-auto"
          >
            초기화
          </button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: '총 매출', value: `₩${fmt(totalSales)}`, sub: '전 채널 합계', color: 'text-[#007aff]' },
          { label: '활성 채널', value: `${channelRows.length}개`, sub: '매출 발생 채널', color: 'text-[#1d1d1f]' },
          { label: '최고 채널', value: topChannel?.channelName ?? '–', sub: topChannel ? `₩${fmt(topChannel.amount)}` : '–', color: 'text-[#34c759]' },
          { label: '건당 평균', value: `₩${fmt(avgPerSlip)}`, sub: `총 ${fmt(slips.length)}건`, color: 'text-[#1d1d1f]' },
        ].map(card => (
          <div key={card.label} className="bg-white/80 backdrop-blur-xl rounded-2xl border border-black/[0.06] shadow-card p-5">
            <p className="text-xs font-medium text-[#86868b] mb-1">{card.label}</p>
            <p className={`text-xl font-semibold truncate ${card.color}`}>{loading ? '–' : card.value}</p>
            <p className="text-xs text-[#86868b] mt-0.5">{loading ? '–' : card.sub}</p>
          </div>
        ))}
      </div>

      {/* 채널별 월별 추이 차트 + 채널 점유율 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 월별 추이 */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-black/[0.06] shadow-card p-5">
          <h2 className="text-sm font-semibold text-[#1d1d1f] mb-4">채널별 6개월 매출 추이</h2>
          {breakdown.series.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-sm text-[#86868b]">
              {loading ? '불러오는 중...' : '채널 데이터 없음'}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} barSize={12} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#86868b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#86868b' }} axisLine={false} tickLine={false}
                  tickFormatter={v => `${(v / 10000).toFixed(0)}만`} />
                <Tooltip
                  formatter={(value, name) => [`₩${fmt(Number(value ?? 0))}`, name] as [string, string]}
                  contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', fontSize: 12 }}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                {breakdown.series.map((s, i) => (
                  <Bar key={s.channelId} dataKey={s.channelName}
                    fill={CHANNEL_COLORS[i % CHANNEL_COLORS.length]}
                    radius={[3, 3, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 채널 점유율 */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-black/[0.06] shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-[#1d1d1f]">채널별 매출 점유율</h2>
          </div>
          {loading ? (
            <div className="py-8 text-center text-sm text-[#86868b]">불러오는 중...</div>
          ) : channelRows.length === 0 ? (
            <div className="py-8 text-center text-sm text-[#86868b]">데이터 없음</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {channelRows.map((row, i) => {
                const pct = totalSales > 0 ? (row.amount / totalSales) * 100 : 0
                const color = CHANNEL_COLORS[i % CHANNEL_COLORS.length]
                return (
                  <div
                    key={row.channelId}
                    onClick={() => setSelectedChannelId(selectedChannelId === row.channelId ? '' : row.channelId)}
                    className={`px-5 py-3 flex items-center gap-3 cursor-pointer transition ${
                      selectedChannelId === row.channelId ? 'bg-blue-50/60' : 'hover:bg-gray-50/60'
                    }`}
                  >
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-[#1d1d1f] truncate">{row.channelName}</span>
                        <span className="text-xs font-semibold ml-2 flex-shrink-0" style={{ color }}>₩{fmt(row.amount)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
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
          <h2 className="text-sm font-semibold text-[#1d1d1f]">
            매출 전표 목록
            {selectedChannelId && channelRows.find(c => c.channelId === selectedChannelId) && (
              <span className="ml-2 text-xs font-normal text-[#007aff]">
                — {channelRows.find(c => c.channelId === selectedChannelId)?.channelName}
              </span>
            )}
          </h2>
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
            <span className="text-xs text-[#86868b]">총 {filteredSlips.length}건</span>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-[#86868b]">불러오는 중...</div>
        ) : filteredSlips.length === 0 ? (
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
                    <th className="text-right px-4 py-3 font-medium text-[#86868b]">합계</th>
                    <th className="text-right px-4 py-3 font-medium text-[#86868b]">미수금</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginated.map((slip, idx) => {
                    const unpaid = slip.total_amount - slip.paid_amount
                    const chIdx = channelRows.findIndex(c => c.channelId === slip.channel?.id)
                    const chColor = chIdx >= 0 ? CHANNEL_COLORS[chIdx % CHANNEL_COLORS.length] : '#86868b'
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
                        <td className="px-4 py-3">
                          {slip.channel ? (
                            <span className="inline-flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: chColor }} />
                              <span className="text-[#1d1d1f]">{slip.channel.name}</span>
                            </span>
                          ) : <span className="text-gray-300">–</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${PAYMENT_COLOR[slip.payment_type] ?? ''}`}>
                            {PAYMENT_LABEL[slip.payment_type] ?? slip.payment_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-[#86868b]">₩{fmt(slip.supply_amount)}</td>
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
                          currentPage === page ? 'bg-[#007aff] text-white font-medium' : 'text-[#86868b] hover:bg-gray-100'
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
