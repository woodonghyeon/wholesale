'use client'

import { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/ui/PageHeader'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { SortableHeader, useSortable } from '@/components/ui/SortableHeader'
import { getBusinesses } from '@/lib/supabase/businesses'
import { Business } from '@/lib/types'
import { formatDate } from '@/lib/utils/format'

const CARRIER_URLS: Record<string, string> = {
  'CJ대한통운': 'https://trace.cjlogistics.com/next/tracking.html?wblNo=',
  '우체국':     'https://service.epost.go.kr/trace.RetrieveEmsRigiTraceList.comm?sid1=',
  '롯데택배':   'https://www.lotteglogis.com/home/reservation/tracking/linkView?InvNo=',
  '한진택배':   'https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillResult.do?mCode=MN038&schLang=KR&wbl_num=',
  '로젠택배':   'https://www.ilogen.com/web/personal/trace/',
  '현대택배':   'https://hyundaitransco.com/delivery/tracking?trackingNo=',
  '경동택배':   'https://kdexp.com/newDeliverySearch.ekd?barcode=',
  '천일택배':   'https://www.chunil.co.kr/HTrace/HTrace.jsp?transNo=',
  '직접배송':   '',
  '기타':       '',
  // Naver 원본 코드가 그대로 저장된 레거시 데이터 대응
  'HYUNDAI':          'https://hyundaitransco.com/delivery/tracking?trackingNo=',
  'HYUNDAILOGIS':     'https://hyundaitransco.com/delivery/tracking?trackingNo=',
  'HDEXP':            'https://hyundaitransco.com/delivery/tracking?trackingNo=',
  'CJGLS':            'https://trace.cjlogistics.com/next/tracking.html?wblNo=',
  'HANJIN':           'https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillResult.do?mCode=MN038&schLang=KR&wbl_num=',
  'LOTTE':            'https://www.lotteglogis.com/home/reservation/tracking/linkView?InvNo=',
  'LTCGIS':           'https://www.lotteglogis.com/home/reservation/tracking/linkView?InvNo=',
}

// 화면에 표시할 이름 (Naver 코드 → 한국어)
const CARRIER_DISPLAY: Record<string, string> = {
  HYUNDAI:      '현대택배', HYUNDAILOGIS: '현대택배', HDEXP:  '현대택배',
  CJGLS:        'CJ대한통운', CJLGST: 'CJ대한통운',
  HANJIN:       '한진택배',
  LOTTE:        '롯데택배',  LTCGIS: '롯데택배',
  EPOST:        '우체국',
  LOGEN:        '로젠택배',
  KDEXP:        '경동택배',
  CHUNIL:       '천일택배',
  DONGBU:       '한덱스',
}

const CARRIERS = Object.keys(CARRIER_URLS)

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending: { label: '출고 대기', color: 'bg-gray-100 text-gray-600' },
  shipped: { label: '배송 중', color: 'bg-blue-100 text-blue-700' },
  delivered: { label: '배송 완료', color: 'bg-green-100 text-green-700' },
}

interface ShippingLabel {
  id: string
  business_id: string | null
  naver_order_id: string | null
  carrier: string
  tracking_no: string
  recipient_name: string | null
  recipient_phone: string | null
  recipient_addr: string | null
  product_name: string | null
  qty: number | null
  status: string
  shipped_at: string | null
  delivered_at: string | null
  note: string | null
  created_at: string
}

const emptyForm = () => ({
  business_id: '',
  naver_order_id: '',
  carrier: 'CJ대한통운',
  tracking_no: '',
  recipient_name: '',
  recipient_phone: '',
  recipient_addr: '',
  product_name: '',
  qty: 1,
  status: 'pending',
  shipped_at: new Date().toISOString().slice(0, 10),
  note: '',
})

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const labelCls = 'block text-sm font-medium text-gray-700 mb-1'

export default function ShippingPage() {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [labels, setLabels] = useState<ShippingLabel[]>([])
  const [loading, setLoading] = useState(true)
  const [bizFilter, setBizFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10) })
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [syncLoading, setSyncLoading] = useState(false)

  useEffect(() => { getBusinesses().then(setBusinesses) }, [])
  useEffect(() => { load() }, [bizFilter, statusFilter, from, to])

  async function load() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ from, to })
      if (bizFilter !== 'all') params.set('businessId', bizFilter)
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetch(`/api/shipping?${params}`)
      const data = await res.json()
      setLabels(data.data ?? [])
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setLoading(false) }
  }

  const filtered = useMemo(() => {
    if (!search) return labels
    const q = search.toLowerCase()
    return labels.filter(l =>
      l.tracking_no.toLowerCase().includes(q) ||
      l.recipient_name?.toLowerCase().includes(q) ||
      l.product_name?.toLowerCase().includes(q) ||
      l.carrier.toLowerCase().includes(q) ||
      (CARRIER_DISPLAY[l.carrier] ?? '').toLowerCase().includes(q)
    )
  }, [labels, search])

  const { sorted: sortedLabels, criteria, toggle } = useSortable(filtered)

  function openNew() {
    setEditId(null)
    setForm({ ...emptyForm(), business_id: businesses[0]?.id ?? '' })
    setModalOpen(true)
  }

  function openEdit(l: ShippingLabel) {
    setEditId(l.id)
    setForm({
      business_id: l.business_id ?? '',
      naver_order_id: l.naver_order_id ?? '',
      carrier: l.carrier,
      tracking_no: l.tracking_no,
      recipient_name: l.recipient_name ?? '',
      recipient_phone: l.recipient_phone ?? '',
      recipient_addr: l.recipient_addr ?? '',
      product_name: l.product_name ?? '',
      qty: l.qty ?? 1,
      status: l.status,
      shipped_at: l.shipped_at ?? new Date().toISOString().slice(0, 10),
      note: l.note ?? '',
    })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.tracking_no.trim()) return toast.error('송장번호를 입력해주세요')
    if (!form.carrier) return toast.error('택배사를 선택해주세요')
    try {
      const payload = {
        ...form,
        business_id: form.business_id || null,
        naver_order_id: form.naver_order_id || null,
        qty: form.qty || null,
        note: form.note || null,
      }
      if (editId) {
        await fetch('/api/shipping', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editId, ...payload }) })
      } else {
        await fetch('/api/shipping', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      }
      toast.success(editId ? '수정되었습니다' : '등록되었습니다')
      setModalOpen(false)
      load()
    } catch (e: unknown) { toast.error((e as Error).message) }
  }

  async function handleNaverSync() {
    const businessId = bizFilter !== 'all' ? bizFilter : businesses[0]?.id
    if (!businessId) return toast.error('사업자를 선택해주세요')
    setSyncLoading(true)
    try {
      const res = await fetch('/api/naver/sync/shipping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 30, business_id: businessId }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error ?? '동기화 실패')
      const msg = data.synced > 0 || data.updated > 0
        ? `신규 ${data.synced}건 등록, 상태 ${data.updated}건 업데이트`
        : data.message ?? '새로 동기화할 송장이 없습니다'
      toast.success(msg)
      if (data.synced > 0 || data.updated > 0) load()
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally {
      setSyncLoading(false)
    }
  }

  async function handleDelete() {
    if (!confirmId) return
    await fetch(`/api/shipping?id=${confirmId}`, { method: 'DELETE' })
    toast.success('삭제되었습니다')
    setConfirmId(null)
    load()
  }

  async function quickStatus(id: string, status: string) {
    await fetch('/api/shipping', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) })
    setLabels(prev => prev.map(l => l.id === id ? { ...l, status } : l))
  }

  function trackingUrl(carrier: string, trackingNo: string) {
    const base = CARRIER_URLS[carrier]
    return base ? base + trackingNo : null
  }

  const shipped = labels.filter(l => l.status === 'shipped').length
  const delivered = labels.filter(l => l.status === 'delivered').length
  const pending = labels.filter(l => l.status === 'pending').length

  return (
    <div>
      <PageHeader
        title="송장 관리"
        description="택배 송장번호 등록 및 배송 현황 관리"
        action={
          <div className="flex gap-2">
            <button
              onClick={handleNaverSync}
              disabled={syncLoading}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <span className="w-4 h-4 bg-white/30 rounded text-xs font-bold flex items-center justify-center">N</span>
              {syncLoading ? '동기화 중...' : '네이버 송장 가져오기'}
            </button>
            <button onClick={openNew} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
              + 직접 등록
            </button>
          </div>
        }
      />

      {/* 요약 카드 */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        {[
          { label: '전체', value: labels.length, color: 'text-gray-900' },
          { label: '출고 대기', value: pending, color: 'text-gray-600' },
          { label: '배송 중', value: shipped, color: 'text-blue-600' },
          { label: '배송 완료', value: delivered, color: 'text-green-600' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500 mb-1">{c.label}</p>
            <p className={`text-2xl font-bold ${c.color}`}>{c.value}<span className="text-sm font-normal text-gray-400 ml-1">건</span></p>
          </div>
        ))}
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <input placeholder="송장번호·수령인·상품명 검색" value={search} onChange={e => setSearch(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-52" />
        <select value={bizFilter} onChange={e => setBizFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">전체 사업자</option>
          {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">전체 상태</option>
          {Object.entries(STATUS_LABEL).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
        </select>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none" />
        <span className="text-gray-400 text-sm">~</span>
        <input type="date" value={to} onChange={e => setTo(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none" />
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">불러오는 중...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs">
              <tr>
                <SortableHeader field="shipped_at" criteria={criteria} onSort={toggle}>출고일</SortableHeader>
                <SortableHeader field="carrier"    criteria={criteria} onSort={toggle}>택배사</SortableHeader>
                <SortableHeader field="tracking_no" criteria={criteria} onSort={toggle}>송장번호</SortableHeader>
                <SortableHeader field="recipient_name" criteria={criteria} onSort={toggle}>수령인</SortableHeader>
                <SortableHeader field="product_name" criteria={criteria} onSort={toggle}>상품</SortableHeader>
                <SortableHeader field="status" criteria={criteria} onSort={toggle}>상태</SortableHeader>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sortedLabels.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">송장이 없습니다</td></tr>
              )}
              {sortedLabels.map(l => {
                const displayCarrier = CARRIER_DISPLAY[l.carrier] ?? l.carrier
                const tUrl = trackingUrl(displayCarrier, l.tracking_no) || trackingUrl(l.carrier, l.tracking_no)
                return (
                  <tr key={l.id} className="hover:bg-gray-50 group">
                    <td className="px-4 py-3 text-gray-500 text-xs font-mono">{l.shipped_at ?? '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{displayCarrier}</td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {tUrl ? (
                        <a href={tUrl} target="_blank" rel="noreferrer"
                          className="text-blue-600 hover:underline font-medium">{l.tracking_no}</a>
                      ) : (
                        <span className="text-gray-700 font-medium">{l.tracking_no}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{l.recipient_name ?? '-'}</p>
                      {l.recipient_phone && <p className="text-xs text-gray-400">{l.recipient_phone}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-[160px]">
                      <p className="truncate">{l.product_name ?? '-'}</p>
                      {l.qty && <p className="text-xs text-gray-400">{l.qty}개</p>}
                    </td>
                    <td className="px-4 py-3">
                      <select value={l.status} onChange={e => quickStatus(l.id, e.target.value)}
                        className={`text-xs px-2 py-1 rounded-full border-0 font-medium cursor-pointer ${STATUS_LABEL[l.status]?.color ?? 'bg-gray-100 text-gray-600'}`}>
                        {Object.entries(STATUS_LABEL).map(([v, { label }]) => (
                          <option key={v} value={v}>{label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      <button onClick={() => openEdit(l)} className="text-blue-600 hover:underline text-xs mr-2">수정</button>
                      <button onClick={() => setConfirmId(l.id)} className="text-red-500 hover:underline text-xs">삭제</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 등록/수정 모달 */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? '송장 수정' : '송장 등록'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>택배사 *</label>
              <select className={inputCls} value={form.carrier} onChange={e => setForm(f => ({ ...f, carrier: e.target.value }))}>
                {CARRIERS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>송장번호 *</label>
              <input className={inputCls} value={form.tracking_no} onChange={e => setForm(f => ({ ...f, tracking_no: e.target.value }))} placeholder="1234567890123" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>수령인</label>
              <input className={inputCls} value={form.recipient_name} onChange={e => setForm(f => ({ ...f, recipient_name: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>연락처</label>
              <input className={inputCls} value={form.recipient_phone} onChange={e => setForm(f => ({ ...f, recipient_phone: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>출고일</label>
              <input type="date" className={inputCls} value={form.shipped_at} onChange={e => setForm(f => ({ ...f, shipped_at: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className={labelCls}>배송지 주소</label>
            <input className={inputCls} value={form.recipient_addr} onChange={e => setForm(f => ({ ...f, recipient_addr: e.target.value }))} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className={labelCls}>상품명</label>
              <input className={inputCls} value={form.product_name} onChange={e => setForm(f => ({ ...f, product_name: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>수량</label>
              <input type="number" min="1" className={inputCls} value={form.qty} onChange={e => setForm(f => ({ ...f, qty: parseInt(e.target.value) || 1 }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>네이버 주문번호 (선택)</label>
              <input className={inputCls} value={form.naver_order_id} onChange={e => setForm(f => ({ ...f, naver_order_id: e.target.value }))} placeholder="연동 시 자동 입력" />
            </div>
            <div>
              <label className={labelCls}>사업자</label>
              <select className={inputCls} value={form.business_id} onChange={e => setForm(f => ({ ...f, business_id: e.target.value }))}>
                <option value="">선택 안 함</option>
                {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>메모</label>
            <input className={inputCls} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">취소</button>
            <button onClick={handleSave} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">저장</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!confirmId} message="송장을 삭제하시겠습니까?" onConfirm={handleDelete} onCancel={() => setConfirmId(null)} />
    </div>
  )
}
