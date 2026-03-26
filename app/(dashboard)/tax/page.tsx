'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/ui/PageHeader'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { createClient } from '@/lib/supabase/client'
import { getBusinesses } from '@/lib/supabase/businesses'
import { getPartners } from '@/lib/supabase/partners'
import { TaxInvoice, Business, Partner, InvoiceType, InvoiceStatus } from '@/lib/types'
import { formatMoney } from '@/lib/utils/format'

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const labelCls = 'block text-sm font-medium text-gray-700 mb-1'

const TYPE_LABEL: Record<InvoiceType, string> = { issue: '발행', receive: '수취', amendment: '수정' }
const STATUS: Record<InvoiceStatus, { label: string; color: string }> = {
  draft: { label: '초안', color: 'bg-gray-100 text-gray-600' },
  issued: { label: '발행완료', color: 'bg-green-100 text-green-700' },
  cancelled: { label: '취소', color: 'bg-red-100 text-red-600' },
}

interface TaxInvoiceRow extends TaxInvoice { partner_name?: string }

export default function TaxPage() {
  const [invoices, setInvoices] = useState<TaxInvoiceRow[]>([])
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [bizFilter, setBizFilter] = useState('all')
  const [fromDate, setFromDate] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10) })
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<Partial<TaxInvoice>>({})
  const [confirmId, setConfirmId] = useState<string | null>(null)

  useEffect(() => { Promise.all([getBusinesses(), getPartners()]).then(([b, p]) => { setBusinesses(b); setPartners(p) }) }, [])
  useEffect(() => { load() }, [bizFilter, fromDate, toDate])

  async function load() {
    setLoading(true)
    const supabase = createClient()
    try {
      let q = supabase.from('tax_invoices').select('*, partners(name)').order('issue_date', { ascending: false })
        .gte('issue_date', fromDate).lte('issue_date', toDate)
      if (bizFilter !== 'all') q = q.eq('business_id', bizFilter)
      const { data, error } = await q
      if (error) throw new Error(error.message)
      setInvoices((data ?? []).map((r: any) => ({ ...r, partner_name: r.partners?.name ?? null })))
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setLoading(false) }
  }

  async function save() {
    if (!editItem.business_id) return toast.error('사업자를 선택해주세요')
    const supabase = createClient()
    try {
      const supply = editItem.supply_amount ?? 0
      const tax = editItem.tax_amount ?? Math.round(supply / 10)
      const payload = { ...editItem, tax_amount: tax, total_amount: supply + tax, hometax_synced: false }
      const { error } = await supabase.from('tax_invoices').upsert(payload)
      if (error) throw new Error(error.message)
      toast.success('저장되었습니다'); setModalOpen(false); setEditItem({}); await load()
    } catch (e: unknown) { toast.error((e as Error).message) }
  }

  async function handleDelete() {
    if (!confirmId) return
    const supabase = createClient()
    try {
      const { error } = await supabase.from('tax_invoices').delete().eq('id', confirmId)
      if (error) throw new Error(error.message)
      toast.success('삭제되었습니다'); await load()
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setConfirmId(null) }
  }

  const totalSupply = invoices.reduce((s, r) => s + r.supply_amount, 0)
  const totalTax = invoices.reduce((s, r) => s + r.tax_amount, 0)

  return (
    <div>
      <PageHeader title="세금계산서" description={`공급가 ${formatMoney(totalSupply)}원 · 부가세 ${formatMoney(totalTax)}원`}
        action={<button onClick={() => { setEditItem({ invoice_type: 'issue', status: 'draft', supply_amount: 0, tax_amount: 0, total_amount: 0, issue_date: new Date().toISOString().slice(0, 10), hometax_synced: false, business_id: businesses[0]?.id }); setModalOpen(true) }}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">+ 세금계산서 등록</button>} />

      <div className="flex flex-wrap gap-2 mb-4">
        <select value={bizFilter} onChange={e => setBizFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">전체 사업자</option>
          {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <span className="text-gray-400 self-center text-sm">~</span>
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? <div className="py-16 text-center text-sm text-gray-400">불러오는 중...</div> : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>{['발행일','구분','거래처','계산서번호','공급가','부가세','합계','상태','홈택스'].map(h => <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {invoices.length === 0 && <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400">세금계산서가 없습니다</td></tr>}
              {invoices.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{r.issue_date}</td>
                  <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{TYPE_LABEL[r.invoice_type]}</span></td>
                  <td className="px-4 py-3">{r.partner_name ?? '-'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{r.invoice_no ?? '-'}</td>
                  <td className="px-4 py-3">{formatMoney(r.supply_amount)}원</td>
                  <td className="px-4 py-3">{formatMoney(r.tax_amount)}원</td>
                  <td className="px-4 py-3 font-bold">{formatMoney(r.total_amount)}원</td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${STATUS[r.status].color}`}>{STATUS[r.status].label}</span></td>
                  <td className="px-4 py-3">{r.hometax_synced ? <span className="text-xs text-green-600">✓ 연동</span> : <span className="text-xs text-gray-400">미연동</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="세금계산서 등록" size="md">
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
          <div className="grid grid-cols-3 gap-3">
            <div><label className={labelCls}>구분</label>
              <select className={inputCls} value={editItem.invoice_type ?? 'issue'} onChange={e => setEditItem(p => ({ ...p, invoice_type: e.target.value as InvoiceType }))}>
                {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>발행일</label>
              <input type="date" className={inputCls} value={editItem.issue_date ?? ''} onChange={e => setEditItem(p => ({ ...p, issue_date: e.target.value }))} />
            </div>
            <div><label className={labelCls}>계산서 번호</label>
              <input className={inputCls} value={editItem.invoice_no ?? ''} onChange={e => setEditItem(p => ({ ...p, invoice_no: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>공급가액</label>
              <input type="number" className={inputCls} value={editItem.supply_amount ?? 0}
                onChange={e => { const v = parseInt(e.target.value) || 0; setEditItem(p => ({ ...p, supply_amount: v, tax_amount: Math.round(v / 10) })) }} />
            </div>
            <div><label className={labelCls}>부가세 (자동계산)</label>
              <input type="number" className={inputCls} value={editItem.tax_amount ?? 0} onChange={e => setEditItem(p => ({ ...p, tax_amount: parseInt(e.target.value) || 0 }))} />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">취소</button>
            <button onClick={save} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">저장</button>
          </div>
        </div>
      </Modal>
      <ConfirmDialog open={!!confirmId} message="세금계산서를 삭제하시겠습니까?" onConfirm={handleDelete} onCancel={() => setConfirmId(null)} />
    </div>
  )
}
