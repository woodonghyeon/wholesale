'use client'

import { useState, useEffect } from 'react'
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

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [bizFilter, setBizFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<Partial<Product>>({})
  const [confirmId, setConfirmId] = useState<string | null>(null)

  useEffect(() => { loadAll() }, [])

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

  const filtered = products.filter(p => {
    const matchBiz = bizFilter === 'all' || p.business_id === bizFilter
    const matchSearch = !search || p.name.includes(search) || p.barcode?.includes(search) || p.category?.includes(search) || false
    return matchBiz && matchSearch
  })

  const bizName = (id: string | null) => businesses.find(b => b.id === id)?.name ?? '-'

  return (
    <div>
      <PageHeader
        title="상품 관리"
        description={`총 ${filtered.length}개`}
        action={
          <div className="flex gap-2">
            <button onClick={() => { setEditItem({ unit: 'ea', buy_price: 0, sell_price: 0, min_stock: 0, is_bundle: false }); setModalOpen(true) }}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
              + 상품 추가
            </button>
          </div>
        }
      />

      {/* 필터 */}
      <div className="flex gap-2 mb-4">
        <input
          placeholder="상품명·바코드·카테고리 검색"
          value={search} onChange={e => setSearch(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
        />
        <select value={bizFilter} onChange={e => setBizFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
          <option value="all">전체 사업자</option>
          {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">불러오는 중...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>
                {['바코드','상품명','카테고리','단위','매입가','판매가','안전재고','사업자',''].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400">상품이 없습니다</td></tr>
              )}
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">{p.barcode ?? '-'}</td>
                  <td className="px-4 py-3 font-medium">
                    {p.name}
                    {p.is_bundle && <span className="ml-1.5 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">묶음</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{p.category ?? '-'}</td>
                  <td className="px-4 py-3">{p.unit}</td>
                  <td className="px-4 py-3">{formatMoney(p.buy_price)}원</td>
                  <td className="px-4 py-3">{formatMoney(p.sell_price)}원</td>
                  <td className="px-4 py-3">
                    <span className={p.min_stock > 0 ? 'text-orange-600 font-medium' : 'text-gray-400'}>
                      {p.min_stock > 0 ? p.min_stock : '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{bizName(p.business_id)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => { setEditItem(p); setModalOpen(true) }} className="text-blue-600 hover:underline mr-3">수정</button>
                    <button onClick={() => setConfirmId(p.id)} className="text-red-500 hover:underline">삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem.id ? '상품 수정' : '상품 추가'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className={labelCls}>상품명 *</label>
              <input className={inputCls} value={editItem.name ?? ''} onChange={e => setEditItem(p => ({ ...p, name: e.target.value }))} /></div>
            <div><label className={labelCls}>바코드</label>
              <input className={inputCls} value={editItem.barcode ?? ''} onChange={e => setEditItem(p => ({ ...p, barcode: e.target.value }))} /></div>
            <div><label className={labelCls}>카테고리</label>
              <input className={inputCls} value={editItem.category ?? ''} onChange={e => setEditItem(p => ({ ...p, category: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className={labelCls}>단위</label>
              <input className={inputCls} value={editItem.unit ?? 'ea'} onChange={e => setEditItem(p => ({ ...p, unit: e.target.value }))} /></div>
            <div><label className={labelCls}>매입가 (원)</label>
              <input type="number" className={inputCls} value={editItem.buy_price ?? 0} onChange={e => setEditItem(p => ({ ...p, buy_price: parseInt(e.target.value) || 0 }))} /></div>
            <div><label className={labelCls}>판매가 (원)</label>
              <input type="number" className={inputCls} value={editItem.sell_price ?? 0} onChange={e => setEditItem(p => ({ ...p, sell_price: parseInt(e.target.value) || 0 }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>안전재고</label>
              <input type="number" className={inputCls} value={editItem.min_stock ?? 0} onChange={e => setEditItem(p => ({ ...p, min_stock: parseInt(e.target.value) || 0 }))} /></div>
            <div><label className={labelCls}>사업자</label>
              <select className={inputCls} value={editItem.business_id ?? ''} onChange={e => setEditItem(p => ({ ...p, business_id: e.target.value || null }))}>
                <option value="">선택 안 함</option>
                {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_bundle" checked={editItem.is_bundle ?? false} onChange={e => setEditItem(p => ({ ...p, is_bundle: e.target.checked }))} className="w-4 h-4 rounded border-gray-300" />
            <label htmlFor="is_bundle" className="text-sm text-gray-700">묶음 상품</label>
          </div>
          <div><label className={labelCls}>메모</label>
            <textarea className={inputCls} rows={2} value={editItem.note ?? ''} onChange={e => setEditItem(p => ({ ...p, note: e.target.value }))} /></div>
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
