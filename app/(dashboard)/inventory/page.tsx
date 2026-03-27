'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/ui/PageHeader'
import Modal from '@/components/ui/Modal'
import { getInventory, adjustInventory, InventoryRow } from '@/lib/supabase/inventory'
import { getBusinesses } from '@/lib/supabase/businesses'
import { getWarehouses } from '@/lib/supabase/warehouses'
import { Business, Warehouse } from '@/lib/types'
import { formatMoney } from '@/lib/utils/format'

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const labelCls = 'block text-sm font-medium text-gray-700 mb-1'

interface VelocityItem {
  name: string
  currentStock: number
  daysLeft: number | null
  reorderQty: number
  dailySales: number
  urgent: boolean
}

export default function InventoryPage() {
  const [rows, setRows] = useState<InventoryRow[]>([])
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)
  const [bizFilter, setBizFilter] = useState('all')
  const [whFilter, setWhFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [showLow, setShowLow] = useState(false)
  const [velocity, setVelocity] = useState<Map<string, VelocityItem>>(new Map())
  const [showReorder, setShowReorder] = useState(false)

  // 재고 조정 모달
  const [adjustModal, setAdjustModal] = useState(false)
  const [adjustTarget, setAdjustTarget] = useState<InventoryRow | null>(null)
  const [adjustQty, setAdjustQty] = useState(0)
  const [adjustNote, setAdjustNote] = useState('')

  useEffect(() => { loadAll() }, [])

  useEffect(() => { loadInventory() }, [bizFilter, whFilter])

  async function loadAll() {
    setLoading(true)
    try {
      const [b, w] = await Promise.all([getBusinesses(), getWarehouses()])
      setBusinesses(b); setWarehouses(w)
      await loadInventory()
      loadVelocity()
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setLoading(false) }
  }

  async function loadVelocity() {
    try {
      const res = await fetch('/api/analytics/stock-velocity?days=30')
      const data = await res.json()
      if (data.success) {
        const m = new Map<string, VelocityItem>()
        for (const item of data.items) m.set(item.name, item)
        setVelocity(m)
      }
    } catch { /* 무시 */ }
  }

  async function loadInventory() {
    try {
      const data = await getInventory(
        bizFilter !== 'all' ? bizFilter : undefined,
        whFilter !== 'all' ? whFilter : undefined
      )
      setRows(data)
    } catch (e: unknown) { toast.error((e as Error).message) }
  }

  async function submitAdjust() {
    if (!adjustTarget) return
    if (adjustQty === 0) return toast.error('조정 수량을 입력해주세요')
    try {
      await adjustInventory({
        product_id: adjustTarget.product_id,
        business_id: adjustTarget.business_id ?? '',
        warehouse_id: adjustTarget.warehouse_id,
        quantity: adjustQty,
        note: adjustNote,
      })
      toast.success('재고가 조정되었습니다')
      setAdjustModal(false); setAdjustTarget(null); setAdjustQty(0); setAdjustNote('')
      await loadInventory()
    } catch (e: unknown) { toast.error((e as Error).message) }
  }

  const filtered = rows.filter(r => {
    const matchSearch = !search || r.product_name.includes(search) || r.barcode?.includes(search) || r.category?.includes(search) || false
    const matchLow = !showLow || (r.min_stock > 0 && r.quantity <= r.min_stock)
    return matchSearch && matchLow
  })

  const totalValue = filtered.reduce((sum, r) => sum + r.quantity * r.buy_price, 0)
  const lowStockCount = rows.filter(r => r.min_stock > 0 && r.quantity <= r.min_stock).length

  return (
    <div>
      <PageHeader title="재고 관리" description={`총 ${filtered.length}개 품목 · 재고 가치 ${formatMoney(totalValue)}원`} />

      {/* 발주 추천 섹션 */}
      {velocity.size > 0 && (() => {
        const urgentItems = Array.from(velocity.values()).filter(v => v.urgent)
        if (!urgentItems.length) return null
        return (
          <div className="mb-6 bg-red-50 border border-red-100 rounded-2xl p-4">
            <button
              onClick={() => setShowReorder(v => !v)}
              className="flex items-center justify-between w-full text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-base">📦</span>
                <p className="text-sm font-semibold text-red-700">발주 추천 — {urgentItems.length}개 품목 소진 임박</p>
              </div>
              <span className="text-red-400 text-sm">{showReorder ? '▲' : '▼'}</span>
            </button>
            {showReorder && (
              <div className="mt-3 space-y-2">
                {urgentItems.map(item => (
                  <div key={item.name} className="flex items-center justify-between bg-white rounded-lg px-3 py-2.5 text-xs">
                    <span className="font-medium text-gray-700 truncate max-w-[200px]">{item.name}</span>
                    <div className="flex items-center gap-3 shrink-0 ml-2">
                      <span className="text-gray-400">현재 {item.currentStock}개</span>
                      {item.dailySales > 0 && <span className="text-gray-400">일 {item.dailySales}개 판매</span>}
                      {item.daysLeft !== null
                        ? <span className={`px-2 py-0.5 rounded-full font-bold ${item.daysLeft <= 3 ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                            {item.daysLeft}일 후 소진
                          </span>
                        : <span className="px-2 py-0.5 rounded-full font-bold bg-orange-100 text-orange-600">안전재고 이하</span>
                      }
                      {item.reorderQty > 0 && (
                        <span className="text-blue-600 font-semibold">→ {item.reorderQty}개 발주 추천</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 mb-1">전체 품목</p>
          <p className="text-2xl font-bold text-gray-900">{rows.length}<span className="text-sm font-normal text-gray-400 ml-1">개</span></p>
        </div>
        <div className={`bg-white rounded-xl border p-4 ${lowStockCount > 0 ? 'border-orange-200 bg-orange-50' : 'border-gray-100'}`}>
          <p className="text-xs text-gray-500 mb-1">부족 재고</p>
          <p className={`text-2xl font-bold ${lowStockCount > 0 ? 'text-orange-600' : 'text-gray-900'}`}>
            {lowStockCount}<span className="text-sm font-normal text-gray-400 ml-1">개</span>
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 mb-1">재고 가치 (매입가)</p>
          <p className="text-2xl font-bold text-gray-900">{formatMoney(totalValue)}<span className="text-sm font-normal text-gray-400 ml-1">원</span></p>
        </div>
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          placeholder="상품명·바코드 검색"
          value={search} onChange={e => setSearch(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
        />
        <select value={bizFilter} onChange={e => setBizFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">전체 사업자</option>
          {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={whFilter} onChange={e => setWhFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">전체 창고</option>
          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={showLow} onChange={e => setShowLow(e.target.checked)} className="w-4 h-4 rounded" />
          부족 재고만 보기
        </label>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">불러오는 중...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>
                {['상품명','카테고리','창고','현재고','안전재고','소진예측','매입가','재고가치',''].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">재고 데이터가 없습니다</td></tr>
              )}
              {filtered.map((r, i) => {
                const isLow = r.min_stock > 0 && r.quantity <= r.min_stock
                const vel = velocity.get(r.product_name)
                return (
                  <tr key={`${r.product_id}-${r.warehouse_id}-${i}`} className={`hover:bg-gray-50 ${isLow ? 'bg-orange-50/40' : ''}`}>
                    <td className="px-4 py-3 font-medium">
                      {r.product_name}
                      {isLow && <span className="ml-1.5 text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">부족</span>}
                      {vel?.urgent && !isLow && <span className="ml-1.5 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">임박</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{r.category ?? '-'}</td>
                    <td className="px-4 py-3 text-gray-500">{r.warehouse_name}</td>
                    <td className="px-4 py-3">
                      <span className={`font-bold ${isLow ? 'text-orange-600' : 'text-gray-900'}`}>{r.quantity.toLocaleString()}</span>
                      <span className="text-gray-400 text-xs ml-1">{r.unit}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{r.min_stock > 0 ? r.min_stock : '-'}</td>
                    <td className="px-4 py-3 text-xs">
                      {vel?.daysLeft != null
                        ? <span className={`font-medium ${vel.daysLeft <= 7 ? 'text-red-500' : vel.daysLeft <= 14 ? 'text-orange-500' : 'text-gray-500'}`}>
                            {vel.daysLeft}일 후
                          </span>
                        : vel?.dailySales === 0
                          ? <span className="text-gray-300">-</span>
                          : <span className="text-gray-400">-</span>
                      }
                    </td>
                    <td className="px-4 py-3">{formatMoney(r.buy_price)}원</td>
                    <td className="px-4 py-3 font-medium">{formatMoney(r.quantity * r.buy_price)}원</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => { setAdjustTarget(r); setAdjustQty(0); setAdjustNote(''); setAdjustModal(true) }}
                        className="text-blue-600 hover:underline text-xs">
                        재고조정
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 재고 조정 모달 */}
      <Modal open={adjustModal} onClose={() => setAdjustModal(false)} title="재고 조정" size="sm">
        {adjustTarget && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <p className="font-medium">{adjustTarget.product_name}</p>
              <p className="text-gray-500 text-xs mt-0.5">{adjustTarget.warehouse_name} · 현재 재고: <span className="font-bold text-gray-800">{adjustTarget.quantity} {adjustTarget.unit}</span></p>
            </div>
            <div>
              <label className={labelCls}>조정 수량 <span className="text-gray-400 font-normal">(+입고 / -출고)</span></label>
              <input
                type="number"
                className={inputCls}
                value={adjustQty}
                onChange={e => setAdjustQty(parseInt(e.target.value) || 0)}
                placeholder="+10 또는 -5"
              />
              {adjustQty !== 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  조정 후: <span className="font-bold text-gray-800">{adjustTarget.quantity + adjustQty} {adjustTarget.unit}</span>
                </p>
              )}
            </div>
            <div>
              <label className={labelCls}>메모</label>
              <input className={inputCls} value={adjustNote} onChange={e => setAdjustNote(e.target.value)} placeholder="조정 사유 (선택)" />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setAdjustModal(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">취소</button>
              <button onClick={submitAdjust} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">조정 적용</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
