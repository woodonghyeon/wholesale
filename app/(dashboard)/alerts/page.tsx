'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import Link from 'next/link'
import PageHeader from '@/components/ui/PageHeader'
import { createClient } from '@/lib/supabase/client'
import { getBusinesses } from '@/lib/supabase/businesses'
import { Business } from '@/lib/types'
import { formatMoney } from '@/lib/utils/format'

interface AlertItem {
  type: 'low_stock' | 'due_customer' | 'overdue_order' | 'pending_return'
  severity: 'high' | 'medium' | 'low'
  title: string
  description: string
  href: string
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [bizFilter, setBizFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => { getBusinesses().then(setBusinesses) }, [])
  useEffect(() => { load() }, [bizFilter])

  async function load() {
    setLoading(true)
    const supabase = createClient()
    const biz = bizFilter !== 'all' ? bizFilter : null
    const result: AlertItem[] = []

    try {
      // 1. 부족 재고
      let invQ = supabase.from('inventory').select('quantity, products(name, min_stock)')
      if (biz) invQ = invQ.eq('business_id', biz)
      const { data: invData } = await invQ
      const lowStock = (invData ?? []).filter((r: any) => r.products?.min_stock > 0 && r.quantity <= r.products.min_stock)
      if (lowStock.length > 0) {
        result.push({
          type: 'low_stock', severity: 'high',
          title: `부족 재고 ${lowStock.length}개 품목`,
          description: lowStock.slice(0, 3).map((r: any) => `${r.products?.name} (현재 ${r.quantity}개)`).join(', ') + (lowStock.length > 3 ? ` 외 ${lowStock.length - 3}개` : ''),
          href: '/inventory',
        })
      }

      // 2. 정기 고객 주문 임박 (7일 이내)
      let custQ = supabase.from('regular_customers').select('order_cycle_days, last_order_date, partners(name)')
      if (biz) custQ = custQ.eq('business_id', biz)
      const { data: custData } = await custQ
      const today = new Date()
      const dueCustomers = (custData ?? []).filter((r: any) => {
        if (!r.last_order_date) return false
        const last = new Date(r.last_order_date)
        const next = new Date(last.getTime() + r.order_cycle_days * 86400000)
        const days = Math.ceil((next.getTime() - today.getTime()) / 86400000)
        return days <= 7
      })
      if (dueCustomers.length > 0) {
        result.push({
          type: 'due_customer', severity: 'medium',
          title: `정기 고객 주문 임박 ${dueCustomers.length}명`,
          description: dueCustomers.slice(0, 3).map((r: any) => r.partners?.name ?? '(미지정)').join(', '),
          href: '/customers',
        })
      }

      // 3. 미처리 반품
      let retQ = supabase.from('returns').select('id, status, products(name)').neq('status', 'done')
      if (biz) retQ = retQ.eq('business_id', biz)
      const { data: retData } = await retQ
      if (retData && retData.length > 0) {
        result.push({
          type: 'pending_return', severity: 'medium',
          title: `처리 대기 반품 ${retData.length}건`,
          description: retData.slice(0, 3).map((r: any) => r.products?.name ?? '(미지정)').join(', '),
          href: '/returns',
        })
      }

      // 4. 대기 발주서
      let ordQ = supabase.from('purchase_orders').select('id, expected_date, partners(name)').eq('status', 'pending')
      if (biz) ordQ = ordQ.eq('business_id', biz)
      const { data: ordData } = await ordQ
      const overdueOrders = (ordData ?? []).filter((r: any) => r.expected_date && new Date(r.expected_date) < today)
      if (overdueOrders.length > 0) {
        result.push({
          type: 'overdue_order', severity: 'high',
          title: `입고 지연 발주서 ${overdueOrders.length}건`,
          description: overdueOrders.slice(0, 3).map((r: any) => r.partners?.name ?? '(미지정)').join(', '),
          href: '/quotes',
        })
      }

      setAlerts(result)
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setLoading(false) }
  }

  const SEVERITY_COLOR = {
    high: { bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-700', icon: '🔴' },
    medium: { bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-700', icon: '🟡' },
    low: { bg: 'bg-blue-50', border: 'border-blue-100', badge: 'bg-blue-100 text-blue-700', icon: '🔵' },
  }

  return (
    <div>
      <PageHeader title="알림" description={`현재 ${alerts.length}개 알림`} />

      <div className="flex gap-2 mb-5">
        <select value={bizFilter} onChange={e => setBizFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">전체 사업자</option>
          {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <button onClick={load} className="px-4 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">새로고침</button>
      </div>

      {loading ? (
        <div className="py-24 text-center text-sm text-gray-400">확인 중...</div>
      ) : alerts.length === 0 ? (
        <div className="bg-green-50 border border-green-100 rounded-2xl p-10 text-center">
          <p className="text-3xl mb-3">✅</p>
          <p className="font-semibold text-green-800">모든 항목이 정상입니다</p>
          <p className="text-sm text-green-600 mt-1">확인이 필요한 알림이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert, i) => {
            const c = SEVERITY_COLOR[alert.severity]
            return (
              <Link key={i} href={alert.href}
                className={`flex items-start gap-4 p-5 rounded-2xl border ${c.bg} ${c.border} hover:opacity-90 transition-opacity`}>
                <span className="text-xl mt-0.5">{c.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-gray-900">{alert.title}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${c.badge}`}>
                      {alert.severity === 'high' ? '긴급' : alert.severity === 'medium' ? '주의' : '정보'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 truncate">{alert.description}</p>
                </div>
                <span className="text-gray-400 text-sm mt-1">→</span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
