'use client'

import { useEffect, useState, useCallback } from 'react'
import { useBusinessStore } from '@/store/businessStore'
import {
  fetchInventory,
  fetchInventoryStats,
  fetchWarehouses,
} from '@/lib/supabase/inventory'
import { fetchCategories } from '@/lib/supabase/products'
import type { InventoryWithProduct, InventoryStats } from '@/lib/supabase/inventory'
import InventoryTableView from './InventoryTableView'
import InventoryListView from './InventoryListView'
import InventoryCardView from './InventoryCardView'
import InventoryAdjustModal from './InventoryAdjustModal'
import { toast } from 'sonner'

type ViewMode = 'table' | 'list' | 'card'
type PageSize = 10 | 50 | 100

function fmt(n: number) { return new Intl.NumberFormat('ko-KR').format(n) }

export default function InventoryPage() {
  const { selectedBusinessId } = useBusinessStore()

  const [items, setItems] = useState<InventoryWithProduct[]>([])
  const [stats, setStats] = useState<InventoryStats>({ totalSkus: 0, totalValue: 0, lowStockCount: 0, warehouseCount: 0 })
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState<PageSize>(50)

  const [filterWarehouse, setFilterWarehouse] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterSearch, setFilterSearch] = useState('')
  const [filterLowStock, setFilterLowStock] = useState(false)

  const [selectedItem, setSelectedItem] = useState<InventoryWithProduct | null>(null)

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const paginated = items.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const load = useCallback(async () => {
    setLoading(true)
    setCurrentPage(1)
    try {
      const [data, s, wh, cats] = await Promise.all([
        fetchInventory({
          businessId: selectedBusinessId,
          warehouseId: filterWarehouse || undefined,
          category: filterCategory || undefined,
          search: filterSearch || undefined,
          lowStockOnly: filterLowStock,
        }),
        fetchInventoryStats(selectedBusinessId),
        fetchWarehouses(selectedBusinessId),
        fetchCategories(selectedBusinessId),
      ])
      setItems(data)
      setStats(s)
      setWarehouses(wh)
      setCategories(cats)
    } catch {
      toast.error('데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [selectedBusinessId, filterWarehouse, filterCategory, filterSearch, filterLowStock])

  useEffect(() => { load() }, [load])
  useEffect(() => { setCurrentPage(1) }, [pageSize])

  function renderPagination() {
    if (totalPages <= 1) return null
    const pages: (number | '...')[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (currentPage > 3) pages.push('...')
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i)
      if (currentPage < totalPages - 2) pages.push('...')
      pages.push(totalPages)
    }
    return (
      <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
        <div className="flex items-center gap-1.5">
          {([10, 50, 100] as PageSize[]).map(s => (
            <button
              key={s}
              onClick={() => setPageSize(s)}
              className={`px-2.5 py-1 rounded-lg text-xs transition-all ${pageSize === s ? 'bg-[#007aff] text-white' : 'text-[#86868b] hover:bg-gray-100'}`}
            >{s}개</button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#86868b] hover:bg-gray-100 disabled:opacity-30 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          {pages.map((p, i) =>
            p === '...' ? (
              <span key={`e${i}`} className="w-7 h-7 flex items-center justify-center text-xs text-[#86868b]">…</span>
            ) : (
              <button
                key={p}
                onClick={() => setCurrentPage(p as number)}
                className={`w-7 h-7 rounded-lg text-xs transition-all ${currentPage === p ? 'bg-[#007aff] text-white font-medium' : 'text-[#1d1d1f] hover:bg-gray-100'}`}
              >{p}</button>
            )
          )}
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#86868b] hover:bg-gray-100 disabled:opacity-30 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <span className="text-xs text-[#86868b]">총 {fmt(items.length)}개</span>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#1d1d1f]">재고 관리</h1>
          <p className="text-sm text-[#86868b] mt-0.5">창고별 상품 재고 현황 및 조정</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium border border-gray-200 hover:bg-gray-50 transition-all duration-200"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          새로고침
        </button>
      </div>

      {/* KPI 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: '총 SKU 수', value: fmt(stats.totalSkus) + '개', sub: '재고 보유 항목', color: 'text-[#007aff]' },
          { label: '재고 자산', value: '₩' + fmt(stats.totalValue), sub: '매입가 기준', color: 'text-[#34c759]' },
          { label: '저재고 경고', value: fmt(stats.lowStockCount) + '개', sub: '안전재고 이하', color: stats.lowStockCount > 0 ? 'text-[#ff3b30]' : 'text-[#86868b]' },
          { label: '운영 창고', value: fmt(stats.warehouseCount) + '개', sub: '보유 창고 수', color: 'text-[#ff9f0a]' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white/80 backdrop-blur-xl border border-black/[0.06] rounded-2xl p-5">
            <div className="text-xs text-[#86868b] mb-2">{kpi.label}</div>
            <div className={`text-2xl font-bold tabular-nums ${kpi.color}`}>{kpi.value}</div>
            <div className="text-xs text-[#86868b] mt-1">{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* 필터 + 뷰 컨트롤 */}
      <div className="bg-white/80 backdrop-blur-xl border border-black/[0.06] rounded-2xl shadow-sm">
        <div className="flex flex-wrap items-center gap-2 p-4 border-b border-gray-100">
          {/* 창고 필터 */}
          <select
            value={filterWarehouse}
            onChange={e => { setFilterWarehouse(e.target.value); setCurrentPage(1) }}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">전체 창고</option>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>

          {/* 카테고리 필터 */}
          <select
            value={filterCategory}
            onChange={e => { setFilterCategory(e.target.value); setCurrentPage(1) }}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">전체 카테고리</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {/* 저재고 토글 */}
          <button
            onClick={() => { setFilterLowStock(v => !v); setCurrentPage(1) }}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all border ${
              filterLowStock
                ? 'bg-red-50 border-red-200 text-[#ff3b30]'
                : 'border-gray-200 text-[#86868b] hover:bg-gray-50'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            저재고만
          </button>

          {/* 검색 */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#86868b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={filterSearch}
                onChange={e => { setFilterSearch(e.target.value); setCurrentPage(1) }}
                placeholder="상품명, 바코드 검색"
                className="w-full rounded-lg border border-gray-200 bg-white pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          {/* 뷰 모드 */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5 ml-auto">
            {([
              { mode: 'table', icon: 'M3 10h18M3 14h18M10 6h8M10 18h8M3 6h4M3 18h4' },
              { mode: 'list', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
              { mode: 'card', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
            ] as { mode: ViewMode; icon: string }[]).map(({ mode, icon }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`p-1.5 rounded-md transition-all ${viewMode === mode ? 'bg-white shadow-sm text-[#007aff]' : 'text-[#86868b] hover:text-[#1d1d1f]'}`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                </svg>
              </button>
            ))}
          </div>
        </div>

        {/* 콘텐츠 */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-[#007aff] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : paginated.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#86868b]">
            <svg className="w-10 h-10 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <p className="text-sm">재고 데이터가 없습니다.</p>
          </div>
        ) : viewMode === 'table' ? (
          <InventoryTableView items={paginated} onSelect={setSelectedItem} />
        ) : viewMode === 'list' ? (
          <InventoryListView items={paginated} onSelect={setSelectedItem} />
        ) : (
          <div className="p-4">
            <InventoryCardView items={paginated} onSelect={setSelectedItem} />
          </div>
        )}

        {renderPagination()}
      </div>

      {/* 재고 조정 모달 */}
      {selectedItem && (
        <InventoryAdjustModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onSaved={load}
        />
      )}
    </div>
  )
}
