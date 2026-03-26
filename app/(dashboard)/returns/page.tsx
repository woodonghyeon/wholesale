'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/ui/PageHeader'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { getReturns, upsertReturn, deleteReturn, ReturnRow } from '@/lib/supabase/returns'
import { getBusinesses } from '@/lib/supabase/businesses'
import { getPartners } from '@/lib/supabase/partners'
import { getProducts } from '@/lib/supabase/products'
import { Return, Business, Partner, Product, ReturnReason, ReturnDisposition, ReturnStatus } from '@/lib/types'

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const labelCls = 'block text-sm font-medium text-gray-700 mb-1'

const REASON_LABEL: Record<ReturnReason, string> = { simple: '단순변심', defect: '불량', wrong_delivery: '오배송', other: '기타' }
const DISPOSITION_LABEL: Record<ReturnDisposition, string> = { restock: '재입고', dispose: '폐기', return_to_supplier: '공급사반품' }
const STATUS_LABEL: Record<ReturnStatus, { label: string; color: string }> = {
  received: { label: '접수', color: 'bg-gray-100 text-gray-600' },
  inspecting: { label: '검수중', color: 'bg-blue-100 text-blue-700' },
  done: { label: '처리완료', color: 'bg-green-100 text-green-700' },
}

export default function ReturnsPage() {
  const [returns, setReturns] = useState<ReturnRow[]>([])
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [bizFilter, setBizFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<Partial<Return>>({})
  const [confirmId, setConfirmId] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([getBusinesses(), getPartners(), getProducts()])
      .then(([b, p, pr]) => { setBusinesses(b); setPartners(p); setProducts(pr) })
  }, [])
  useEffect(() => { load() }, [bizFilter])

  async function load() {
    setLoading(true)
    try { setReturns(await getReturns(bizFilter !== 'all' ? bizFilter : undefined)) }
    catch (e: unknown) { toast.error((e as Error).message) }
    finally { setLoading(false) }
  }

  async function save() {
    if (!editItem.business_id) return toast.error('사업자를 선택해주세요')
    if (!editItem.quantity || editItem.quantity <= 0) return toast.error('수량을 입력해주세요')
    try {
      await upsertReturn({ status: 'received', restock_done: false, quantity: 1, ...editItem } as Return & { business_id: string })
      toast.success('저장되었습니다')
      setModalOpen(false); setEditItem({})
      await load()
    } catch (e: unknown) { toast.error((e as Error).message) }
  }

  async function handleDelete() {
    if (!confirmId) return
    try { await deleteReturn(confirmId); toast.success('삭제되었습니다'); await load() }
    catch (e: unknown) { toast.error((e as Error).message) }
    finally { setConfirmId(null) }
  }

  return (
    <div>
      <PageHeader
        title="반품·불량 관리"
        description={`총 ${returns.length}건`}
        action={
          <button onClick={() => { setEditItem({ business_id: businesses[0]?.id, quantity: 1, status: 'received', restock_done: false }); setModalOpen(true) }}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">+ 반품 등록</button>
        }
      />

      <div className="flex gap-2 mb-4">
        <select value={bizFilter} onChange={e => setBizFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">전체 사업자</option>
          {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? <div className="py-16 text-center text-sm text-gray-400">불러오는 중...</div> : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>{['접수일','거래처','상품','수량','반품사유','처리방법','상태',''].map(h => <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {returns.length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">반품 내역이 없습니다</td></tr>}
              {returns.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{r.created_at.slice(0, 10)}</td>
                  <td className="px-4 py-3">{r.partner_name ?? '-'}</td>
                  <td className="px-4 py-3 font-medium">{r.product_name ?? '-'}</td>
                  <td className="px-4 py-3">{r.quantity}</td>
                  <td className="px-4 py-3 text-gray-500">{r.reason ? REASON_LABEL[r.reason] : '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{r.disposition ? DISPOSITION_LABEL[r.disposition] : '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_LABEL[r.status].color}`}>{STATUS_LABEL[r.status].label}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => { setEditItem(r); setModalOpen(true) }} className="text-blue-600 hover:underline mr-3 text-xs">수정</button>
                    <button onClick={() => setConfirmId(r.id)} className="text-red-500 hover:underline text-xs">삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem.id ? '반품 수정' : '반품 등록'} size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>사업자 *</label>
              <select className={inputCls} value={editItem.business_id ?? ''} onChange={e => setEditItem(p => ({ ...p, business_id: e.target.value }))}>
                <option value="">선택</option>
                {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>거래처</label>
              <select className={inputCls} value={editItem.partner_id ?? ''} onChange={e => setEditItem(p => ({ ...p, partner_id: e.target.value || null }))}>
                <option value="">선택 안 함</option>
                {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>상품</label>
              <select className={inputCls} value={editItem.product_id ?? ''} onChange={e => setEditItem(p => ({ ...p, product_id: e.target.value || null }))}>
                <option value="">선택 안 함</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>수량 *</label>
              <input type="number" className={inputCls} value={editItem.quantity ?? 1} onChange={e => setEditItem(p => ({ ...p, quantity: parseInt(e.target.value) || 1 }))} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className={labelCls}>반품사유</label>
              <select className={inputCls} value={editItem.reason ?? ''} onChange={e => setEditItem(p => ({ ...p, reason: (e.target.value || null) as ReturnReason | null }))}>
                <option value="">선택</option>
                {Object.entries(REASON_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>처리방법</label>
              <select className={inputCls} value={editItem.disposition ?? ''} onChange={e => setEditItem(p => ({ ...p, disposition: (e.target.value || null) as ReturnDisposition | null }))}>
                <option value="">선택</option>
                {Object.entries(DISPOSITION_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>상태</label>
              <select className={inputCls} value={editItem.status ?? 'received'} onChange={e => setEditItem(p => ({ ...p, status: e.target.value as ReturnStatus }))}>
                {Object.entries(STATUS_LABEL).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
              </select>
            </div>
          </div>
          <div><label className={labelCls}>메모</label>
            <textarea className={inputCls} rows={2} value={editItem.note ?? ''} onChange={e => setEditItem(p => ({ ...p, note: e.target.value }))} />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">취소</button>
            <button onClick={save} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">저장</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!confirmId} message="반품 내역을 삭제하시겠습니까?" onConfirm={handleDelete} onCancel={() => setConfirmId(null)} />
    </div>
  )
}
