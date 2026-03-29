'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/ui/PageHeader'
import { getBusinesses } from '@/lib/supabase/businesses'
import { getSalesByChannel, getChannelMonthlySales, ChannelSaleRow } from '@/lib/supabase/channel-sales'
import { Business } from '@/lib/types'
import { formatMoney } from '@/lib/utils/format'
import ProductDetailModal from '@/components/ui/ProductDetailModal'

const COLORS = ['bg-blue-500', 'bg-violet-500', 'bg-green-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500']
const TEXT_COLORS = ['text-blue-600', 'text-violet-600', 'text-green-600', 'text-orange-600', 'text-pink-600', 'text-teal-600']
const BAR_COLORS = ['bg-blue-400', 'bg-violet-400', 'bg-green-400', 'bg-orange-400', 'bg-pink-400', 'bg-teal-400']

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

// ── 택배사 코드 → 이름 + 추적 URL ────────────────────────────────
const CARRIER_INFO: Record<string, { name: string; url: (n: string) => string }> = {
  CJLGST:       { name: 'CJ대한통운', url: n => `https://trace.cjlogistics.com/next/tracking.html?wblNo=${n}` },
  CJGLS:        { name: 'CJ대한통운', url: n => `https://trace.cjlogistics.com/next/tracking.html?wblNo=${n}` },
  CJ:           { name: 'CJ대한통운', url: n => `https://trace.cjlogistics.com/next/tracking.html?wblNo=${n}` },
  HANJIN:       { name: '한진택배',   url: n => `https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillResult.do?mCode=MN038&schLang=KOR&wblnumText2=${n}` },
  LTCGIS:       { name: '롯데택배',   url: n => `https://www.lotteglogis.com/home/reservation/tracking/index?InvNo=${n}` },
  LOTTE:        { name: '롯데택배',   url: n => `https://www.lotteglogis.com/home/reservation/tracking/index?InvNo=${n}` },
  EPOST:        { name: '우체국',     url: n => `https://service.epost.go.kr/trace.RetrieveEmsRigiTraceList.retrieve?POST_CODE=${n}` },
  LOGEN:        { name: '로젠택배',   url: n => `http://www.ilogen.com/m/personal/trace/${n}` },
  HDEXP:        { name: '현대택배',   url: n => `https://hyundaitransco.com/delivery/tracking?trackingNo=${n}` },
  HYUNDAI:      { name: '롯데택배',   url: n => `https://www.lotteglogis.com/home/reservation/tracking/index?InvNo=${n}` },
  HYUNDAILOGIS: { name: '현대택배',   url: n => `https://hyundaitransco.com/delivery/tracking?trackingNo=${n}` },
  KDEXP:        { name: '경동택배',   url: n => `https://kdexp.com/newDeliverySearch.ekd?barcode=${n}` },
  CHUNIL:       { name: '천일택배',   url: n => `https://www.chunil.co.kr/HTrace/HTrace.jsp?transNo=${n}` },
  DONGBU:       { name: '한덱스',     url: n => `https://www.handex.co.kr/tracking?invoiceno=${n}` },
  GSMNTON:      { name: 'GS네트웍스', url: n => `https://www.gsmnton.com/tracking?no=${n}` },
}

function getTrackingUrl(company: string, trackingNo: string): string {
  const info = CARRIER_INFO[company?.toUpperCase?.() ?? '']
  if (info) return info.url(trackingNo)
  // 범용 폴백: 네이버 검색
  return `https://search.naver.com/search.naver?query=${encodeURIComponent(trackingNo)}`
}

function getCarrierName(company: string): string {
  return CARRIER_INFO[company?.toUpperCase?.() ?? '']?.name ?? company
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
  saleCommission: number
  paymentCommission: number
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

interface NaverAnalytics {
  days: number
  totalOrders: number
  activeOrders: number
  settlement: {
    totalRevenue: number
    totalSettlement: number
    totalPayComm: number
    totalSaleComm: number
    totalCommission: number
    totalDiscount: number
    settlementRate: number
    commissionRate: number
  }
  topOptions: { option: string; count: number; revenue: number; orders: number }[]
  inflowStats: { path: string; count: number; revenue: number; avgAmount: number; share: number }[]
  paymentStats: { means: string; count: number; revenue: number; share: number }[]
  membershipCount: number
  membershipRate: number
}

interface CustomerData {
  summary: {
    totalCustomers: number
    repeatCount: number
    repeatRate: number
    vipCount: number
    totalRevenue: number
    repeatRevenue: number
    repeatRevenueRate: number
  }
  customers: {
    tel: string
    name: string
    orderCount: number
    totalAmount: number
    avgAmount: number
    lastOrderDate: string
    grade: string
    topProducts: string[]
  }[]
}

interface RegionData {
  totalCount: number
  totalRevenue: number
  regions: {
    region: string
    count: number
    revenue: number
    avgAmount: number
    countShare: number
    revenueShare: number
  }[]
}

const PAGE_SIZE_OPTIONS = [20, 50, 100]
type AnalyticsTab = 'settlement' | 'options' | 'inflow' | 'payment' | 'customers' | 'regions'

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

  // 분석 탭
  const [analytics, setAnalytics] = useState<NaverAnalytics | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsTab, setAnalyticsTab] = useState<AnalyticsTab>('settlement')
  const [analyticsDays, setAnalyticsDays] = useState(30)
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [productDetailName, setProductDetailName] = useState<string | null>(null)
  const [customerData, setCustomerData] = useState<CustomerData | null>(null)
  const [customerLoading, setCustomerLoading] = useState(false)
  const [regionData, setRegionData] = useState<RegionData | null>(null)
  const [regionLoading, setRegionLoading] = useState(false)

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
      const bizParam = bizFilter !== 'all' ? `?business_id=${bizFilter}` : ''
      const res = await fetch(`/api/naver/stats${bizParam}`)
      const data = await res.json()
      if (data.success) setNaverStats(data)
    } catch { /* 네이버 미연동 시 무시 */ }
    finally { setNaverLoading(false) }
  }, [bizFilter])

  const [ordersSource, setOrdersSource] = useState<string>('')

  const loadOrders = useCallback(async (forceRefresh = false) => {
    setOrdersLoading(true)
    try {
      const bizParam = bizFilter !== 'all' ? `&business_id=${bizFilter}` : ''
      const url = `/api/naver/orders?days=${orderDays}${forceRefresh ? '&refresh=1' : ''}${bizParam}`
      const res = await fetch(url)
      const data = await res.json()
      if (data.success) {
        setAllOrders(data.orders ?? [])
        setOrdersSource(data.source === 'cache' ? `캐시 (${new Date(data.cachedAt).toLocaleTimeString('ko', { hour: '2-digit', minute: '2-digit' })} 기준)` : 'API 실시간')
      }
    } catch { /* 무시 */ }
    finally { setOrdersLoading(false) }
  }, [orderDays, bizFilter])

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true)
    try {
      const bizParam = bizFilter !== 'all' ? `&business_id=${bizFilter}` : ''
      const res = await fetch(`/api/naver/analytics?days=${analyticsDays}${bizParam}`)
      const data = await res.json()
      if (data.success) setAnalytics(data)
    } catch { /* 무시 */ }
    finally { setAnalyticsLoading(false) }
  }, [analyticsDays, bizFilter])

  const loadCustomers = useCallback(async () => {
    setCustomerLoading(true)
    try {
      const res = await fetch(`/api/analytics/customers?days=${analyticsDays}`)
      const data = await res.json()
      if (data.success) setCustomerData(data)
    } catch { /* 무시 */ }
    finally { setCustomerLoading(false) }
  }, [analyticsDays])

  const loadRegions = useCallback(async () => {
    setRegionLoading(true)
    try {
      const res = await fetch(`/api/analytics/regions?days=${analyticsDays}`)
      const data = await res.json()
      if (data.success) setRegionData(data)
    } catch { /* 무시 */ }
    finally { setRegionLoading(false) }
  }, [analyticsDays])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadNaver() }, [loadNaver])
  useEffect(() => { loadOrders(false) }, [loadOrders])
  useEffect(() => { setOrderPage(1) }, [orderSearch, orderStatusFilter, orderDays, orderPageSize])

  // 분석 탭 열릴 때 최초 1회 로드
  useEffect(() => {
    if (showAnalytics && !analytics) loadAnalytics()
  }, [showAnalytics, analytics, loadAnalytics])
  useEffect(() => {
    if (!showAnalytics) return
    loadAnalytics()
    if (analyticsTab === 'customers') loadCustomers()
    if (analyticsTab === 'regions') loadRegions()
  }, [analyticsDays]) // eslint-disable-line

  useEffect(() => {
    if (!showAnalytics) return
    if (analyticsTab === 'customers' && !customerData) loadCustomers()
    if (analyticsTab === 'regions' && !regionData) loadRegions()
  }, [analyticsTab, showAnalytics]) // eslint-disable-line

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
    const totalRevenue    = active.reduce((s, o) => s + o.totalPaymentAmount, 0)
    const totalSaleComm   = active.reduce((s, o) => s + (o.saleCommission ?? 0), 0)
    const totalPayComm    = active.reduce((s, o) => s + (o.paymentCommission ?? 0), 0)
    const totalCommission = totalSaleComm + totalPayComm
    return {
      totalRevenue,
      totalSettlement: active.reduce((s, o) => s + (o.expectedSettlementAmount ?? 0), 0),
      totalSaleComm,
      totalPayComm,
      totalCommission,
      commissionRate: totalRevenue > 0 ? Math.round(totalCommission / totalRevenue * 100 * 10) / 10 : 0,
      withTracking:   filteredOrders.filter(o => !!o.trackingNumber).length,
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
          <div className="ml-auto flex items-center gap-2">
            {ordersLoading
              ? <span className="text-xs text-blue-500 flex items-center gap-1"><span className="inline-block w-3 h-3 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />자동 동기화 중...</span>
              : ordersSource && <span className="text-xs text-gray-400">{ordersSource}</span>
            }
            <button onClick={() => loadOrders(true)} disabled={ordersLoading} className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded px-2 py-0.5 disabled:opacity-40">↺ 강제 새로고침</button>
          </div>
        </div>

        {/* 툴바 */}
        <div className="flex flex-wrap gap-2 mb-3 items-center">
          <input
            placeholder="상품명·주문자·주문번호·운송장 검색"
            value={orderSearch} onChange={e => setOrderSearch(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 w-64"
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
          <div className="grid grid-cols-5 gap-3 mb-3">
            <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3">
              <p className="text-xs text-green-600 mb-0.5">결제금액 합계</p>
              <p className="text-lg font-bold text-green-700">{orderSummary.totalRevenue.toLocaleString()}원</p>
            </div>
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              <p className="text-xs text-red-500 mb-0.5">총 수수료 <span className="text-gray-400">({orderSummary.commissionRate}%)</span></p>
              <p className="text-lg font-bold text-red-600">{orderSummary.totalCommission.toLocaleString()}원</p>
              <div className="text-xs text-gray-400 mt-0.5 space-y-0.5">
                <div>판매수수료 {orderSummary.totalSaleComm.toLocaleString()}</div>
                <div>결제수수료 {orderSummary.totalPayComm.toLocaleString()}</div>
              </div>
            </div>
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
              <p className="text-xs text-indigo-600 mb-0.5">정산 예정금</p>
              <p className="text-lg font-bold text-indigo-700">
                {orderSummary.totalSettlement > 0 ? `${orderSummary.totalSettlement.toLocaleString()}원` : '—'}
              </p>
            </div>
            <div className="bg-orange-50 border border-orange-100 rounded-xl px-4 py-3">
              <p className="text-xs text-orange-500 mb-0.5">수수료 차감 후</p>
              <p className="text-lg font-bold text-orange-700">
                {(orderSummary.totalRevenue - orderSummary.totalCommission).toLocaleString()}원
              </p>
              {orderSummary.totalRevenue > 0 && (
                <p className="text-xs text-gray-400 mt-0.5">실수령 {Math.round((1 - orderSummary.totalCommission / orderSummary.totalRevenue) * 100)}%</p>
              )}
            </div>
            <div className="bg-sky-50 border border-sky-100 rounded-xl px-4 py-3">
              <p className="text-xs text-sky-600 mb-0.5">배송 추적 가능</p>
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
            <table className="w-full text-sm min-w-[1200px]">
              <thead className="bg-gray-50 text-gray-500 text-xs">
                <tr>
                  {['주문일', '주문번호', '상품명/옵션', '수량', '결제금액', '수수료', '정산예정', '유입경로', '주문자', '수신자', '배송추적', '상태'].map(h => (
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
                  const trackUrl = hasTracking ? getTrackingUrl(o.deliveryCompany, o.trackingNumber) : ''
                  const carrierName = hasTracking ? getCarrierName(o.deliveryCompany) : ''
                  const saleComm = o.saleCommission ?? 0
                  const payComm = o.paymentCommission ?? 0
                  const totalComm = saleComm + payComm
                  const isNaverShopping = o.inflowPath === 'NAVER_SHOPPING'
                  const commRate = o.totalPaymentAmount > 0 ? Math.round(totalComm / o.totalPaymentAmount * 100 * 10) / 10 : 0
                  return (
                    <tr key={o.productOrderId} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5 text-xs text-gray-500 font-mono whitespace-nowrap">{date.slice(0, 10)}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-400 font-mono whitespace-nowrap">{o.productOrderId}</td>
                      <td className="px-3 py-2.5 max-w-[200px]">
                        <button
                          onClick={() => setProductDetailName(o.productName)}
                          className="text-left hover:text-blue-600 transition-colors"
                          title="상품 상세 보기"
                        >
                          <div className="font-medium text-gray-800 text-xs line-clamp-1 hover:underline">{o.productName}</div>
                          {o.productOption && (
                            <div className="text-gray-400 text-xs truncate mt-0.5">{o.productOption}</div>
                          )}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-center text-gray-600 text-xs">{o.quantity}</td>
                      <td className="px-3 py-2.5 font-semibold text-green-600 text-xs whitespace-nowrap">
                        {o.totalPaymentAmount.toLocaleString()}원
                        {(o.discountAmount ?? 0) > 0 && (
                          <div className="text-red-400 font-normal">-{o.discountAmount.toLocaleString()}</div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                        {totalComm > 0 ? (
                          <div>
                            <span className="text-red-500 font-medium">-{totalComm.toLocaleString()}원</span>
                            <span className="text-gray-400 ml-1">({commRate}%)</span>
                            <div className="text-gray-400 mt-0.5 space-y-0.5">
                              {saleComm > 0 && <div>판매 {saleComm.toLocaleString()}</div>}
                              {payComm > 0 && <div>결제 {payComm.toLocaleString()}</div>}
                            </div>
                          </div>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                        {settlement > 0
                          ? <span className="text-indigo-600 font-medium">{settlement.toLocaleString()}원</span>
                          : <span className="text-gray-300">—</span>
                        }
                      </td>
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                        {isNaverShopping
                          ? <span className="px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">쇼핑유입</span>
                          : o.inflowPath
                            ? <span className="px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">직접유입</span>
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
                            <a
                              href={trackUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-xs text-blue-600 hover:text-blue-800 hover:underline"
                              title={`${carrierName} 배송 조회`}
                            >
                              {o.trackingNumber}
                            </a>
                            <div className="text-gray-400 text-xs mt-0.5">{carrierName || o.deliveryCompany}</div>
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

      {/* ── 네이버 판매 분석 (정산·옵션·유입·결제수단) ───────── */}
      <div className="border-t border-gray-100 pt-6 mt-4">
        <button
          onClick={() => setShowAnalytics(v => !v)}
          className="flex items-center gap-2 w-full text-left group"
        >
          <div className="w-6 h-6 bg-green-500 rounded-md flex items-center justify-center text-white text-xs font-bold">N</div>
          <p className="text-sm font-semibold text-gray-800">네이버 판매 분석</p>
          <span className="text-xs text-gray-400">(정산·옵션·유입경로·결제수단)</span>
          <span className="ml-auto text-gray-400 text-sm">{showAnalytics ? '▲' : '▼'}</span>
        </button>

        {showAnalytics && (
          <div className="mt-4">
            {/* 분석 기간 + 탭 */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex border border-gray-200 rounded-lg overflow-hidden text-xs">
                {(['settlement', 'options', 'inflow', 'payment', 'customers', 'regions'] as AnalyticsTab[]).map(tab => {
                  const labels: Record<AnalyticsTab, string> = {
                    settlement: '정산 분석',
                    options:    '옵션 분석',
                    inflow:     '유입 경로',
                    payment:    '결제 수단',
                    customers:  '고객 분석',
                    regions:    '지역 분포',
                  }
                  return (
                    <button key={tab} onClick={() => setAnalyticsTab(tab)}
                      className={`px-4 py-2 font-medium transition-colors ${analyticsTab === tab ? 'bg-green-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                      {labels[tab]}
                    </button>
                  )
                })}
              </div>
              <select value={analyticsDays} onChange={e => setAnalyticsDays(Number(e.target.value))}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-green-500">
                <option value={7}>최근 7일</option>
                <option value={30}>최근 30일</option>
                <option value={60}>최근 60일</option>
                <option value={90}>최근 90일</option>
              </select>
              <button onClick={loadAnalytics} className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded px-2 py-1.5">
                ↺ 새로고침
              </button>
            </div>

            {analyticsLoading ? (
              <div className="py-12 text-center text-sm text-gray-400 bg-white rounded-xl border border-gray-100">분석 데이터 불러오는 중...</div>
            ) : !analytics ? (
              <div className="py-12 text-center text-sm text-gray-400 bg-gray-50 rounded-xl">데이터를 불러올 수 없습니다</div>
            ) : (
              <div>
                {/* ── 정산 분석 탭 ── */}
                {analyticsTab === 'settlement' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-4 gap-3">
                      <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                        <p className="text-xs text-green-600 mb-1">총 결제금액</p>
                        <p className="text-xl font-bold text-green-700">{Math.round(analytics.settlement.totalRevenue / 10000).toLocaleString()}<span className="text-sm font-normal ml-1">만원</span></p>
                        <p className="text-xs text-green-500 mt-1">{analytics.activeOrders}건</p>
                      </div>
                      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                        <p className="text-xs text-indigo-600 mb-1">정산 예정금</p>
                        <p className="text-xl font-bold text-indigo-700">{Math.round(analytics.settlement.totalSettlement / 10000).toLocaleString()}<span className="text-sm font-normal ml-1">만원</span></p>
                        <p className="text-xs text-indigo-500 mt-1">정산률 {analytics.settlement.settlementRate}%</p>
                      </div>
                      <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                        <p className="text-xs text-red-500 mb-1">총 수수료</p>
                        <p className="text-xl font-bold text-red-600">{Math.round(analytics.settlement.totalCommission / 10000).toLocaleString()}<span className="text-sm font-normal ml-1">만원</span></p>
                        <p className="text-xs text-red-400 mt-1">수수료율 {analytics.settlement.commissionRate}%</p>
                      </div>
                      <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
                        <p className="text-xs text-orange-500 mb-1">총 할인금액</p>
                        <p className="text-xl font-bold text-orange-600">{Math.round(analytics.settlement.totalDiscount / 10000).toLocaleString()}<span className="text-sm font-normal ml-1">만원</span></p>
                        <p className="text-xs text-orange-400 mt-1">쿠폰·포인트 포함</p>
                      </div>
                    </div>

                    {/* 정산 구조 바 */}
                    <div className="bg-white border border-gray-100 rounded-xl p-5">
                      <p className="text-xs font-medium text-gray-600 mb-4">정산 구조 분석</p>
                      <div className="space-y-3">
                        {[
                          { label: '정산 예정금', amount: analytics.settlement.totalSettlement, color: 'bg-indigo-400', pct: analytics.settlement.settlementRate },
                          { label: '결제 수수료', amount: analytics.settlement.totalPayComm, color: 'bg-red-300', pct: analytics.settlement.totalRevenue > 0 ? Math.round(analytics.settlement.totalPayComm / analytics.settlement.totalRevenue * 100) : 0 },
                          { label: '판매 수수료', amount: analytics.settlement.totalSaleComm, color: 'bg-orange-300', pct: analytics.settlement.totalRevenue > 0 ? Math.round(analytics.settlement.totalSaleComm / analytics.settlement.totalRevenue * 100) : 0 },
                        ].map(item => (
                          <div key={item.label}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-gray-600">{item.label}</span>
                              <span className="font-medium">{item.amount.toLocaleString()}원 <span className="text-gray-400">({item.pct}%)</span></span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className={`h-2 ${item.color} rounded-full`} style={{ width: `${item.pct}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── 옵션 분석 탭 ── */}
                {analyticsTab === 'options' && (
                  <div className="bg-white border border-gray-100 rounded-xl p-5">
                    <p className="text-xs font-medium text-gray-600 mb-4">인기 상품 옵션 TOP {analytics.topOptions.length}</p>
                    {analytics.topOptions.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-8">옵션 데이터가 없습니다</p>
                    ) : (
                      <div className="space-y-2.5">
                        {analytics.topOptions.map((opt, i) => {
                          const maxCount = analytics.topOptions[0].count
                          const pct = maxCount > 0 ? (opt.count / maxCount) * 100 : 0
                          return (
                            <div key={opt.option}>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-gray-700 truncate max-w-[300px]" title={opt.option}>
                                  <span className="text-gray-400 mr-1.5 font-mono">{String(i + 1).padStart(2, '0')}</span>
                                  {opt.option}
                                </span>
                                <div className="flex gap-3 text-gray-500 shrink-0 ml-2">
                                  <span>{opt.count}개</span>
                                  <span className="text-green-600 font-medium">{opt.revenue.toLocaleString()}원</span>
                                </div>
                              </div>
                              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className={`h-1.5 ${BAR_COLORS[i % BAR_COLORS.length]} rounded-full`} style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ── 유입 경로 탭 ── */}
                {analyticsTab === 'inflow' && (
                  <div className="bg-white border border-gray-100 rounded-xl p-5">
                    <p className="text-xs font-medium text-gray-600 mb-4">유입 경로별 주문 현황</p>
                    {analytics.inflowStats.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-8">유입 경로 데이터가 없습니다</p>
                    ) : (
                      <div className="space-y-2.5">
                        {analytics.inflowStats.map((item, i) => (
                          <div key={item.path}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-gray-700 truncate max-w-[220px]">{item.path || '알수없음'}</span>
                              <div className="flex gap-3 text-gray-500 shrink-0 ml-2">
                                <span>{item.count}건 ({item.share}%)</span>
                                <span className="text-gray-400">평균 {item.avgAmount.toLocaleString()}원</span>
                              </div>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className={`h-1.5 ${BAR_COLORS[i % BAR_COLORS.length]} rounded-full`} style={{ width: `${item.share}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── 결제 수단 탭 ── */}
                {analyticsTab === 'payment' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white border border-gray-100 rounded-xl p-5">
                        <p className="text-xs font-medium text-gray-600 mb-4">결제 수단별 주문 비중</p>
                        {analytics.paymentStats.length === 0 ? (
                          <p className="text-sm text-gray-400 text-center py-6">데이터 없음</p>
                        ) : (
                          <div className="space-y-2.5">
                            {analytics.paymentStats.map((item, i) => (
                              <div key={item.means}>
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="text-gray-700">{item.means}</span>
                                  <span className="text-gray-500">{item.count}건 ({item.share}%)</span>
                                </div>
                                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div className={`h-1.5 ${BAR_COLORS[i % BAR_COLORS.length]} rounded-full`} style={{ width: `${item.share}%` }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="bg-white border border-gray-100 rounded-xl p-5">
                        <p className="text-xs font-medium text-gray-600 mb-4">네이버플러스 멤버십</p>
                        <div className="flex flex-col items-center justify-center h-32 gap-2">
                          <p className="text-4xl font-bold text-green-600">{analytics.membershipRate}%</p>
                          <p className="text-xs text-gray-400">{analytics.membershipCount}명 / {analytics.activeOrders}명</p>
                          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mt-2">
                            <div className="h-2 bg-green-400 rounded-full" style={{ width: `${analytics.membershipRate}%` }} />
                          </div>
                          <p className="text-xs text-gray-400">멤버십 회원 구매 비율</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── 고객 분석 탭 ── */}
                {analyticsTab === 'customers' && (
                  customerLoading ? (
                    <div className="py-12 text-center text-sm text-gray-400 bg-white rounded-xl border border-gray-100">고객 데이터 분석 중...</div>
                  ) : !customerData ? (
                    <div className="py-12 text-center text-sm text-gray-400 bg-gray-50 rounded-xl">데이터를 불러올 수 없습니다</div>
                  ) : (
                    <div className="space-y-4">
                      {/* 요약 카드 */}
                      <div className="grid grid-cols-4 gap-3">
                        <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
                          <p className="text-xs text-purple-600 mb-1">전체 고객</p>
                          <p className="text-2xl font-bold text-purple-700">{customerData.summary.totalCustomers}<span className="text-sm font-normal ml-1">명</span></p>
                        </div>
                        <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                          <p className="text-xs text-green-600 mb-1">재구매 고객</p>
                          <p className="text-2xl font-bold text-green-700">{customerData.summary.repeatCount}<span className="text-sm font-normal ml-1">명</span></p>
                          <p className="text-xs text-green-500 mt-1">재구매율 {customerData.summary.repeatRate}%</p>
                        </div>
                        <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4">
                          <p className="text-xs text-yellow-600 mb-1">VIP (5회+)</p>
                          <p className="text-2xl font-bold text-yellow-700">{customerData.summary.vipCount}<span className="text-sm font-normal ml-1">명</span></p>
                        </div>
                        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                          <p className="text-xs text-indigo-600 mb-1">재구매 매출 비중</p>
                          <p className="text-2xl font-bold text-indigo-700">{customerData.summary.repeatRevenueRate}<span className="text-sm font-normal ml-1">%</span></p>
                          <p className="text-xs text-indigo-500 mt-1">{customerData.summary.repeatRevenue.toLocaleString()}원</p>
                        </div>
                      </div>
                      {/* 고객 테이블 */}
                      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-50">
                          <p className="text-xs font-medium text-gray-600">고객 목록 (구매금액 순)</p>
                        </div>
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50 text-gray-500">
                            <tr>{['등급','이름','주문수','총 구매금액','평균 주문금액','최근 구매','선호 상품'].map(h => <th key={h} className="px-3 py-2.5 text-left font-medium">{h}</th>)}</tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {customerData.customers.slice(0, 30).map(c => (
                              <tr key={c.tel} className="hover:bg-gray-50">
                                <td className="px-3 py-2.5">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                    c.grade === 'VIP' ? 'bg-yellow-100 text-yellow-700' :
                                    c.grade === '단골' ? 'bg-green-100 text-green-700' :
                                    'bg-gray-100 text-gray-500'
                                  }`}>{c.grade}</span>
                                </td>
                                <td className="px-3 py-2.5 font-medium text-gray-700">{c.name}</td>
                                <td className="px-3 py-2.5 text-center text-gray-600">{c.orderCount}회</td>
                                <td className="px-3 py-2.5 font-semibold text-green-600">{c.totalAmount.toLocaleString()}원</td>
                                <td className="px-3 py-2.5 text-gray-500">{c.avgAmount.toLocaleString()}원</td>
                                <td className="px-3 py-2.5 text-gray-400 font-mono">{c.lastOrderDate}</td>
                                <td className="px-3 py-2.5 text-gray-400 max-w-[180px] truncate" title={c.topProducts.join(', ')}>{c.topProducts[0] ?? '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {customerData.customers.length > 30 && (
                          <p className="text-xs text-gray-400 text-center py-2">상위 30명 표시 중 (전체 {customerData.customers.length}명)</p>
                        )}
                      </div>
                    </div>
                  )
                )}

                {/* ── 지역 분포 탭 ── */}
                {analyticsTab === 'regions' && (
                  regionLoading ? (
                    <div className="py-12 text-center text-sm text-gray-400 bg-white rounded-xl border border-gray-100">지역 데이터 분석 중...</div>
                  ) : !regionData ? (
                    <div className="py-12 text-center text-sm text-gray-400 bg-gray-50 rounded-xl">데이터를 불러올 수 없습니다</div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        {/* 지역별 바 차트 */}
                        <div className="bg-white border border-gray-100 rounded-xl p-5">
                          <p className="text-xs font-medium text-gray-600 mb-4">시/도별 주문 건수</p>
                          <div className="space-y-2.5">
                            {regionData.regions.map((r, i) => (
                              <div key={r.region}>
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="text-gray-700 font-medium w-12">{r.region}</span>
                                  <span className="text-gray-500">{r.count}건 ({r.countShare}%)</span>
                                </div>
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div className={`h-2 ${BAR_COLORS[i % BAR_COLORS.length]} rounded-full`} style={{ width: `${r.countShare}%` }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        {/* 지역별 매출 테이블 */}
                        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                          <div className="px-4 py-3 border-b border-gray-50">
                            <p className="text-xs font-medium text-gray-600">지역별 매출 상세</p>
                          </div>
                          <table className="w-full text-xs">
                            <thead className="bg-gray-50 text-gray-500">
                              <tr>{['지역','건수','매출','평균금액'].map(h => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}</tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {regionData.regions.map(r => (
                                <tr key={r.region} className="hover:bg-gray-50">
                                  <td className="px-3 py-2 font-medium text-gray-700">{r.region}</td>
                                  <td className="px-3 py-2 text-gray-500">{r.count}건</td>
                                  <td className="px-3 py-2 font-semibold text-green-600">{r.revenue.toLocaleString()}원</td>
                                  <td className="px-3 py-2 text-gray-400">{r.avgAmount.toLocaleString()}원</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <ProductDetailModal
        open={!!productDetailName}
        productName={productDetailName}
        onClose={() => setProductDetailName(null)}
      />
    </div>
  )
}
