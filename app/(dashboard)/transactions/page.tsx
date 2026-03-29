'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/ui/PageHeader'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { getSlips, createSlip, deleteSlip, SlipWithItems } from '@/lib/supabase/slips'
import { getBusinesses } from '@/lib/supabase/businesses'
import { getPartners } from '@/lib/supabase/partners'
import { getWarehouses } from '@/lib/supabase/warehouses'
import { getChannels } from '@/lib/supabase/channels'
import { getProducts } from '@/lib/supabase/products'
import { Business, Partner, Warehouse, Channel, Product, SlipType, SlipItem } from '@/lib/types'
import { formatMoney, formatDate } from '@/lib/utils/format'
import ProductDetailModal from '@/components/ui/ProductDetailModal'
import { SortableHeader, useSortable } from '@/components/ui/SortableHeader'

type Tab = 'sale' | 'purchase'

interface DraftItem {
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  tax_amount: number
  note: string
  sort_order: number
}

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const labelCls = 'block text-sm font-medium text-gray-700 mb-1'

function calcSupply(qty: number, price: number) { return qty * price }
function calcTax(supply: number, taxed: boolean) { return taxed ? Math.round(supply / 10) : 0 }

export default function TransactionsPage() {
  const [tab, setTab] = useState<Tab>('sale')
  const [slips, setSlips] = useState<SlipWithItems[]>([])
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [bizFilter, setBizFilter] = useState('all')
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10)
  })
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [modalOpen, setModalOpen] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [detailSlip, setDetailSlip] = useState<SlipWithItems | null>(null)
  const [productDetail, setProductDetail] = useState<{ id?: string; name?: string } | null>(null)

  // 전표 작성 상태
  const [draft, setDraft] = useState<{
    business_id: string
    partner_id: string
    warehouse_id: string
    channel_id: string
    slip_date: string
    due_date: string
    payment_type: 'cash' | 'credit' | 'mixed'
    is_tax_invoice: boolean
    memo: string
  }>({
    business_id: '', partner_id: '', warehouse_id: '', channel_id: '',
    slip_date: new Date().toISOString().slice(0, 10), due_date: '',
    payment_type: 'credit', is_tax_invoice: false, memo: '',
  })
  const [draftItems, setDraftItems] = useState<DraftItem[]>([
    { product_id: '', product_name: '', quantity: 1, unit_price: 0, tax_amount: 0, note: '', sort_order: 0 }
  ])

  useEffect(() => { loadBase() }, [])
  useEffect(() => { loadSlips() }, [tab, bizFilter, fromDate, toDate])

  async function loadBase() {
    try {
      const [b, p, w, c, pr] = await Promise.all([
        getBusinesses(), getPartners(), getWarehouses(), getChannels(), getProducts()
      ])
      setBusinesses(b); setPartners(p); setWarehouses(w); setChannels(c); setProducts(pr)
    } catch (e: unknown) { toast.error((e as Error).message) }
  }

  async function loadSlips() {
    setLoading(true)
    try {
      setSlips(await getSlips(tab, bizFilter !== 'all' ? bizFilter : undefined, fromDate, toDate))
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setLoading(false) }
  }

  function openNew() {
    setDraft({
      business_id: businesses[0]?.id ?? '', partner_id: '', warehouse_id: '', channel_id: '',
      slip_date: new Date().toISOString().slice(0, 10), due_date: '',
      payment_type: 'credit', is_tax_invoice: false, memo: '',
    })
    setDraftItems([{ product_id: '', product_name: '', quantity: 1, unit_price: 0, tax_amount: 0, note: '', sort_order: 0 }])
    setModalOpen(true)
  }

  function addItem() {
    setDraftItems(prev => [...prev, {
      product_id: '', product_name: '', quantity: 1, unit_price: 0, tax_amount: 0, note: '', sort_order: prev.length
    }])
  }

  function removeItem(idx: number) {
    setDraftItems(prev => prev.filter((_, i) => i !== idx))
  }

  function updateItem(idx: number, field: keyof DraftItem, value: unknown) {
    setDraftItems(prev => prev.map((item, i) => {
      if (i !== idx) return item
      const updated = { ...item, [field]: value }
      // 상품 선택 시 단가 자동
      if (field === 'product_id') {
        const prod = products.find(p => p.id === value)
        if (prod) {
          updated.product_name = prod.name
          updated.unit_price = tab === 'purchase' ? prod.buy_price : prod.sell_price
        }
      }
      return updated
    }))
  }

  const totalSupply = draftItems.reduce((s, i) => s + calcSupply(i.quantity, i.unit_price), 0)
  const totalTax = draft.is_tax_invoice ? draftItems.reduce((s, i) => s + calcTax(calcSupply(i.quantity, i.unit_price), true), 0) : 0
  const totalAmount = totalSupply + totalTax

  async function save() {
    if (!draft.business_id) return toast.error('사업자를 선택해주세요')
    if (draftItems.some(i => !i.product_id && !i.product_name)) return toast.error('품목을 입력해주세요')
    try {
      await createSlip(
        {
          slip_type: tab,
          business_id: draft.business_id,
          partner_id: draft.partner_id || null,
          warehouse_id: draft.warehouse_id || null,
          channel_id: draft.channel_id || null,
          staff_id: null,
          slip_date: draft.slip_date,
          due_date: draft.due_date || null,
          payment_type: draft.payment_type,
          cash_amount: draft.payment_type === 'cash' ? totalAmount : 0,
          supply_amount: totalSupply,
          tax_amount: totalTax,
          total_amount: totalAmount,
          memo: draft.memo || null,
          is_tax_invoice: draft.is_tax_invoice,
          tax_invoice_no: null,
        },
        draftItems.filter(i => i.product_id || i.product_name).map((item, i) => ({
          product_id: item.product_id || null,
          product_name: item.product_name || null,
          quantity: item.quantity,
          unit_price: item.unit_price,
          supply_amount: calcSupply(item.quantity, item.unit_price),
          tax_amount: draft.is_tax_invoice ? calcTax(calcSupply(item.quantity, item.unit_price), true) : 0,
          note: item.note || null,
          sort_order: i,
        }))
      )
      toast.success('저장되었습니다')
      setModalOpen(false)
      await loadSlips()
    } catch (e: unknown) { toast.error((e as Error).message) }
  }

  async function handleDelete() {
    if (!confirmId) return
    try {
      await deleteSlip(confirmId)
      toast.success('삭제되었습니다')
      await loadSlips()
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setConfirmId(null) }
  }

  const totalSales = slips.reduce((s, sl) => s + sl.total_amount, 0)
  const PAYMENT_LABEL = { cash: '현금', credit: '외상', mixed: '혼합' }
  const { sorted: sortedSlips, criteria, toggle } = useSortable(slips)

  return (
    <div>
      <PageHeader title="거래 입력" description="매출·매입 전표 관리" />

      {/* 탭 */}
      <div className="flex gap-1 mb-5 border-b border-gray-200">
        {([['sale', '매출'], ['purchase', '매입']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-900'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* 필터 바 */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <select value={bizFilter} onChange={e => setBizFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">전체 사업자</option>
          {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <span className="text-gray-400 text-sm">~</span>
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <div className="ml-auto">
          <button onClick={openNew}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
            + {tab === 'sale' ? '매출' : '매입'} 입력
          </button>
        </div>
      </div>

      {/* 합계 */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-3 mb-4 flex gap-8">
        <div><span className="text-xs text-blue-500">전표 수</span><span className="ml-2 font-bold text-blue-800">{slips.length}건</span></div>
        <div><span className="text-xs text-blue-500">합계</span><span className="ml-2 font-bold text-blue-800">{formatMoney(totalSales)}원</span></div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">불러오는 중...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs">
              <tr>
                <SortableHeader field="slip_date"     criteria={criteria} onSort={toggle}>날짜</SortableHeader>
                <SortableHeader field="partner_name"  criteria={criteria} onSort={toggle}>거래처</SortableHeader>
                <SortableHeader field="warehouse_name" criteria={criteria} onSort={toggle}>창고</SortableHeader>
                <SortableHeader field="payment_type"  criteria={criteria} onSort={toggle}>결제</SortableHeader>
                <SortableHeader field="supply_amount" criteria={criteria} onSort={toggle}>공급가</SortableHeader>
                <SortableHeader field="tax_amount"    criteria={criteria} onSort={toggle}>부가세</SortableHeader>
                <SortableHeader field="total_amount"  criteria={criteria} onSort={toggle}>합계</SortableHeader>
                <th className="px-4 py-3 text-left text-gray-500 font-medium">메모</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sortedSlips.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400">전표가 없습니다</td></tr>
              )}
              {sortedSlips.map(sl => (
                <tr key={sl.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setDetailSlip(sl)}>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{sl.slip_date}</td>
                  <td className="px-4 py-3 font-medium">{sl.partner_name ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{sl.warehouse_name ?? '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${sl.payment_type === 'cash' ? 'bg-green-100 text-green-700' : sl.payment_type === 'credit' ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700'}`}>
                      {PAYMENT_LABEL[sl.payment_type]}
                    </span>
                  </td>
                  <td className="px-4 py-3">{formatMoney(sl.supply_amount)}원</td>
                  <td className="px-4 py-3 text-gray-500">{formatMoney(sl.tax_amount)}원</td>
                  <td className="px-4 py-3 font-bold">{formatMoney(sl.total_amount)}원</td>
                  <td className="px-4 py-3 text-gray-400 max-w-[120px] truncate">{sl.memo ?? '-'}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => window.open(`/api/pdf/slip?id=${sl.id}`, '_blank')}
                      className="text-xs text-gray-400 hover:text-blue-600 mr-2"
                    >🖨️</button>
                    <button onClick={() => setConfirmId(sl.id)} className="text-red-500 hover:underline text-xs">삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 전표 입력 모달 */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={`${tab === 'sale' ? '매출' : '매입'} 전표 입력`} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div><label className={labelCls}>사업자 *</label>
              <select className={inputCls} value={draft.business_id} onChange={e => setDraft(p => ({ ...p, business_id: e.target.value }))}>
                <option value="">선택</option>
                {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>거래처</label>
              <select className={inputCls} value={draft.partner_id} onChange={e => setDraft(p => ({ ...p, partner_id: e.target.value }))}>
                <option value="">선택 안 함</option>
                {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>창고</label>
              <select className={inputCls} value={draft.warehouse_id} onChange={e => setDraft(p => ({ ...p, warehouse_id: e.target.value }))}>
                <option value="">선택 안 함</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div><label className={labelCls}>거래일 *</label>
              <input type="date" className={inputCls} value={draft.slip_date} onChange={e => setDraft(p => ({ ...p, slip_date: e.target.value }))} /></div>
            <div><label className={labelCls}>만기일</label>
              <input type="date" className={inputCls} value={draft.due_date} onChange={e => setDraft(p => ({ ...p, due_date: e.target.value }))} /></div>
            <div><label className={labelCls}>결제방식</label>
              <select className={inputCls} value={draft.payment_type} onChange={e => setDraft(p => ({ ...p, payment_type: e.target.value as 'cash' | 'credit' | 'mixed' }))}>
                <option value="credit">외상</option>
                <option value="cash">현금</option>
                <option value="mixed">혼합</option>
              </select>
            </div>
            {tab === 'sale' && (
              <div><label className={labelCls}>채널</label>
                <select className={inputCls} value={draft.channel_id} onChange={e => setDraft(p => ({ ...p, channel_id: e.target.value }))}>
                  <option value="">선택 안 함</option>
                  {channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={draft.is_tax_invoice} onChange={e => setDraft(p => ({ ...p, is_tax_invoice: e.target.checked }))} className="w-4 h-4 rounded" />
            세금계산서 발행
          </label>

          {/* 품목 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">품목</p>
              <button onClick={addItem} className="text-xs text-blue-600 hover:underline">+ 품목 추가</button>
            </div>
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    {['상품','수량','단가','공급가','부가세','메모',''].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {draftItems.map((item, idx) => {
                    const supply = calcSupply(item.quantity, item.unit_price)
                    const tax = draft.is_tax_invoice ? calcTax(supply, true) : 0
                    return (
                      <tr key={idx}>
                        <td className="px-2 py-1.5">
                          <select
                            className="w-36 border border-gray-200 rounded px-2 py-1 text-xs bg-white focus:outline-none"
                            value={item.product_id}
                            onChange={e => updateItem(idx, 'product_id', e.target.value)}>
                            <option value="">직접입력</option>
                            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                          {!item.product_id && (
                            <input className="w-full border border-gray-200 rounded px-2 py-1 text-xs mt-1 focus:outline-none"
                              placeholder="품목명" value={item.product_name}
                              onChange={e => updateItem(idx, 'product_name', e.target.value)} />
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" className="w-16 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none"
                            value={item.quantity} onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)} /></td>
                        <td className="px-2 py-1.5">
                          <input type="number" className="w-20 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none"
                            value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', parseInt(e.target.value) || 0)} /></td>
                        <td className="px-2 py-1.5 text-gray-700">{formatMoney(supply)}</td>
                        <td className="px-2 py-1.5 text-gray-500">{formatMoney(tax)}</td>
                        <td className="px-2 py-1.5">
                          <input className="w-20 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none"
                            placeholder="메모" value={item.note} onChange={e => updateItem(idx, 'note', e.target.value)} /></td>
                        <td className="px-2 py-1.5">
                          {draftItems.length > 1 && (
                            <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 text-base leading-none">×</button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 합계 */}
          <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-gray-500">공급가액</span><span className="font-medium">{formatMoney(totalSupply)}원</span></div>
            <div className="flex justify-between"><span className="text-gray-500">부가세</span><span>{formatMoney(totalTax)}원</span></div>
            <div className="flex justify-between font-bold text-base border-t border-gray-200 pt-2 mt-2">
              <span>합계</span><span>{formatMoney(totalAmount)}원</span>
            </div>
          </div>

          <div><label className={labelCls}>메모</label>
            <textarea className={inputCls} rows={2} value={draft.memo} onChange={e => setDraft(p => ({ ...p, memo: e.target.value }))} /></div>

          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">취소</button>
            <button onClick={save} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">저장</button>
          </div>
        </div>
      </Modal>

      {/* 전표 상세 모달 */}
      <Modal open={!!detailSlip} onClose={() => setDetailSlip(null)} title="전표 상세" size="lg">
        {detailSlip && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-gray-500">거래일</span><span className="ml-2 font-medium">{detailSlip.slip_date}</span></div>
              <div><span className="text-gray-500">거래처</span><span className="ml-2 font-medium">{detailSlip.partner_name ?? '-'}</span></div>
              <div><span className="text-gray-500">창고</span><span className="ml-2">{detailSlip.warehouse_name ?? '-'}</span></div>
              <div><span className="text-gray-500">결제</span><span className="ml-2">{PAYMENT_LABEL[detailSlip.payment_type]}</span></div>
            </div>
            <table className="w-full text-xs border border-gray-100 rounded-xl overflow-hidden">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  {['품목','수량','단가','공급가','부가세'].map(h => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {detailSlip.items.map(item => (
                  <tr key={item.id}>
                    <td className="px-3 py-2">
                      {item.product_name ? (
                        <button
                          onClick={() => setProductDetail({ id: item.product_id ?? undefined, name: item.product_name ?? undefined })}
                          className="hover:text-blue-600 hover:underline text-left"
                        >
                          {item.product_name}
                        </button>
                      ) : '-'}
                    </td>
                    <td className="px-3 py-2">{item.quantity}</td>
                    <td className="px-3 py-2">{formatMoney(item.unit_price)}원</td>
                    <td className="px-3 py-2">{formatMoney(item.supply_amount ?? 0)}원</td>
                    <td className="px-3 py-2">{formatMoney(item.tax_amount)}원</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="bg-gray-50 rounded-xl p-4 space-y-1">
              <div className="flex justify-between"><span className="text-gray-500">공급가액</span><span>{formatMoney(detailSlip.supply_amount)}원</span></div>
              <div className="flex justify-between"><span className="text-gray-500">부가세</span><span>{formatMoney(detailSlip.tax_amount)}원</span></div>
              <div className="flex justify-between font-bold border-t border-gray-200 pt-2 mt-1"><span>합계</span><span>{formatMoney(detailSlip.total_amount)}원</span></div>
            </div>
            {detailSlip.memo && <p className="text-gray-500">메모: {detailSlip.memo}</p>}
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!confirmId} message="전표를 삭제하시겠습니까? 관련 재고도 함께 반영됩니다." onConfirm={handleDelete} onCancel={() => setConfirmId(null)} />
      <ProductDetailModal
        open={!!productDetail}
        productId={productDetail?.id}
        productName={productDetail?.name}
        onClose={() => setProductDetail(null)}
      />
    </div>
  )
}
