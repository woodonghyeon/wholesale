'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/ui/PageHeader'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { getBusinesses } from '@/lib/supabase/businesses'
import { getPartners } from '@/lib/supabase/partners'
import { getBalanceSummary, getPayments, upsertPayment, deletePayment, BalanceSummary, PaymentRow } from '@/lib/supabase/payments'
import { Business, Partner, PaymentMethod } from '@/lib/types'
import { formatMoney, formatDate } from '@/lib/utils/format'

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const labelCls = 'block text-sm font-medium text-gray-700 mb-1'

const METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: '현금',
  transfer: '계좌이체',
  card: '카드',
  note: '어음',
}

export default function ReceivablesPage() {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [bizFilter, setBizFilter] = useState('all')
  const [tab, setTab] = useState<'receivable' | 'payable'>('receivable')
  const [summary, setSummary] = useState<BalanceSummary[]>([])
  const [selectedPartner, setSelectedPartner] = useState<BalanceSummary | null>(null)
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [payLoading, setPayLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<Partial<PaymentRow>>({})
  const [confirmId, setConfirmId] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([getBusinesses(), getPartners()]).then(([b, p]) => {
      setBusinesses(b)
      setPartners(p)
    })
  }, [])

  useEffect(() => { loadSummary() }, [bizFilter])

  useEffect(() => {
    if (selectedPartner) loadPayments(selectedPartner.partner_id)
  }, [selectedPartner])

  async function loadSummary() {
    setLoading(true)
    try {
      const biz = bizFilter !== 'all' ? bizFilter : undefined
      const data = await getBalanceSummary(biz)
      setSummary(data)
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setLoading(false) }
  }

  async function loadPayments(partnerId: string) {
    setPayLoading(true)
    try {
      const biz = bizFilter !== 'all' ? bizFilter : undefined
      const data = await getPayments({ businessId: biz, partnerId })
      setPayments(data)
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setPayLoading(false) }
  }

  async function save() {
    if (!editItem.business_id || !editItem.partner_id) return toast.error('사업자와 거래처를 선택해주세요')
    try {
      await upsertPayment(editItem)
      toast.success('저장되었습니다')
      setModalOpen(false)
      setEditItem({})
      await loadSummary()
      if (selectedPartner) await loadPayments(selectedPartner.partner_id)
    } catch (e: unknown) { toast.error((e as Error).message) }
  }

  async function handleDelete() {
    if (!confirmId) return
    try {
      await deletePayment(confirmId)
      toast.success('삭제되었습니다')
      await loadSummary()
      if (selectedPartner) await loadPayments(selectedPartner.partner_id)
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setConfirmId(null) }
  }

  function openNewPayment(type: 'receive' | 'pay', partnerId?: string) {
    setEditItem({
      payment_type: type,
      payment_method: 'transfer',
      amount: 0,
      payment_date: new Date().toISOString().slice(0, 10),
      business_id: businesses[0]?.id,
      partner_id: partnerId,
    })
    setModalOpen(true)
  }

  const filtered = summary.filter(s =>
    tab === 'receivable' ? s.receivable > 0 : s.payable > 0
  )

  const totalReceivable = summary.reduce((s, r) => s + Math.max(0, r.receivable), 0)
  const totalPayable = summary.reduce((s, r) => s + Math.max(0, r.payable), 0)

  return (
    <div>
      <PageHeader
        title="미수금 · 미지급금"
        description={`미수금 ${formatMoney(totalReceivable)}원 · 미지급금 ${formatMoney(totalPayable)}원`}
        action={
          <button
            onClick={() => openNewPayment(tab === 'receivable' ? 'receive' : 'pay')}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            + {tab === 'receivable' ? '수금' : '지급'} 등록
          </button>
        }
      />

      <div className="flex gap-2 mb-5">
        <select value={bizFilter} onChange={e => setBizFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">전체 사업자</option>
          {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {(['receivable', 'payable'] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setSelectedPartner(null) }}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${tab === t ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
              {t === 'receivable' ? '미수금' : '미지급금'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-5 gap-5">
        {/* 거래처 목록 */}
        <div className="col-span-2 bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50 text-sm font-semibold text-gray-700">
            {tab === 'receivable' ? '미수금 거래처' : '미지급금 거래처'}
          </div>
          {loading ? (
            <div className="py-12 text-center text-sm text-gray-400">불러오는 중...</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">잔액이 없습니다</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map(s => (
                <button
                  key={s.partner_id}
                  onClick={() => setSelectedPartner(s)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-sm text-left transition-colors ${
                    selectedPartner?.partner_id === s.partner_id ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <span className="font-medium text-gray-800">{s.partner_name}</span>
                  <span className={`font-bold ${tab === 'receivable' ? 'text-blue-600' : 'text-orange-500'}`}>
                    {formatMoney(tab === 'receivable' ? s.receivable : s.payable)}원
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 수금/지급 이력 */}
        <div className="col-span-3 bg-white rounded-xl border border-gray-100 overflow-hidden">
          {selectedPartner ? (
            <>
              <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{selectedPartner.partner_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    미수금 <span className="text-blue-600 font-medium">{formatMoney(selectedPartner.receivable)}원</span>
                    {' · '}
                    미지급금 <span className="text-orange-500 font-medium">{formatMoney(selectedPartner.payable)}원</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openNewPayment('receive', selectedPartner.partner_id)}
                    className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >수금</button>
                  <button
                    onClick={() => openNewPayment('pay', selectedPartner.partner_id)}
                    className="px-3 py-1.5 text-xs bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                  >지급</button>
                </div>
              </div>
              {payLoading ? (
                <div className="py-12 text-center text-sm text-gray-400">불러오는 중...</div>
              ) : payments.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-400">수금·지급 이력이 없습니다</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs">
                    <tr>
                      {['날짜', '구분', '방법', '금액', '메모', ''].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {payments.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{p.payment_date}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${p.payment_type === 'receive' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                            {p.payment_type === 'receive' ? '수금' : '지급'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">{METHOD_LABEL[p.payment_method]}</td>
                        <td className="px-4 py-2.5 font-bold text-gray-800">{formatMoney(p.amount)}원</td>
                        <td className="px-4 py-2.5 text-gray-500 max-w-[120px] truncate">{p.note ?? '-'}</td>
                        <td className="px-4 py-2.5">
                          <button onClick={() => setConfirmId(p.id)} className="text-xs text-red-400 hover:text-red-600">삭제</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          ) : (
            <div className="py-20 text-center text-sm text-gray-400">왼쪽에서 거래처를 선택하세요</div>
          )}
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="수금·지급 등록" size="sm">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>사업자 *</label>
              <select className={inputCls} value={editItem.business_id ?? ''}
                onChange={e => setEditItem(p => ({ ...p, business_id: e.target.value }))}>
                <option value="">선택</option>
                {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>거래처 *</label>
              <select className={inputCls} value={editItem.partner_id ?? ''}
                onChange={e => setEditItem(p => ({ ...p, partner_id: e.target.value }))}>
                <option value="">선택</option>
                {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>구분</label>
              <select className={inputCls} value={editItem.payment_type ?? 'receive'}
                onChange={e => setEditItem(p => ({ ...p, payment_type: e.target.value as any }))}>
                <option value="receive">수금</option>
                <option value="pay">지급</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>방법</label>
              <select className={inputCls} value={editItem.payment_method ?? 'transfer'}
                onChange={e => setEditItem(p => ({ ...p, payment_method: e.target.value as PaymentMethod }))}>
                {Object.entries(METHOD_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>날짜</label>
              <input type="date" className={inputCls} value={editItem.payment_date ?? ''}
                onChange={e => setEditItem(p => ({ ...p, payment_date: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>금액</label>
              <input type="number" className={inputCls} value={editItem.amount ?? 0}
                onChange={e => setEditItem(p => ({ ...p, amount: parseInt(e.target.value) || 0 }))} />
            </div>
          </div>
          <div>
            <label className={labelCls}>메모</label>
            <input className={inputCls} value={editItem.note ?? ''}
              onChange={e => setEditItem(p => ({ ...p, note: e.target.value }))} />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">취소</button>
            <button onClick={save} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">저장</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!confirmId} message="삭제하시겠습니까?" onConfirm={handleDelete} onCancel={() => setConfirmId(null)} />
    </div>
  )
}
