'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import PageHeader from '@/components/ui/PageHeader'
import { SortableHeader, useSortable } from '@/components/ui/SortableHeader'
import {
  getSalesSlips, getSalesByProduct, getSalesMonthlyTrend,
  SalesSummaryRow, SalesByProduct, MonthlyTrendRow,
} from '@/lib/supabase/sales'
import { getBusinesses } from '@/lib/supabase/businesses'
import { getChannels } from '@/lib/supabase/channels'
import { Business, Channel } from '@/lib/types'
import { formatMoney } from '@/lib/utils/format'

type ViewTab = 'slip' | 'product'

const PAYMENT_LABEL: Record<string, string> = { cash: '현금', credit: '외상', mixed: '혼합' }

function MarginBadge({ rate }: { rate: number }) {
  if (rate <= 0) return <span className="text-gray-300 text-xs">-</span>
  const color = rate >= 30 ? 'text-green-600' : rate >= 15 ? 'text-blue-600' : 'text-orange-500'
  return <span className={`text-xs font-semibold ${color}`}>{rate}%</span>
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-xs">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="mb-0.5">
          {p.name}: {p.value.toLocaleString()}원
        </p>
      ))}
    </div>
  )
}

export default function SalesPage() {
  const [slips, setSlips] = useState<SalesSummaryRow[]>([])
  const [byProduct, setByProduct] = useState<SalesByProduct[]>([])
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrendRow[]>([])
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [trendLoading, setTrendLoading] = useState(true)
  const [syncLoading, setSyncLoading] = useState(false)
  const [autoSyncing, setAutoSyncing] = useState(false)
  const [view, setView] = useState<ViewTab>('slip')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [bizFilter, setBizFilter] = useState('all')
  const [chFilter, setChFilter] = useState('all')
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10)
  })
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10))

  useEffect(() => {
    Promise.all([getBusinesses(), getChannels()]).then(([b, c]) => {
      setBusinesses(b); setChannels(c)
    })
  }, [])

  const loadTrend = useCallback(async () => {
    setTrendLoading(true)
    try {
      const biz = bizFilter !== 'all' ? bizFilter : undefined
      setMonthlyTrend(await getSalesMonthlyTrend(biz, 6))
    } catch { /* 무시 */ }
    finally { setTrendLoading(false) }
  }, [bizFilter])

  const load = useCallback(async () => {
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
  }, [bizFilter, chFilter, fromDate, toDate])

  useEffect(() => { load(); loadTrend() }, [load, loadTrend])
  useEffect(() => { setPage(1) }, [bizFilter, chFilter, fromDate, toDate, view])

  // 페이지 접속 시 네이버 주문 자동 동기화 (백그라운드, 조용히)
  useEffect(() => {
    async function autoSync() {
      setAutoSyncing(true)
      try {
        // 네이버 API 설정된 사업자 목록 조회 후 각각 동기화
        const settingsRes = await fetch('/api/settings/api-keys')
        const settingsData = await settingsRes.json()
        const naverSettings = (settingsData.settings ?? []).filter(
          (s: { provider: string }) => s.provider === 'naver_commerce'
        )
        if (naverSettings.length === 0) return

        let totalSynced = 0
        await Promise.all(
          naverSettings.map(async (s: { business_id: string }) => {
            const res = await fetch('/api/naver/sync/orders', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ days: 30, business_id: s.business_id }),
            })
            const data = await res.json()
            if (data.success) totalSynced += data.synced ?? 0
          })
        )
        if (totalSynced > 0) { load(); loadTrend() }
      } catch { /* 미연동 시 무시 */ }
      finally { setAutoSyncing(false) }
    }
    autoSync()
  }, []) // eslint-disable-line

  // 네이버 주문 → slip 동기화
  async function handleNaverSync() {
    const businessId = bizFilter !== 'all' ? bizFilter : businesses[0]?.id
    if (!businessId) return toast.error('사업자를 선택해주세요')
    setSyncLoading(true)
    try {
      const res = await fetch('/api/naver/sync/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 30, business_id: businessId }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error ?? '동기화 실패')
      toast.success(
        data.synced > 0
          ? `네이버 주문 ${data.synced}건 동기화 완료 (스킵 ${data.skipped ?? 0}건)`
          : '새로 동기화할 주문이 없습니다'
      )
      if (data.synced > 0) { load(); loadTrend() }
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally {
      setSyncLoading(false)
    }
  }

  // ── 집계 ──────────────────────────────────────────────
  const totalSupply   = slips.reduce((s, r) => s + r.supply_amount, 0)
  const totalTax      = slips.reduce((s, r) => s + r.tax_amount, 0)
  const totalAmount   = slips.reduce((s, r) => s + r.total_amount, 0)
  const totalBuy      = slips.reduce((s, r) => s + r.buy_amount, 0)
  const totalProfit   = slips.reduce((s, r) => s + r.profit_amount, 0)
  const overallMargin = totalSupply > 0 && totalBuy > 0
    ? Math.round(totalProfit / totalSupply * 100) : 0
  const cashCount   = slips.filter(r => r.payment_type === 'cash').length
  const creditCount = slips.filter(r => r.payment_type === 'credit').length

  // 정렬
  const { sorted: sortedSlips,    criteria: slipCriteria, toggle: slipToggle    } = useSortable(slips)
  const { sorted: sortedProducts, criteria: prodCriteria, toggle: prodToggle    } = useSortable(byProduct)

  // 페이지네이션 (정렬된 데이터 기준)
  const totalPages  = Math.max(1, Math.ceil(sortedSlips.length / pageSize))
  const pagedSlips    = sortedSlips.slice((page - 1) * pageSize, page * pageSize)
  const pagedProducts = sortedProducts.slice((page - 1) * pageSize, page * pageSize)
  const totalProductPages = Math.max(1, Math.ceil(sortedProducts.length / pageSize))

  // 전월 비교 (trend 마지막 2개월)
  const prevMonth = monthlyTrend.at(-2)
  const curMonth  = monthlyTrend.at(-1)
  const revenueGrowth = prevMonth && prevMonth.revenue > 0
    ? Math.round((((curMonth?.revenue ?? 0) - prevMonth.revenue) / prevMonth.revenue) * 100)
    : null

  // 차트 최대값
  const maxTrend = Math.max(...monthlyTrend.map(m => m.revenue), 1)

  return (
    <div>
      <PageHeader
        title="매출 현황"
        action={
          <div className="flex items-center gap-2">
            {autoSyncing && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <span className="inline-block w-3 h-3 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                네이버 자동 동기화 중...
              </span>
            )}
            <button
              onClick={handleNaverSync}
              disabled={syncLoading || autoSyncing}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <span className="w-4 h-4 bg-white/30 rounded text-xs font-bold flex items-center justify-center">N</span>
              {syncLoading ? '동기화 중...' : '수동 동기화'}
            </button>
          </div>
        }
      />

      {/* ── 월별 추이 차트 ─────────────────────────────────── */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-semibold text-gray-800">월별 매출 추이 <span className="text-xs text-gray-400 font-normal">(최근 6개월)</span></p>
            {revenueGrowth !== null && (
              <p className={`text-xs mt-0.5 ${revenueGrowth >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                이번 달 전월 대비 <span className="font-bold">{revenueGrowth >= 0 ? '+' : ''}{revenueGrowth}%</span>
              </p>
            )}
          </div>
          <div className="flex gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-400 inline-block" />매출</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-400 inline-block" />이익</span>
          </div>
        </div>
        {trendLoading ? (
          <div className="h-44 flex items-center justify-center text-sm text-gray-400">불러오는 중...</div>
        ) : (
          <ResponsiveContainer width="100%" height={176}>
            <BarChart data={monthlyTrend} barGap={2} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => v >= 10000 ? `${Math.round(v / 10000)}만` : String(v)}
                width={48}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="revenue" name="매출" radius={[4, 4, 0, 0]}>
                {monthlyTrend.map((m, i) => (
                  <Cell
                    key={m.month}
                    fill={i === monthlyTrend.length - 1 ? '#3b82f6' : '#bfdbfe'}
                  />
                ))}
              </Bar>
              <Bar dataKey="profit" name="이익" radius={[4, 4, 0, 0]}>
                {monthlyTrend.map((m, i) => (
                  <Cell
                    key={m.month}
                    fill={i === monthlyTrend.length - 1 ? '#10b981' : '#a7f3d0'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
        {/* 요약 행 */}
        {!trendLoading && (
          <div className="grid grid-cols-6 gap-2 mt-3 border-t border-gray-50 pt-3">
            {monthlyTrend.map((m, i) => {
              const isLast = i === monthlyTrend.length - 1
              const marginPct = m.supply > 0 && m.profit > 0
                ? Math.round(m.profit / m.supply * 100) : 0
              return (
                <div key={m.month} className={`text-center text-xs ${isLast ? 'text-blue-700' : 'text-gray-500'}`}>
                  <p className="font-medium">{m.label}</p>
                  <p className={isLast ? 'font-bold' : ''}>{Math.round(m.revenue / 10000)}만</p>
                  {marginPct > 0 && (
                    <p className="text-emerald-500">{marginPct}%</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── 필터 ────────────────────────────────────────── */}
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

      {/* ── 요약 카드 ────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <p className="text-xs text-gray-500 mb-1">전표 수</p>
          <p className="text-2xl font-bold text-gray-900">{slips.length}<span className="text-sm font-normal text-gray-400 ml-1">건</span></p>
          <p className="text-xs text-gray-400 mt-0.5">현금 {cashCount} · 외상 {creditCount}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <p className="text-xs text-gray-500 mb-1">공급가액</p>
          <p className="text-2xl font-bold text-blue-600">{formatMoney(totalSupply)}<span className="text-sm font-normal text-gray-400 ml-1">원</span></p>
          <p className="text-xs text-gray-400 mt-0.5">부가세 {formatMoney(totalTax)}원</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <p className="text-xs text-gray-500 mb-1">합계 (부가세 포함)</p>
          <p className="text-2xl font-bold text-gray-900">{formatMoney(totalAmount)}<span className="text-sm font-normal text-gray-400 ml-1">원</span></p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <p className="text-xs text-gray-500 mb-1">매입원가</p>
          <p className="text-2xl font-bold text-orange-500">
            {totalBuy > 0 ? formatMoney(totalBuy) : '—'}<span className="text-sm font-normal text-gray-400 ml-1">{totalBuy > 0 ? '원' : ''}</span>
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{totalBuy > 0 ? '상품 원가 합계' : '원가 미등록'}</p>
        </div>
        <div className={`border rounded-2xl p-4 ${overallMargin >= 30 ? 'bg-green-50 border-green-100' : overallMargin > 0 ? 'bg-blue-50 border-blue-100' : 'bg-white border-gray-100'}`}>
          <p className="text-xs text-gray-500 mb-1">이익 / 이익률</p>
          <p className={`text-2xl font-bold ${overallMargin >= 30 ? 'text-green-700' : overallMargin > 0 ? 'text-blue-700' : 'text-gray-400'}`}>
            {totalProfit > 0 ? `${formatMoney(totalProfit)}` : '—'}<span className="text-sm font-normal ml-1">{totalProfit > 0 ? '원' : ''}</span>
          </p>
          {overallMargin > 0 && (
            <p className={`text-xs font-semibold mt-0.5 ${overallMargin >= 30 ? 'text-green-600' : 'text-blue-600'}`}>이익률 {overallMargin}%</p>
          )}
        </div>
      </div>

      {/* ── 뷰 탭 ───────────────────────────────────────── */}
      <div className="flex items-center gap-1 mb-4 border-b border-gray-200">
        {([['slip', '전표별'], ['product', '상품별']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setView(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${view === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-900'}`}>
            {label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 pb-1">
          <span className="text-xs text-gray-400">페이지당</span>
          <div className="flex border border-gray-200 rounded-lg overflow-hidden">
            {[20, 50, 100].map(n => (
              <button key={n} onClick={() => { setPageSize(n); setPage(1) }}
                className={`px-3 py-1 text-xs font-medium transition-colors ${pageSize === n ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                {n}
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-500">
            {view === 'slip'
              ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, slips.length)} / ${slips.length}건`
              : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, byProduct.length)} / ${byProduct.length}건`
            }
          </span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">불러오는 중...</div>
        ) : view === 'slip' ? (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs">
              <tr>
                <SortableHeader field="slip_date"     criteria={slipCriteria} onSort={slipToggle}>날짜</SortableHeader>
                <SortableHeader field="partner_name"  criteria={slipCriteria} onSort={slipToggle}>거래처</SortableHeader>
                <SortableHeader field="channel_name"  criteria={slipCriteria} onSort={slipToggle}>채널</SortableHeader>
                <SortableHeader field="payment_type"  criteria={slipCriteria} onSort={slipToggle}>결제</SortableHeader>
                <SortableHeader field="supply_amount" criteria={slipCriteria} onSort={slipToggle} align="right">공급가</SortableHeader>
                <SortableHeader field="tax_amount"    criteria={slipCriteria} onSort={slipToggle} align="right">부가세</SortableHeader>
                <SortableHeader field="total_amount"  criteria={slipCriteria} onSort={slipToggle} align="right">합계</SortableHeader>
                <SortableHeader field="buy_amount"    criteria={slipCriteria} onSort={slipToggle} align="right">원가</SortableHeader>
                <SortableHeader field="profit_amount" criteria={slipCriteria} onSort={slipToggle} align="right">이익</SortableHeader>
                <SortableHeader field="margin_rate"   criteria={slipCriteria} onSort={slipToggle} align="center">이익률</SortableHeader>
                <th className="px-4 py-3 text-left text-gray-500 font-medium text-xs">세금계산서</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {slips.length === 0 && (
                <tr><td colSpan={11} className="px-4 py-12 text-center text-gray-400">매출 내역이 없습니다</td></tr>
              )}
              {pagedSlips.map(r => (
                <tr key={r.slip_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600 whitespace-nowrap">{r.slip_date}</td>
                  <td className="px-4 py-3">{r.partner_name ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{r.channel_name ?? '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      r.payment_type === 'cash' ? 'bg-green-100 text-green-700' :
                      r.payment_type === 'credit' ? 'bg-orange-100 text-orange-700' :
                      'bg-purple-100 text-purple-700'
                    }`}>
                      {PAYMENT_LABEL[r.payment_type] ?? r.payment_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">{formatMoney(r.supply_amount)}원</td>
                  <td className="px-4 py-3 text-right text-gray-500">{formatMoney(r.tax_amount)}원</td>
                  <td className="px-4 py-3 text-right font-bold">{formatMoney(r.total_amount)}원</td>
                  <td className="px-4 py-3 text-right text-orange-500">
                    {r.buy_amount > 0 ? `${formatMoney(r.buy_amount)}원` : <span className="text-gray-300">-</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.buy_amount > 0
                      ? <span className={r.profit_amount >= 0 ? 'text-blue-600 font-medium' : 'text-red-500 font-medium'}>{formatMoney(r.profit_amount)}원</span>
                      : <span className="text-gray-300">-</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-center">
                    <MarginBadge rate={r.margin_rate} />
                  </td>
                  <td className="px-4 py-3">
                    {r.is_tax_invoice
                      ? <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">발행</span>
                      : <span className="text-gray-300 text-xs">-</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs">
              <tr>
                <th className="px-4 py-3 text-left text-gray-500 font-medium">순위</th>
                <SortableHeader field="product_name"  criteria={prodCriteria} onSort={prodToggle}>상품명</SortableHeader>
                <SortableHeader field="category"      criteria={prodCriteria} onSort={prodToggle}>카테고리</SortableHeader>
                <SortableHeader field="total_quantity" criteria={prodCriteria} onSort={prodToggle}>판매수량</SortableHeader>
                <SortableHeader field="total_amount"  criteria={prodCriteria} onSort={prodToggle} align="right">공급가합계</SortableHeader>
                <SortableHeader field="buy_amount"    criteria={prodCriteria} onSort={prodToggle} align="right">매입원가</SortableHeader>
                <SortableHeader field="profit_amount" criteria={prodCriteria} onSort={prodToggle} align="right">이익</SortableHeader>
                <SortableHeader field="margin_rate"   criteria={prodCriteria} onSort={prodToggle} align="center">이익률</SortableHeader>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {byProduct.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">데이터가 없습니다</td></tr>
              )}
              {pagedProducts.map((p, i) => (
                <tr key={p.product_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400 font-bold text-xs">{i + 1}</td>
                  <td className="px-4 py-3 font-medium">{p.product_name}</td>
                  <td className="px-4 py-3 text-gray-500">{p.category ?? '-'}</td>
                  <td className="px-4 py-3">{p.total_quantity.toLocaleString()}</td>
                  <td className="px-4 py-3 font-bold text-right">{formatMoney(p.total_amount)}원</td>
                  <td className="px-4 py-3 text-right text-orange-500">
                    {p.buy_amount > 0 ? `${formatMoney(p.buy_amount)}원` : <span className="text-gray-300">-</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {p.buy_amount > 0
                      ? <span className={p.profit_amount >= 0 ? 'text-blue-600 font-semibold' : 'text-red-500 font-semibold'}>{formatMoney(p.profit_amount)}원</span>
                      : <span className="text-gray-300">-</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-center">
                    <MarginBadge rate={p.margin_rate} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── 페이지네이션 ─────────────────────────────────── */}
      {(() => {
        const tp = view === 'slip' ? totalPages : totalProductPages
        if (tp <= 1) return null
        const pages: (number | '...')[] = []
        if (tp <= 7) {
          for (let i = 1; i <= tp; i++) pages.push(i)
        } else {
          pages.push(1)
          if (page > 3) pages.push('...')
          for (let i = Math.max(2, page - 1); i <= Math.min(tp - 1, page + 1); i++) pages.push(i)
          if (page < tp - 2) pages.push('...')
          pages.push(tp)
        }
        return (
          <div className="flex items-center justify-center gap-1 mt-4">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">‹</button>
            {pages.map((p, i) =>
              p === '...'
                ? <span key={`${i}-dots`} className="px-2 text-gray-400">…</span>
                : <button key={p} onClick={() => setPage(p as number)}
                    className={`w-9 h-9 text-sm rounded-lg font-medium transition-colors ${page === p ? 'bg-blue-600 text-white' : 'border border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
                    {p}
                  </button>
            )}
            <button onClick={() => setPage(p => Math.min(tp, p + 1))} disabled={page === tp}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">›</button>
          </div>
        )
      })()}
    </div>
  )
}
