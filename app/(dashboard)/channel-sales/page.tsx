'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/ui/PageHeader'
import { getBusinesses } from '@/lib/supabase/businesses'
import { getSalesByChannel, getChannelMonthlySales, ChannelSaleRow } from '@/lib/supabase/channel-sales'
import { Business } from '@/lib/types'
import { formatMoney } from '@/lib/utils/format'

const COLORS = ['bg-blue-500', 'bg-violet-500', 'bg-green-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500']
const TEXT_COLORS = ['text-blue-600', 'text-violet-600', 'text-green-600', 'text-orange-600', 'text-pink-600', 'text-teal-600']

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  PURCHASE_DECIDED: { label: '구매확정', color: 'bg-green-100 text-green-700' },
  DELIVERED:        { label: '배송완료', color: 'bg-blue-100 text-blue-700' },
  DELIVERING:       { label: '배송중',   color: 'bg-sky-100 text-sky-700' },
  PAYED:            { label: '결제완료', color: 'bg-indigo-100 text-indigo-700' },
  CANCELED:         { label: '취소',     color: 'bg-red-100 text-red-600' },
  CANCEL_REQUEST:   { label: '취소요청', color: 'bg-red-100 text-red-600' },
  RETURNED:         { label: '반품',     color: 'bg-orange-100 text-orange-600' },
  RETURN_REQUEST:   { label: '반품요청', color: 'bg-orange-100 text-orange-600' },
}

function getPeriod(range: string): { from: string; to: string } {
  const today = new Date()
  const y = today.getFullYear()
  const m = today.getMonth()
  if (range === 'this_month') return { from: new Date(y, m, 1).toISOString().slice(0, 10), to: new Date(y, m + 1, 0).toISOString().slice(0, 10) }
  if (range === 'last_month') return { from: new Date(y, m - 1, 1).toISOString().slice(0, 10), to: new Date(y, m, 0).toISOString().slice(0, 10) }
  if (range === '3month')    return { from: new Date(y, m - 2, 1).toISOString().slice(0, 10), to: new Date(y, m + 1, 0).toISOString().slice(0, 10) }
  if (range === '6month')    return { from: new Date(y, m - 5, 1).toISOString().slice(0, 10), to: new Date(y, m + 1, 0).toISOString().slice(0, 10) }
  return { from: `${y}-01-01`, to: `${y}-12-31` }
}

interface NaverStats {
  summary: { total: number; totalRevenue: number; todayCount: number; todayRevenue: number; weekCount: number; weekRevenue: number; canceledCount: number; returnedCount: number }
  topProducts: { name: string; revenue: number; qty: number }[]
  daily: { date: string; count: number; revenue: number }[]
  recentOrders: { productOrderId: string; productName: string; ordererName: string; totalPaymentAmount: number; status: string; orderDate: string }[]
}

interface NaverOrder {
  productOrderId: string
  orderId: string
  orderDate: string
  paymentDate: string
  productOrderStatus: string
  productName: string
  productOption: string
  quantity: number
  unitPrice: number
  totalPaymentAmount: number
  expectedSettlementAmount: number
  discountAmount: number
  ordererName: string
  ordererTel: string
  receiverName: string
  receiverAddress: string
  deliveryCompany: string
  trackingNumber: string
  deliveryStatus: string
  inflowPath: string
  paymentMeans: string
}

const PAGE_SIZE_OPTIONS = [20, 50, 100]

export default function ChannelSalesPage() {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [bizFilter, setBizFilter] = useState('all')
  const [range, setRange] = useState('this_month')
  const [channels, setChannels] = useState<ChannelSaleRow[]>([])
  const [monthly, setMonthly] = useState<{ months: string[]; channels: string[]; data: Record<string, Record<string, number>> }>({ months: [], channels: [], data: {} })
  const [loading, setLoading] = useState(true)
  const [naverStats, setNaverStats] = useState<NaverStats | null>(null)
  const [naverLoading, setNaverLoading] = useState(true)

  // 주문 상세 목록
  const [allOrders, setAllOrders] = useState<NaverOrder[]>([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [orderSearch, setOrderSearch] = useState('')
  const [orderStatusFilter, setOrderStatusFilter] = useState('all')
  const [orderDays, setOrderDays] = useState(30)
  const [orderPage, setOrderPage] = useState(1)
  const [orderPageSize, setOrderPageSize] = useState(50)

  useEffect(() => { getBusinesses().then(setBusinesses) }, [])

  const load = useCallback(async () => {
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
  }, [bizFilter, range])

  const loadNaver = useCallback(async () => {
    setNaverLoading(true)
    try {
      const res = await fetch('/api/naver/stats')
      const data = await res.json()
      if (data.success) setNaverStats(data)
    } catch { /* 네이버 미연동 시 무시 */ }
    finally { setNaverLoading(false) }
  }, [])

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true)
    try {
      const res = await fetch(`/api/naver/orders?days=${orderDays}`)
      const data = await res.json()
      if (data.success) setAllOrders(data.orders ?? [])
    } catch { /* 무시 */ }
    finally { setOrdersLoading(false) }
  }, [orderDays])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadNaver() }, [loadNaver])
  useEffect(() => { loadOrders() }, [loadOrders])
  useEffect(() => { setOrderPage(1) }, [orderSearch, orderStatusFilter, orderDays, orderPageSize])

  const filteredOrders = useMemo(() => {
    return allOrders.filter(o => {
      const matchStatus = orderStatusFilter === 'all' || o.productOrderStatus === orderStatusFilter
      const q = orderSearch.toLowerCase()
      const matchSearch = !q || o.productName.toLowerCase().includes(q) || o.ordererName.toLowerCase().includes(q) || o.productOrderId.includes(q) || (o.trackingNumber ?? '').includes(q) || (o.receiverName ?? '').toLowerCase().includes(q)
      return matchStatus && matchSearch
    }).sort((a, b) => {
      const da = (a.paymentDate ?? a.orderDate) || ''
      const db = (b.paymentDate ?? b.orderDate) || ''
      return db.localeCompare(da)
    })
  }, [allOrders, orderSearch, orderStatusFilter])

  const orderTotalPages = Math.max(1, Math.ceil(filteredOrders.length / orderPageSize))
  const paginatedOrders = filteredOrders.slice((orderPage - 1) * orderPageSize, orderPage * orderPageSize)

  const orderSummary = useMemo(() => {
    const active = filteredOrders.filter(o => !['CANCELED', 'CANCEL_REQUEST', 'RETURNED', 'RETURN_REQUEST'].includes(o.productOrderStatus))
    return {
      totalRevenue: active.reduce((s, o) => s + o.totalPaymentAmount, 0),
      totalSettlement: active.reduce((s, o) => s + (o.expectedSettlementAmount ?? 0), 0),
      withTracking: filteredOrders.filter(o => !!o.trackingNumber).length,
    }
  }, [filteredOrders])

  const orderPageNumbers = useMemo(() => {
    const pages: (number | '...')[] = []
    if (orderTotalPages <= 7) {
      for (let i = 1; i <= orderTotalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (orderPage > 3) pages.push('...')
      for (let i = Math.max(2, orderPage - 1); i <= Math.min(orderTotalPages - 1, orderPage + 1); i++) pages.push(i)
      if (orderPage < orderTotalPages - 2) pages.push('...')
      pages.push(orderTotalPages)
    }
    return pages
  }, [orderPage, orderTotalPages])

  const totalSales = channels.reduce((s, c) => s + c.total_sales, 0)
  const totalNet = channels.reduce((s, c) => s + c.net_sales, 0)
  const totalCommission = channels.reduce((s, c) => s + c.commission_amount, 0)
  const maxSales = Math.max(...channels.map(c => c.total_sales), 1)
  const maxMonthly = Math.max(...monthly.months.flatMap(m => monthly.channels.map(ch => monthly.data[m]?.[ch] ?? 0)), 1)
  const maxDaily = naverStats ? Math.max(...naverStats.daily.map(d => d.revenue), 1) : 1

  return (
    <div>
      <PageHeader
        title="채널별 매출 현황"
        description="네이버·쿠팡·자사몰 등 판매 채널별 매출 및 수수료 분석"
      />

      {/* ── 네이버 스마트스토어 실시간 현황 ─────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 bg-green-500 rounded-md flex items-center justify-center text-white text-xs font-bold">N</div>
          <p className="text-sm font-semibold text-gray-800">네이버 스마트스토어</p>
          <span className="text-xs text-gray-400">(최근 30일 · API 실시간)</span>
          <button onClick={loadNaver} className="ml-auto text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded px-2 py-0.5">↺ 새로고침</button>
        </div>

        {naverLoading ? (
          <div className="bg-white border border-green-100 rounded-2xl p-6 text-center text-sm text-gray-400">
            네이버 데이터 불러오는 중...
          </div>
        ) : !naverStats ? (
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6 text-center text-sm text-gray-400">
            네이버 커머스 API가 연동되지 않았습니다
          </div>
        ) : (
          <div className="space-y-4">
            {/* 요약 카드 */}
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                <p className="text-xs text-green-600 mb-1">오늘 주문</p>
                <p className="text-2xl font-bold text-green-700">{naverStats.summary.todayCount}<span className="text-sm font-normal ml-1">건</span></p>
                <p className="text-xs text-green-500 mt-1">{naverStats.summary.todayRevenue.toLocaleString()}원</p>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <p className="text-xs text-blue-600 mb-1">최근 7일</p>
                <p className="text-2xl font-bold text-blue-700">{naverStats.summary.weekCount}<span className="text-sm font-normal ml-1">건</span></p>
                <p className="text-xs text-blue-500 mt-1">{naverStats.summary.weekRevenue.toLocaleString()}원</p>
              </div>
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                <p className="text-xs text-indigo-600 mb-1">30일 총 매출</p>
                <p className="text-2xl font-bold text-indigo-700">{Math.round(naverStats.summary.totalRevenue / 10000)}<span className="text-sm font-normal ml-1">만원</span></p>
                <p className="text-xs text-indigo-500 mt-1">{naverStats.summary.total}건</p>
              </div>
              <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                <p className="text-xs text-red-500 mb-1">취소·반품</p>
                <p className="text-2xl font-bold text-red-600">{naverStats.summary.canceledCount + naverStats.summary.returnedCount}<span className="text-sm font-normal ml-1">건</span></p>
                <p className="text-xs text-red-400 mt-1">취소 {naverStats.summary.canceledCount} / 반품 {naverStats.summary.returnedCount}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {/* 14일 일별 바 */}
              <div className="col-span-2 bg-white border border-gray-100 rounded-xl p-4">
                <p className="text-xs font-medium text-gray-600 mb-3">최근 14일 일별 매출</p>
                <div className="flex items-end gap-1" style={{ height: 80 }}>
                  {naverStats.daily.map(d => {
                    const pct = (d.revenue / maxDaily) * 100
                    const isToday = d.date === new Date().toISOString().slice(0, 10)
                    return (
                      <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5" title={`${d.date}: ${d.revenue.toLocaleString()}원 (${d.count}건)`}>
                        <div className="w-full flex flex-col justify-end" style={{ height: 68 }}>
                          <div className={`w-full rounded-sm ${isToday ? 'bg-green-500' : 'bg-green-200'}`} style={{ height: `${Math.max(pct, d.revenue > 0 ? 4 : 0)}%` }} />
                        </div>
                        <span className="text-gray-300 text-center" style={{ fontSize: 8 }}>{d.date.slice(8)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* 상품별 TOP5 */}
              <div className="bg-white border border-gray-100 rounded-xl p-4">
                <p className="text-xs font-medium text-gray-600 mb-3">상품별 매출 TOP 5</p>
                <div className="space-y-2">
                  {naverStats.topProducts.map((p, i) => (
                    <div key={p.name}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-gray-600 truncate max-w-[120px]" title={p.name}>
                          <span className="text-gray-400 mr-1">{i + 1}</span>{p.name}
                        </span>
                        <span className="text-gray-500 ml-1 shrink-0">{Math.round(p.revenue / 1000)}k</span>
                      </div>
                      <div className="h-1 bg-gray-100 rounded-full">
                        <div className="h-1 bg-green-400 rounded-full" style={{ width: `${naverStats.topProducts[0].revenue > 0 ? (p.revenue / naverStats.topProducts[0].revenue) * 100 : 0}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 최근 주문 */}
            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50">
                <p className="text-xs font-medium text-gray-600">최근 주문</p>
              </div>
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>{['주문일','상품명','주문자','금액','상태'].map(h => <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {naverStats.recentOrders.map(o => {
                    const st = STATUS_LABEL[o.status] ?? { label: o.status, color: 'bg-gray-100 text-gray-500' }
                    return (
                      <tr key={o.productOrderId} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-gray-400 font-mono">{o.orderDate.slice(5, 10)}</td>
                        <td className="px-4 py-2.5 font-medium text-gray-700 max-w-[200px] truncate">{o.productName}</td>
                        <td className="px-4 py-2.5 text-gray-500">{o.ordererName}</td>
                        <td className="px-4 py-2.5 font-medium text-green-600">{o.totalPaymentAmount.toLocaleString()}원</td>
                        <td className="px-4 py-2.5">
                          <span className={`px-1.5 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── 채널별 DB 집계 ─────────────────────────────────────── */}
      <div className="border-t border-gray-100 pt-6">
        <div className="flex flex-wrap gap-2 mb-5 items-center">
          <p className="text-sm font-semibold text-gray-800">채널별 매출 집계</p>
          <span className="text-xs text-gray-400">(거래 입력 기준)</span>
          <div className="ml-auto flex gap-2">
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
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">불러오는 중...</div>
        ) : channels.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400 bg-gray-50 rounded-2xl">
            <p>채널별 매출 데이터가 없습니다</p>
            <p className="text-xs mt-1">거래 입력 시 채널을 선택하면 여기에 집계됩니다</p>
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

              {/* 수수료 상세 테이블 */}
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-50">
                  <p className="text-sm font-semibold text-gray-800">수수료 차감 순매출</p>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs">
                    <tr>{['채널','총매출','수수료','순매출'].map(h => <th key={h} className="px-4 py-2.5 text-left font-medium">{h}</th>)}</tr>
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

            {/* 월별 채널 추이 */}
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
                <div className="flex items-end gap-3 mt-5" style={{ height: 100 }}>
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
            )}
          </div>
        )}
      </div>

      {/* ── 네이버 주문 상세 목록 ─────────────────────────────── */}
      <div className="border-t border-gray-100 pt-6 mt-2">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 bg-green-500 rounded-md flex items-center justify-center text-white text-xs font-bold">N</div>
          <p className="text-sm font-semibold text-gray-800">네이버 주문 상세 목록</p>
          <span className="text-xs text-gray-400">({filteredOrders.length}건)</span>
          <button onClick={loadOrders} className="ml-auto text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded px-2 py-0.5">↺ 새로고침</button>
        </div>

        {/* 툴바 */}
        <div className="flex flex-wrap gap-2 mb-3 items-center">
          <input
            placeholder="상품명·주문자·주문번호 검색"
            value={orderSearch} onChange={e => setOrderSearch(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 w-56"
          />
          <select value={orderStatusFilter} onChange={e => setOrderStatusFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500">
            <option value="all">전체 상태</option>
            {Object.entries(STATUS_LABEL).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
          </select>
          <select value={orderDays} onChange={e => setOrderDays(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500">
            <option value={7}>최근 7일</option>
            <option value={30}>최근 30일</option>
            <option value={60}>최근 60일</option>
            <option value={90}>최근 90일</option>
          </select>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-gray-400">페이지당</span>
            <div className="flex border border-gray-200 rounded-lg overflow-hidden">
              {PAGE_SIZE_OPTIONS.map(n => (
                <button key={n} onClick={() => setOrderPageSize(n)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${orderPageSize === n ? 'bg-green-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 요약 */}
        {filteredOrders.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3">
              <p className="text-xs text-green-600 mb-0.5">결제금액 합계</p>
              <p className="text-lg font-bold text-green-700">{orderSummary.totalRevenue.toLocaleString()}원</p>
            </div>
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
              <p className="text-xs text-indigo-600 mb-0.5">정산 예정금</p>
              <p className="text-lg font-bold text-indigo-700">
                {orderSummary.totalSettlement > 0 ? `${orderSummary.totalSettlement.toLocaleString()}원` : '—'}
              </p>
            </div>
            <div className="bg-sky-50 border border-sky-100 rounded-xl px-4 py-3">
              <p className="text-xs text-sky-600 mb-0.5">배송추적 가능</p>
              <p className="text-lg font-bold text-sky-700">{orderSummary.withTracking}건</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
          {ordersLoading ? (
            <div className="py-12 text-center text-sm text-gray-400">불러오는 중...</div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">주문 내역이 없습니다</div>
          ) : (
            <table className="w-full text-sm min-w-[1100px]">
              <thead className="bg-gray-50 text-gray-500 text-xs">
                <tr>
                  {['주문일', '주문번호', '상품명/옵션', '수량', '결제금액', '정산예정', '주문자', '수신자', '배송추적', '상태'].map(h => (
                    <th key={h} className="px-3 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginatedOrders.map(o => {
                  const st = STATUS_LABEL[o.productOrderStatus] ?? { label: o.productOrderStatus, color: 'bg-gray-100 text-gray-500' }
                  const date = (o.paymentDate ?? o.orderDate ?? '')
                  const hasTracking = !!o.trackingNumber
                  const settlement = o.expectedSettlementAmount ?? 0
                  return (
                    <tr key={o.productOrderId} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5 text-xs text-gray-500 font-mono whitespace-nowrap">{date.slice(0, 10)}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-400 font-mono whitespace-nowrap">{o.productOrderId}</td>
                      <td className="px-3 py-2.5 max-w-[200px]">
                        <div className="font-medium text-gray-800 text-xs line-clamp-1" title={o.productName}>{o.productName}</div>
                        {o.productOption && (
                          <div className="text-gray-400 text-xs truncate mt-0.5" title={o.productOption}>{o.productOption}</div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center text-gray-600 text-xs">{o.quantity}</td>
                      <td className="px-3 py-2.5 font-semibold text-green-600 text-xs whitespace-nowrap">
                        {o.totalPaymentAmount.toLocaleString()}원
                        {(o.discountAmount ?? 0) > 0 && (
                          <div className="text-red-400 font-normal">-{o.discountAmount.toLocaleString()}</div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                        {settlement > 0
                          ? <span className="text-indigo-600 font-medium">{settlement.toLocaleString()}원</span>
                          : <span className="text-gray-300">—</span>
                        }
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">{o.ordererName}</td>
                      <td className="px-3 py-2.5 text-xs max-w-[140px]">
                        {o.receiverName ? (
                          <>
                            <div className="text-gray-700 font-medium">{o.receiverName}</div>
                            {o.receiverAddress && (
                              <div className="text-gray-400 truncate text-xs" title={o.receiverAddress}>{o.receiverAddress}</div>
                            )}
                          </>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        {hasTracking ? (
                          <div>
                            <div className="text-gray-600 font-mono text-xs">{o.trackingNumber}</div>
                            <div className="text-gray-400 text-xs">{o.deliveryCompany}</div>
                          </div>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${st.color}`}>{st.label}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* 페이지네이션 */}
        {orderTotalPages > 1 && (
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-gray-400">
              {((orderPage - 1) * orderPageSize) + 1}–{Math.min(orderPage * orderPageSize, filteredOrders.length)} / 총 {filteredOrders.length}건
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setOrderPage(p => Math.max(1, p - 1))} disabled={orderPage === 1}
                className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-30 hover:bg-gray-50">
                ‹ 이전
              </button>
              {orderPageNumbers.map((n, i) =>
                n === '...'
                  ? <span key={`d${i}`} className="px-1 text-gray-400 text-xs">…</span>
                  : <button key={n} onClick={() => setOrderPage(n as number)}
                      className={`w-8 h-7 text-xs rounded-lg transition-colors ${orderPage === n ? 'bg-green-600 text-white font-medium' : 'border border-gray-200 hover:bg-gray-50 text-gray-600'}`}>
                      {n}
                    </button>
              )}
              <button onClick={() => setOrderPage(p => Math.min(orderTotalPages, p + 1))} disabled={orderPage === orderTotalPages}
                className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-30 hover:bg-gray-50">
                다음 ›
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
