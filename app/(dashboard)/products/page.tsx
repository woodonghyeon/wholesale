'use client'

import { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/ui/PageHeader'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { getProducts, upsertProduct, deleteProduct } from '@/lib/supabase/products'
import { getBusinesses } from '@/lib/supabase/businesses'
import { Product, Business } from '@/lib/types'
import { formatMoney } from '@/lib/utils/format'

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const labelCls = 'block text-sm font-medium text-gray-700 mb-1'

const PAGE_SIZE_OPTIONS = [20, 50, 100]

type ViewMode = 'list' | 'card'

function categoryColor(category: string | null | undefined) {
  if (!category) return 'bg-gray-100 text-gray-500'
  const map: Record<string, string> = {
    '필기도구': 'bg-blue-100 text-blue-700',
    '매직': 'bg-purple-100 text-purple-700',
    '보드마카': 'bg-indigo-100 text-indigo-700',
    '풀/접착제': 'bg-yellow-100 text-yellow-700',
    '종이접기': 'bg-pink-100 text-pink-700',
    '샤프': 'bg-cyan-100 text-cyan-700',
    '펜': 'bg-green-100 text-green-700',
  }
  for (const [key, cls] of Object.entries(map)) {
    if (category.includes(key)) return cls
  }
  return 'bg-gray-100 text-gray-600'
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [bizFilter, setBizFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<Partial<Product>>({})
  const [confirmId, setConfirmId] = useState<string | null>(null)

  // 뷰 & 페이지네이션
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [pageSize, setPageSize] = useState(50)
  const [page, setPage] = useState(1)

  useEffect(() => { loadAll() }, [])

  // 검색·필터 변경 시 1페이지로 리셋
  useEffect(() => { setPage(1) }, [search, bizFilter, pageSize])

  async function loadAll() {
    setLoading(true)
    try {
      const [p, b] = await Promise.all([getProducts(), getBusinesses()])
      setProducts(p); setBusinesses(b)
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setLoading(false) }
  }

  async function save() {
    if (!editItem.name?.trim()) return toast.error('상품명을 입력해주세요')
    try {
      await upsertProduct({ unit: 'ea', buy_price: 0, sell_price: 0, min_stock: 0, is_bundle: false, ...editItem } as Product & { name: string })
      toast.success('저장되었습니다')
      setModalOpen(false); setEditItem({})
      setProducts(await getProducts())
    } catch (e: unknown) { toast.error((e as Error).message) }
  }

  async function handleDelete() {
    if (!confirmId) return
    try {
      await deleteProduct(confirmId)
      toast.success('삭제되었습니다')
      setProducts(await getProducts())
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setConfirmId(null) }
  }

  const filtered = useMemo(() => products.filter(p => {
    const matchBiz = bizFilter === 'all' || p.business_id === bizFilter
    const matchSearch = !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode?.includes(search) ||
      p.category?.includes(search) || false
    return matchBiz && matchSearch
  }), [products, bizFilter, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)
  const bizName = (id: string | null) => businesses.find(b => b.id === id)?.name ?? '-'

  function openEdit(p: Partial<Product>) { setEditItem(p); setModalOpen(true) }

  // 페이지 번호 배열 (최대 7개)
  const pageNumbers = useMemo(() => {
    const pages: (number | '...')[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (page > 3) pages.push('...')
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
      if (page < totalPages - 2) pages.push('...')
      pages.push(totalPages)
    }
    return pages
  }, [page, totalPages])

  return (
    <div>
      <PageHeader
        title="상품 관리"
        description={`총 ${filtered.length}개${filtered.length !== products.length ? ` (전체 ${products.length}개)` : ''}`}
        action={
          <div className="flex gap-2">
            <button
              onClick={() => {
                const biz = bizFilter !== 'all' ? `&businessId=${bizFilter}` : ''
                window.open(`/api/pdf/price-list?${biz}`, '_blank')
              }}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 border border-gray-200"
            >
              🖨️ 가격표 출력
            </button>
            <button
              onClick={() => openEdit({ unit: 'ea', buy_price: 0, sell_price: 0, min_stock: 0, is_bundle: false })}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
            >
              + 상품 추가
            </button>
          </div>
        }
      />

      {/* ── 툴바 ──────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        {/* 검색 */}
        <input
          placeholder="상품명·바코드·카테고리 검색"
          value={search} onChange={e => setSearch(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
        />
        {/* 사업자 필터 */}
        <select value={bizFilter} onChange={e => setBizFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
          <option value="all">전체 사업자</option>
          {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>

        <div className="ml-auto flex items-center gap-2">
          {/* 페이지당 개수 */}
          <span className="text-xs text-gray-400">페이지당</span>
          <div className="flex border border-gray-200 rounded-lg overflow-hidden">
            {PAGE_SIZE_OPTIONS.map(n => (
              <button key={n} onClick={() => setPageSize(n)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${pageSize === n ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                {n}
              </button>
            ))}
          </div>

          {/* 뷰 모드 */}
          <div className="flex border border-gray-200 rounded-lg overflow-hidden ml-1">
            <button onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-xs transition-colors flex items-center gap-1 ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              리스트
            </button>
            <button onClick={() => setViewMode('card')}
              className={`px-3 py-1.5 text-xs transition-colors flex items-center gap-1 ${viewMode === 'card' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm8 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm8 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              카드
            </button>
          </div>
        </div>
      </div>

      {/* ── 콘텐츠 ──────────────────────────────────── */}
      {loading ? (
        <div className="py-16 text-center text-sm text-gray-400">불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-gray-400 bg-white rounded-xl border border-gray-100">상품이 없습니다</div>
      ) : viewMode === 'list' ? (
        /* ── 리스트 뷰 ── */
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>
                {['바코드', '상품명', '카테고리', '단위', '매입가', '판매가', '안전재고', '사업자', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginated.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 group">
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">{p.barcode ?? '-'}</td>
                  <td className="px-4 py-3 font-medium">
                    {p.name}
                    {p.is_bundle && <span className="ml-1.5 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">묶음</span>}
                  </td>
                  <td className="px-4 py-3">
                    {p.category
                      ? <span className={`text-xs px-2 py-0.5 rounded-full ${categoryColor(p.category)}`}>{p.category}</span>
                      : <span className="text-gray-300">-</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{p.unit}</td>
                  <td className="px-4 py-3 text-gray-600">{formatMoney(p.buy_price)}원</td>
                  <td className="px-4 py-3 font-medium text-blue-600">{formatMoney(p.sell_price)}원</td>
                  <td className="px-4 py-3">
                    <span className={p.min_stock > 0 ? 'text-orange-600 font-medium' : 'text-gray-300'}>
                      {p.min_stock > 0 ? p.min_stock : '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{bizName(p.business_id)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(p)} className="text-blue-600 hover:underline mr-3 text-xs">수정</button>
                    <button onClick={() => setConfirmId(p.id)} className="text-red-500 hover:underline text-xs">삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* ── 카드 뷰 ── */
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {paginated.map(p => (
            <div key={p.id} className="bg-white border border-gray-100 rounded-xl p-4 hover:shadow-md hover:border-blue-100 transition-all group flex flex-col">
              {/* 카테고리 뱃지 */}
              <div className="flex items-start justify-between mb-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${categoryColor(p.category)}`}>
                  {p.category ?? '미분류'}
                </span>
                {p.is_bundle && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">묶음</span>}
              </div>

              {/* 상품명 */}
              <p className="text-sm font-medium text-gray-800 leading-snug mb-1 flex-1 line-clamp-2" title={p.name}>
                {p.name}
              </p>

              {/* 바코드 */}
              {p.barcode && (
                <p className="text-xs text-gray-300 font-mono mb-2 truncate">{p.barcode}</p>
              )}

              {/* 가격 */}
              <div className="mt-auto pt-2 border-t border-gray-50">
                <div className="flex justify-between items-end mb-1">
                  <span className="text-xs text-gray-400">판매가</span>
                  <span className="text-sm font-bold text-blue-600">{formatMoney(p.sell_price)}원</span>
                </div>
                {p.buy_price > 0 && (
                  <div className="flex justify-between items-end">
                    <span className="text-xs text-gray-400">매입가</span>
                    <span className="text-xs text-gray-500">{formatMoney(p.buy_price)}원</span>
                  </div>
                )}
                {p.min_stock > 0 && (
                  <div className="flex justify-between items-end mt-0.5">
                    <span className="text-xs text-gray-400">안전재고</span>
                    <span className="text-xs text-orange-500 font-medium">{p.min_stock}</span>
                  </div>
                )}
              </div>

              {/* 액션 버튼 */}
              <div className="flex gap-1.5 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(p)}
                  className="flex-1 text-xs py-1.5 border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50">
                  수정
                </button>
                <button onClick={() => setConfirmId(p.id)}
                  className="flex-1 text-xs py-1.5 border border-red-200 text-red-500 rounded-lg hover:bg-red-50">
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── 페이지네이션 ──────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-gray-400">
            {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, filtered.length)} / 총 {filtered.length}개
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-30 hover:bg-gray-50">
              ‹ 이전
            </button>
            {pageNumbers.map((n, i) =>
              n === '...'
                ? <span key={`dot-${i}`} className="px-1 text-gray-400 text-xs">…</span>
                : <button key={n} onClick={() => setPage(n as number)}
                    className={`w-8 h-7 text-xs rounded-lg transition-colors ${page === n ? 'bg-blue-600 text-white font-medium' : 'border border-gray-200 hover:bg-gray-50 text-gray-600'}`}>
                    {n}
                  </button>
            )}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-30 hover:bg-gray-50">
              다음 ›
            </button>
          </div>
        </div>
      )}

      {/* ── 상품 추가/수정 모달 ──────────────────────── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem.id ? '상품 수정' : '상품 추가'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={labelCls}>상품명 *</label>
              <input className={inputCls} value={editItem.name ?? ''} onChange={e => setEditItem(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>바코드</label>
              <input className={inputCls} value={editItem.barcode ?? ''} onChange={e => setEditItem(p => ({ ...p, barcode: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>카테고리</label>
              <input className={inputCls} value={editItem.category ?? ''} onChange={e => setEditItem(p => ({ ...p, category: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>단위</label>
              <input className={inputCls} value={editItem.unit ?? 'ea'} onChange={e => setEditItem(p => ({ ...p, unit: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>매입가 (원)</label>
              <input type="number" className={inputCls} value={editItem.buy_price ?? 0} onChange={e => setEditItem(p => ({ ...p, buy_price: parseInt(e.target.value) || 0 }))} />
            </div>
            <div>
              <label className={labelCls}>판매가 (원)</label>
              <input type="number" className={inputCls} value={editItem.sell_price ?? 0} onChange={e => setEditItem(p => ({ ...p, sell_price: parseInt(e.target.value) || 0 }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>안전재고</label>
              <input type="number" className={inputCls} value={editItem.min_stock ?? 0} onChange={e => setEditItem(p => ({ ...p, min_stock: parseInt(e.target.value) || 0 }))} />
            </div>
            <div>
              <label className={labelCls}>사업자</label>
              <select className={inputCls} value={editItem.business_id ?? ''} onChange={e => setEditItem(p => ({ ...p, business_id: e.target.value || null }))}>
                <option value="">선택 안 함</option>
                {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_bundle" checked={editItem.is_bundle ?? false}
              onChange={e => setEditItem(p => ({ ...p, is_bundle: e.target.checked }))} className="w-4 h-4 rounded border-gray-300" />
            <label htmlFor="is_bundle" className="text-sm text-gray-700">묶음 상품</label>
          </div>
          <div>
            <label className={labelCls}>메모</label>
            <textarea className={inputCls} rows={2} value={editItem.note ?? ''} onChange={e => setEditItem(p => ({ ...p, note: e.target.value }))} />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">취소</button>
            <button onClick={save} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">저장</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!confirmId} message="상품을 삭제하시겠습니까?" onConfirm={handleDelete} onCancel={() => setConfirmId(null)} />
    </div>
  )
}
