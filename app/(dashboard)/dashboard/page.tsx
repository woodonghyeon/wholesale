'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useBusinessStore } from '@/store/businessStore'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

interface KPI {
  monthSales: number
  monthPurchase: number
  monthProfit: number
  lowStockCount: number
}

interface SalesTrend {
  month: string
  amount: number
}

interface RecentSlip {
  id: string
  slip_no: string
  slip_type: 'sale' | 'purchase'
  slip_date: string
  total_amount: number
  partners?: { name: string } | null
  channels?: { name: string } | null
}

function formatKRW(n: number) {
  return new Intl.NumberFormat('ko-KR').format(n)
}

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-black/[0.06] shadow-card p-5">
      <p className="text-xs font-medium text-[#86868b] mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${color ?? 'text-[#1d1d1f]'}`}>{value}</p>
      {sub && <p className="text-xs text-[#86868b] mt-1">{sub}</p>}
    </div>
  )
}

export default function DashboardPage() {
  const supabase = createClient()
  const { selectedBusinessId } = useBusinessStore()
  const [kpi, setKpi] = useState<KPI>({ monthSales: 0, monthPurchase: 0, monthProfit: 0, lowStockCount: 0 })
  const [trend, setTrend] = useState<SalesTrend[]>([])
  const [recentSlips, setRecentSlips] = useState<RecentSlip[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)

      // 이번달 매출/매입
      let salesQ = supabase
        .from('slips')
        .select('slip_type, total_amount')
        .gte('slip_date', monthStart)
        .lte('slip_date', monthEnd)
      if (selectedBusinessId !== 'all') salesQ = salesQ.eq('business_id', selectedBusinessId)
      const { data: slipData } = await salesQ

      let monthSales = 0, monthPurchase = 0
      slipData?.forEach(s => {
        if (s.slip_type === 'sale') monthSales += s.total_amount
        else monthPurchase += s.total_amount
      })

      // 저재고 상품 수
      let invQ = supabase
        .from('inventory')
        .select('quantity, products!inner(min_stock)')
      if (selectedBusinessId !== 'all') invQ = invQ.eq('business_id', selectedBusinessId)
      const { data: invData } = await invQ
      const lowStockCount = invData?.filter((i: any) => i.quantity <= i.products.min_stock).length ?? 0

      // 최근 6개월 매출 추이
      const trendData: SalesTrend[] = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10)
        let q = supabase
          .from('slips')
          .select('total_amount')
          .eq('slip_type', 'sale')
          .gte('slip_date', start)
          .lte('slip_date', end)
        if (selectedBusinessId !== 'all') q = q.eq('business_id', selectedBusinessId)
        const { data } = await q
        const amount = data?.reduce((sum, s) => sum + s.total_amount, 0) ?? 0
        trendData.push({ month: `${d.getMonth() + 1}월`, amount })
      }

      // 최근 거래 10건
      let recentQ = supabase
        .from('slips')
        .select('id, slip_no, slip_type, slip_date, total_amount, partners(name), channels(name)')
        .order('created_at', { ascending: false })
        .limit(10)
      if (selectedBusinessId !== 'all') recentQ = recentQ.eq('business_id', selectedBusinessId)
      const { data: recentData } = await recentQ

      setKpi({ monthSales, monthPurchase, monthProfit: monthSales - monthPurchase, lowStockCount })
      setTrend(trendData)
      setRecentSlips((recentData as any[]) ?? [])
      setLoading(false)
    }
    load()
  }, [selectedBusinessId])

  return (
    <div className="space-y-6">
      {/* 페이지 제목 */}
      <div>
        <h1 className="text-xl font-semibold text-[#1d1d1f]">대시보드</h1>
        <p className="text-sm text-[#86868b] mt-0.5">
          {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
        </p>
      </div>

      {/* 저재고 배너 */}
      {kpi.lowStockCount > 0 && (
        <div className="flex items-center gap-3 bg-[#fff3cd] border border-[#ff9f0a]/30 rounded-xl px-4 py-3">
          <svg className="w-5 h-5 text-[#ff9f0a] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-sm text-[#856404]">
            안전재고 이하 상품이 <strong>{kpi.lowStockCount}개</strong> 있습니다.
          </p>
        </div>
      )}

      {/* KPI 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="이번달 매출"
          value={loading ? '–' : `₩${formatKRW(kpi.monthSales)}`}
          sub="부가세 포함"
          color="text-[#007aff]"
        />
        <KpiCard
          label="이번달 매입"
          value={loading ? '–' : `₩${formatKRW(kpi.monthPurchase)}`}
          sub="부가세 포함"
        />
        <KpiCard
          label="이번달 이익"
          value={loading ? '–' : `₩${formatKRW(kpi.monthProfit)}`}
          sub="매출 - 매입"
          color={kpi.monthProfit >= 0 ? 'text-[#34c759]' : 'text-[#ff3b30]'}
        />
        <KpiCard
          label="저재고 상품"
          value={loading ? '–' : `${kpi.lowStockCount}개`}
          sub="안전재고 이하"
          color={kpi.lowStockCount > 0 ? 'text-[#ff9f0a]' : 'text-[#34c759]'}
        />
      </div>

      {/* 매출 추이 차트 */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-black/[0.06] shadow-card p-5">
        <h2 className="text-sm font-semibold text-[#1d1d1f] mb-4">최근 6개월 매출 추이</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={trend} barSize={28}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#86868b' }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 11, fill: '#86868b' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`}
            />
            <Tooltip
              formatter={(value) => [`₩${formatKRW(Number(value ?? 0))}`, '매출'] as [string, string]}
              contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', fontSize: 12 }}
            />
            <Bar dataKey="amount" fill="#007aff" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 최근 거래 */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-black/[0.06] shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-[#1d1d1f]">최근 거래</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {loading ? (
            <div className="px-5 py-8 text-center text-sm text-[#86868b]">불러오는 중...</div>
          ) : recentSlips.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-[#86868b]">거래 내역이 없습니다.</div>
          ) : (
            recentSlips.map((slip) => (
              <div key={slip.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/50 transition">
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    slip.slip_type === 'sale'
                      ? 'bg-blue-50 text-[#007aff]'
                      : 'bg-gray-100 text-[#86868b]'
                  }`}>
                    {slip.slip_type === 'sale' ? '매출' : '매입'}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-[#1d1d1f]">{slip.slip_no}</p>
                    <p className="text-xs text-[#86868b]">
                      {(slip.partners as { name?: string } | null)?.name ?? '–'}{(slip.channels as { name?: string } | null)?.name ? ` · ${(slip.channels as { name?: string }).name}` : ''}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-[#1d1d1f]">₩{formatKRW(slip.total_amount)}</p>
                  <p className="text-xs text-[#86868b]">{new Date(slip.slip_date).toLocaleDateString('ko-KR')}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
