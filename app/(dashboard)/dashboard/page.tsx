'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { getDashboardStats, DashboardStats } from '@/lib/supabase/dashboard'
import { getBusinesses } from '@/lib/supabase/businesses'
import { Business } from '@/lib/types'
import { formatMoney } from '@/lib/utils/format'

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: 'green' | 'red' | 'orange' | 'blue' }) {
  const colors = {
    green: 'text-green-600',
    red: 'text-red-500',
    orange: 'text-orange-500',
    blue: 'text-blue-600',
  }
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent ? colors[accent] : 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

function MiniBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="flex items-end gap-0.5 h-8">
      <div className="w-full bg-gray-100 rounded-sm" style={{ height: '100%' }}>
        <div className="bg-blue-500 rounded-sm w-full transition-all" style={{ height: `${pct}%` }} />
      </div>
    </div>
  )
}

interface NaverStats {
  summary: {
    total: number; totalRevenue: number
    todayCount: number; todayRevenue: number
    weekCount: number; weekRevenue: number
    canceledCount: number; returnedCount: number
  }
  topProducts: { name: string; revenue: number; qty: number }[]
  daily: { date: string; count: number; revenue: number }[]
  recentOrders: { productOrderId: string; productName: string; ordererName: string; totalPaymentAmount: number; status: string; orderDate: string }[]
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  PURCHASE_DECIDED: { label: '구매확정', color: 'bg-green-100 text-green-700' },
  DELIVERED: { label: '배송완료', color: 'bg-blue-100 text-blue-700' },
  DELIVERING: { label: '배송중', color: 'bg-sky-100 text-sky-700' },
  PAYED: { label: '결제완료', color: 'bg-indigo-100 text-indigo-700' },
  CANCELED: { label: '취소', color: 'bg-red-100 text-red-600' },
  CANCEL_REQUEST: { label: '취소요청', color: 'bg-red-100 text-red-600' },
  RETURNED: { label: '반품', color: 'bg-orange-100 text-orange-600' },
  RETURN_REQUEST: { label: '반품요청', color: 'bg-orange-100 text-orange-600' },
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [bizFilter, setBizFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [naverStats, setNaverStats] = useState<NaverStats | null>(null)
  const [naverLoading, setNaverLoading] = useState(true)

  useEffect(() => {
    getBusinesses().then(setBusinesses).catch(() => {})
    loadNaverStats()
  }, [])

  useEffect(() => { load() }, [bizFilter])

  async function loadNaverStats() {
    setNaverLoading(true)
    try {
      const res = await fetch('/api/naver/stats')
      const data = await res.json()
      if (data.success) setNaverStats(data)
    } catch { /* 네이버 미연동 시 무시 */ }
    finally { setNaverLoading(false) }
  }

  async function load() {
    setLoading(true)
    try {
      setStats(await getDashboardStats(bizFilter !== 'all' ? bizFilter : undefined))
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setLoading(false) }
  }

  const maxTrend = stats ? Math.max(...stats.monthlySalesTrend.map(m => m.amount), 1) : 1
  const maxDaily = naverStats ? Math.max(...naverStats.daily.map(d => d.revenue), 1) : 1

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">대시보드</h1>
        <select value={bizFilter} onChange={e => setBizFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">전체 사업자</option>
          {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="py-24 text-center text-sm text-gray-400">불러오는 중...</div>
      ) : stats ? (
        <div className="space-y-6">
          {/* 이번달 요약 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="이번달 매출" value={`${formatMoney(stats.monthSales)}원`} accent="blue" />
            <StatCard label="이번달 매입" value={`${formatMoney(stats.monthPurchase)}원`} />
            <StatCard
              label="이번달 이익"
              value={`${formatMoney(stats.monthProfit)}원`}
              accent={stats.monthProfit >= 0 ? 'green' : 'red'}
              sub={stats.monthSales > 0 ? `마진율 ${Math.round((stats.monthProfit / stats.monthSales) * 100)}%` : undefined}
            />
            <StatCard label="재고 가치" value={`${formatMoney(stats.totalInventoryValue)}원`} />
          </div>

          {/* 알림 배너 */}
          {stats.lowStockCount > 0 && (
            <Link href="/inventory" className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-xl px-5 py-3 text-sm hover:bg-orange-100 transition-colors">
              <span className="text-xl">⚠️</span>
              <div>
                <span className="font-medium text-orange-800">부족 재고 {stats.lowStockCount}개 품목</span>
                <span className="text-orange-600 ml-2 text-xs">안전재고 이하입니다 → 재고 관리로 이동</span>
              </div>
            </Link>
          )}

          <div className="grid grid-cols-3 gap-6">
            {/* 월별 매출 추이 */}
            <div className="col-span-2 bg-white rounded-2xl border border-gray-100 p-5">
              <p className="text-sm font-semibold text-gray-800 mb-4">최근 6개월 매출</p>
              <div className="flex items-end gap-3 h-32">
                {stats.monthlySalesTrend.map((m, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs text-gray-500 font-medium">{formatMoney(m.amount / 10000)}만</span>
                    <div className="w-full bg-gray-100 rounded-t-sm" style={{ height: '80px', position: 'relative' }}>
                      <div
                        className="absolute bottom-0 left-0 right-0 bg-blue-500 rounded-t-sm transition-all"
                        style={{ height: maxTrend > 0 ? `${(m.amount / maxTrend) * 100}%` : '0%' }}
                      />
                    </div>
                    <span className="text-xs text-gray-400">{m.month}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 빠른 이동 */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="text-sm font-semibold text-gray-800 mb-4">바로가기</p>
              <div className="space-y-2">
                {[
                  { href: '/transactions', label: '매출 입력', icon: '↑', color: 'text-blue-600' },
                  { href: '/transactions', label: '매입 입력', icon: '↓', color: 'text-gray-600' },
                  { href: '/inventory', label: '재고 확인', icon: '⊟', color: 'text-green-600' },
                  { href: '/partners', label: '거래처 관리', icon: '◎', color: 'text-purple-600' },
                  { href: '/products', label: '상품 관리', icon: '⊞', color: 'text-orange-500' },
                  { href: '/settings', label: '설정', icon: '⚙', color: 'text-gray-500' },
                ].map(item => (
                  <Link key={item.label} href={item.href}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-50 text-sm transition-colors">
                    <span className={`w-5 text-center ${item.color}`}>{item.icon}</span>
                    <span className="text-gray-700">{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* 네이버 스마트스토어 실시간 현황 */}
          {naverLoading ? (
            <div className="bg-white rounded-2xl border border-green-100 p-5">
              <p className="text-sm text-gray-400">네이버 스마트스토어 데이터 불러오는 중...</p>
            </div>
          ) : naverStats && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-green-500 rounded-md flex items-center justify-center text-white text-xs font-bold">N</div>
                <p className="text-sm font-semibold text-gray-800">네이버 스마트스토어 실시간 현황</p>
                <span className="text-xs text-gray-400">(최근 30일)</span>
                <button onClick={loadNaverStats} className="ml-auto text-xs text-gray-400 hover:text-gray-600">↺ 새로고침</button>
              </div>

              {/* 요약 카드 4개 */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                  <p className="text-xs text-green-600 mb-1">오늘 주문</p>
                  <p className="text-2xl font-bold text-green-700">{naverStats.summary.todayCount}<span className="text-sm font-normal ml-1">건</span></p>
                  <p className="text-xs text-green-500 mt-1">{naverStats.summary.todayRevenue.toLocaleString()}원</p>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                  <p className="text-xs text-blue-600 mb-1">최근 7일 주문</p>
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
                {/* 14일 일별 막대 그래프 */}
                <div className="col-span-2 bg-white border border-gray-100 rounded-xl p-4">
                  <p className="text-xs font-medium text-gray-600 mb-3">최근 14일 일별 매출</p>
                  <div className="flex items-end gap-1" style={{ height: 80 }}>
                    {naverStats.daily.map(d => {
                      const pct = (d.revenue / maxDaily) * 100
                      const isToday = d.date === new Date().toISOString().slice(0, 10)
                      return (
                        <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5" title={`${d.date}: ${d.revenue.toLocaleString()}원 (${d.count}건)`}>
                          <div className="w-full flex flex-col justify-end" style={{ height: 68 }}>
                            <div
                              className={`w-full rounded-sm transition-all ${isToday ? 'bg-green-500' : 'bg-green-200'}`}
                              style={{ height: `${Math.max(pct, d.revenue > 0 ? 4 : 0)}%` }}
                            />
                          </div>
                          <span className="text-gray-300 text-center" style={{ fontSize: 8 }}>
                            {d.date.slice(8)}
                          </span>
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
                          <div
                            className="h-1 bg-green-400 rounded-full"
                            style={{ width: `${(p.revenue / naverStats.topProducts[0].revenue) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 최근 주문 5건 */}
              <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                  <p className="text-xs font-medium text-gray-600">최근 주문</p>
                  <Link href="/channel-sales" className="text-xs text-green-600 hover:underline">채널별 매출 →</Link>
                </div>
                <table className="w-full text-xs">
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
                            <span className={`px-1.5 py-0.5 rounded-full text-xs ${st.color}`}>{st.label}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 최근 거래 */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-gray-800">최근 거래</p>
              <Link href="/transactions" className="text-xs text-blue-600 hover:underline">전체 보기</Link>
            </div>
            {stats.recentSlips.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">거래 내역이 없습니다</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-400 border-b border-gray-50">
                  <tr>
                    {['날짜','구분','거래처','금액'].map(h => <th key={h} className="pb-2 text-left font-medium">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {stats.recentSlips.map(sl => (
                    <tr key={sl.id} className="hover:bg-gray-50">
                      <td className="py-2.5 text-xs text-gray-500 font-mono">{sl.slip_date}</td>
                      <td className="py-2.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${sl.slip_type === 'sale' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                          {sl.slip_type === 'sale' ? '매출' : '매입'}
                        </span>
                      </td>
                      <td className="py-2.5">{sl.partner_name ?? '-'}</td>
                      <td className={`py-2.5 font-medium ${sl.slip_type === 'sale' ? 'text-blue-600' : 'text-gray-700'}`}>
                        {sl.slip_type === 'sale' ? '+' : '-'}{formatMoney(sl.total_amount)}원
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
