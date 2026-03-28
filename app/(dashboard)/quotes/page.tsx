'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/ui/PageHeader'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import {
  getQuotes, createQuote, updateQuoteStatus, deleteQuote, QuoteWithItems,
  getPurchaseOrders, createPurchaseOrder, updateOrderStatus, deletePurchaseOrder, PurchaseOrderWithItems
} from '@/lib/supabase/quotes'
import { getBusinesses } from '@/lib/supabase/businesses'
import { getPartners } from '@/lib/supabase/partners'
import { getProducts } from '@/lib/supabase/products'
import { getWarehouses } from '@/lib/supabase/warehouses'
import { Business, Partner, Product, Warehouse, QuoteStatus, PurchaseOrderStatus } from '@/lib/types'
import { formatMoney } from '@/lib/utils/format'

type Tab = 'quote' | 'order'

const QUOTE_STATUS: Record<QuoteStatus, { label: string; color: string }> = {
  draft: { label: '작성중', color: 'bg-gray-100 text-gray-600' },
  sent: { label: '발송', color: 'bg-blue-100 text-blue-700' },
  accepted: { label: '수락', color: 'bg-green-100 text-green-700' },
  rejected: { label: '거절', color: 'bg-red-100 text-red-600' },
  expired: { label: '만료', color: 'bg-orange-100 text-orange-600' },
}

const ORDER_STATUS: Record<PurchaseOrderStatus, { label: string; color: string }> = {
  pending: { label: '대기', color: 'bg-gray-100 text-gray-600' },
  partial: { label: '부분입고', color: 'bg-blue-100 text-blue-700' },
  done: { label: '완료', color: 'bg-green-100 text-green-700' },
  cancelled: { label: '취소', color: 'bg-red-100 text-red-600' },
}

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const labelCls = 'block text-sm font-medium text-gray-700 mb-1'

interface DraftItem { product_id: string; product_name: string; quantity: number; unit_price: number; note: string }

export default function QuotesPage() {
  const [tab, setTab] = useState<Tab>('quote')
  const [quotes, setQuotes] = useState<QuoteWithItems[]>([])
  const [orders, setOrders] = useState<PurchaseOrderWithItems[]>([])
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)
  const [bizFilter, setBizFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [detailItem, setDetailItem] = useState<QuoteWithItems | PurchaseOrderWithItems | null>(null)

  const [draft, setDraft] = useState<{ business_id: string; partner_id: string; date: string; valid_until: string; expected_date: string; note: string }>({
    business_id: '', partner_id: '', date: new Date().toISOString().slice(0, 10),
    valid_until: '', expected_date: '', note: '',
  })
  const [draftItems, setDraftItems] = useState<DraftItem[]>([
    { product_id: '', product_name: '', quantity: 1, unit_price: 0, note: '' }
  ])

  useEffect(() => { loadBase() }, [])
  useEffect(() => { loadData() }, [tab, bizFilter])

  async function loadBase() {
    const [b, p, pr, w] = await Promise.all([getBusinesses(), getPartners(), getProducts(), getWarehouses()])
    setBusinesses(b); setPartners(p); setProducts(pr); setWarehouses(w)
  }

  async function loadData() {
    setLoading(true)
    try {
      const biz = bizFilter !== 'all' ? bizFilter : undefined
      if (tab === 'quote') setQuotes(await getQuotes(biz))
      else setOrders(await getPurchaseOrders(biz))
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setLoading(false) }
  }

  function openNew() {
    setDraft({ business_id: businesses[0]?.id ?? '', partner_id: '', date: new Date().toISOString().slice(0, 10), valid_until: '', expected_date: '', note: '' })
    setDraftItems([{ product_id: '', product_name: '', quantity: 1, unit_price: 0, note: '' }])
    setModalOpen(true)
  }

  function updateItem(idx: number, field: keyof DraftItem, value: unknown) {
    setDraftItems(prev => prev.map((item, i) => {
      if (i !== idx) return item
      const updated = { ...item, [field]: value }
      if (field === 'product_id') {
        const prod = products.find(p => p.id === value)
        if (prod) { updated.product_name = prod.name; updated.unit_price = prod.sell_price }
      }
      return updated
    }))
  }

  const totalAmount = draftItems.reduce((s, i) => s + i.quantity * i.unit_price, 0)

  async function save() {
    if (!draft.business_id) return toast.error('사업자를 선택해주세요')
    try {
      if (tab === 'quote') {
        await createQuote(
          { business_id: draft.business_id, partner_id: draft.partner_id || null, staff_id: null, quote_date: draft.date, valid_until: draft.valid_until || null, status: 'draft', total_amount: totalAmount, note: draft.note || null },
          draftItems.filter(i => i.product_id || i.product_name).map((item, i) => ({
            product_id: item.product_id || null, product_name: item.product_name || null,
            quantity: item.quantity, unit_price: item.unit_price, amount: item.quantity * item.unit_price, note: item.note || null, sort_order: i
          }))
        )
      } else {
        await createPurchaseOrder(
          { business_id: draft.business_id, partner_id: draft.partner_id || null, warehouse_id: null, expected_date: draft.expected_date || draft.date, status: 'pending', note: draft.note || null },
          draftItems.filter(i => i.product_id).map(item => ({
            product_id: item.product_id, quantity: item.quantity, received_quantity: 0, unit_price: item.unit_price || null
          }))
        )
      }
      toast.success('저장되었습니다')
      setModalOpen(false)
      await loadData()
    } catch (e: unknown) { toast.error((e as Error).message) }
  }

  async function handleDelete() {
    if (!confirmId) return
    try {
      if (tab === 'quote') await deleteQuote(confirmId)
      else await deletePurchaseOrder(confirmId)
      toast.success('삭제되었습니다')
      await loadData()
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setConfirmId(null) }
  }

  async function changeStatus(id: string, status: string) {
    try {
      if (tab === 'quote') await updateQuoteStatus(id, status as QuoteStatus)
      else await updateOrderStatus(id, status as PurchaseOrderStatus)
      await loadData()
    } catch (e: unknown) { toast.error((e as Error).message) }
  }

  return (
    <div>
      <PageHeader
        title="견적·발주"
        action={<button onClick={openNew} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">+ {tab === 'quote' ? '견적서' : '발주서'} 작성</button>}
      />

      <div className="flex gap-1 mb-5 border-b border-gray-200">
        {([['quote', '견적서'], ['order', '발주서']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-900'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        <select value={bizFilter} onChange={e => setBizFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">전체 사업자</option>
          {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">불러오는 중...</div>
        ) : tab === 'quote' ? (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>{['날짜','거래처','유효기한','금액','상태',''].map(h => <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {quotes.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">견적서가 없습니다</td></tr>}
              {quotes.map(q => (
                <tr key={q.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setDetailItem(q)}>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{q.quote_date}</td>
                  <td className="px-4 py-3 font-medium">{q.partner_name ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{q.valid_until ?? '-'}</td>
                  <td className="px-4 py-3 font-bold">{formatMoney(q.total_amount)}원</td>
                  <td className="px-4 py-3">
                    <select value={q.status} onClick={e => e.stopPropagation()} onChange={e => changeStatus(q.id, e.target.value)}
                      className={`text-xs px-2 py-1 rounded-full border-0 font-medium cursor-pointer ${QUOTE_STATUS[q.status].color}`}>
                      {Object.entries(QUOTE_STATUS).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                    <button onClick={() => window.open(`/api/pdf/quote?id=${q.id}&type=quote`, '_blank')} className="text-gray-400 hover:text-blue-600 text-xs mr-2">🖨️</button>
                    <button onClick={() => setConfirmId(q.id)} className="text-red-500 hover:underline text-xs">삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>{['입고예정일','공급사','품목 수','상태','메모',''].map(h => <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {orders.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">발주서가 없습니다</td></tr>}
              {orders.map(o => (
                <tr key={o.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setDetailItem(o)}>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{o.expected_date}</td>
                  <td className="px-4 py-3 font-medium">{o.partner_name ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{o.items.length}개</td>
                  <td className="px-4 py-3">
                    <select value={o.status} onClick={e => e.stopPropagation()} onChange={e => changeStatus(o.id, e.target.value)}
                      className={`text-xs px-2 py-1 rounded-full border-0 font-medium cursor-pointer ${ORDER_STATUS[o.status].color}`}>
                      {Object.entries(ORDER_STATUS).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-gray-400 max-w-[160px] truncate">{o.note ?? '-'}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                    <button onClick={() => window.open(`/api/pdf/quote?id=${o.id}&type=order`, '_blank')} className="text-gray-400 hover:text-blue-600 text-xs mr-2">🖨️</button>
                    <button onClick={() => setConfirmId(o.id)} className="text-red-500 hover:underline text-xs">삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 작성 모달 */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={tab === 'quote' ? '견적서 작성' : '발주서 작성'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div><label className={labelCls}>사업자 *</label>
              <select className={inputCls} value={draft.business_id} onChange={e => setDraft(p => ({ ...p, business_id: e.target.value }))}>
                <option value="">선택</option>
                {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>{tab === 'quote' ? '거래처' : '공급사'}</label>
              <select className={inputCls} value={draft.partner_id} onChange={e => setDraft(p => ({ ...p, partner_id: e.target.value }))}>
                <option value="">선택 안 함</option>
                {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>{tab === 'quote' ? '견적일' : '발주일'}</label>
              <input type="date" className={inputCls} value={draft.date} onChange={e => setDraft(p => ({ ...p, date: e.target.value }))} />
            </div>
          </div>
          {tab === 'quote' ? (
            <div><label className={labelCls}>유효기한</label>
              <input type="date" className={inputCls} value={draft.valid_until} onChange={e => setDraft(p => ({ ...p, valid_until: e.target.value }))} />
            </div>
          ) : (
            <div><label className={labelCls}>입고 예정일</label>
              <input type="date" className={inputCls} value={draft.expected_date} onChange={e => setDraft(p => ({ ...p, expected_date: e.target.value }))} />
            </div>
          )}

          {/* 품목 */}
          <div>
            <div className="flex justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">품목</p>
              <button onClick={() => setDraftItems(p => [...p, { product_id: '', product_name: '', quantity: 1, unit_price: 0, note: '' }])}
                className="text-xs text-blue-600 hover:underline">+ 추가</button>
            </div>
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>{['상품','수량','단가','금액',''].map(h => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {draftItems.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-2 py-1.5">
                        <select className="w-36 border border-gray-200 rounded px-2 py-1 text-xs bg-white" value={item.product_id}
                          onChange={e => updateItem(idx, 'product_id', e.target.value)}>
                          <option value="">직접입력</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        {!item.product_id && (
                          <input className="w-full border border-gray-200 rounded px-2 py-1 text-xs mt-1" placeholder="품목명"
                            value={item.product_name} onChange={e => updateItem(idx, 'product_name', e.target.value)} />
                        )}
                      </td>
                      <td className="px-2 py-1.5"><input type="number" className="w-16 border border-gray-200 rounded px-2 py-1 text-xs"
                        value={item.quantity} onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)} /></td>
                      <td className="px-2 py-1.5"><input type="number" className="w-20 border border-gray-200 rounded px-2 py-1 text-xs"
                        value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', parseInt(e.target.value) || 0)} /></td>
                      <td className="px-2 py-1.5 text-gray-700">{formatMoney(item.quantity * item.unit_price)}</td>
                      <td className="px-2 py-1.5">{draftItems.length > 1 && <button onClick={() => setDraftItems(p => p.filter((_, i) => i !== idx))} className="text-red-400 text-base">×</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-right text-sm font-bold mt-2 pr-2">합계: {formatMoney(totalAmount)}원</div>
          </div>

          <div><label className={labelCls}>메모</label>
            <textarea className={inputCls} rows={2} value={draft.note} onChange={e => setDraft(p => ({ ...p, note: e.target.value }))} /></div>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">취소</button>
            <button onClick={save} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">저장</button>
          </div>
        </div>
      </Modal>

      {/* 상세 모달 */}
      <Modal open={!!detailItem} onClose={() => setDetailItem(null)} title={tab === 'quote' ? '견적서 상세' : '발주서 상세'} size="lg">
        {detailItem && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-gray-500">거래처</span><span className="ml-2 font-medium">{(detailItem as any).partner_name ?? '-'}</span></div>
            </div>
            <table className="w-full text-xs border border-gray-100 rounded-xl overflow-hidden">
              <thead className="bg-gray-50 text-gray-500">
                <tr>{['품목','수량','단가','금액'].map(h => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(detailItem as QuoteWithItems).items?.map((item: any) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2">{item.product_name ?? '-'}</td>
                    <td className="px-3 py-2">{item.quantity}</td>
                    <td className="px-3 py-2">{formatMoney(item.unit_price)}원</td>
                    <td className="px-3 py-2">{formatMoney((item.amount ?? item.quantity * item.unit_price))}원</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!confirmId} message={`${tab === 'quote' ? '견적서' : '발주서'}를 삭제하시겠습니까?`} onConfirm={handleDelete} onCancel={() => setConfirmId(null)} />
    </div>
  )
}
