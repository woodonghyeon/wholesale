'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/ui/PageHeader'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { getCashBook, upsertCashBook, deleteCashBook } from '@/lib/supabase/cashbook'
import { getBusinesses } from '@/lib/supabase/businesses'
import { CashBook, Business } from '@/lib/types'
import { formatMoney } from '@/lib/utils/format'

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const labelCls = 'block text-sm font-medium text-gray-700 mb-1'

const CATEGORIES = ['판매대금','매입대금','운송비','포장비','인건비','임차료','공과금','기타']

export default function CashPage() {
  const [entries, setEntries] = useState<CashBook[]>([])
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [loading, setLoading] = useState(true)
  const [bizFilter, setBizFilter] = useState('all')
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10)
  })
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<Partial<CashBook>>({})
  const [confirmId, setConfirmId] = useState<string | null>(null)

  useEffect(() => { getBusinesses().then(setBusinesses) }, [])
  useEffect(() => { load() }, [bizFilter, fromDate, toDate])

  async function load() {
    setLoading(true)
    try {
      setEntries(await getCashBook(bizFilter !== 'all' ? bizFilter : undefined, fromDate, toDate))
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setLoading(false) }
  }

  function openNew(type: 'in' | 'out') {
    setEditItem({
      cash_type: type,
      cash_date: new Date().toISOString().slice(0, 10),
      business_id: businesses[0]?.id ?? '',
      amount: 0,
    })
    setModalOpen(true)
  }

  async function save() {
    if (!editItem.business_id) return toast.error('사업자를 선택해주세요')
    if (!editItem.amount || editItem.amount <= 0) return toast.error('금액을 입력해주세요')
    try {
      await upsertCashBook(editItem as CashBook & { business_id: string; cash_type: 'in' | 'out'; amount: number; cash_date: string })
      toast.success('저장되었습니다')
      setModalOpen(false); setEditItem({})
      await load()
    } catch (e: unknown) { toast.error((e as Error).message) }
  }

  async function handleDelete() {
    if (!confirmId) return
    try {
      await deleteCashBook(confirmId)
      toast.success('삭제되었습니다')
      await load()
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setConfirmId(null) }
  }

  const totalIn = entries.filter(e => e.cash_type === 'in').reduce((s, e) => s + e.amount, 0)
  const totalOut = entries.filter(e => e.cash_type === 'out').reduce((s, e) => s + e.amount, 0)
  const balance = totalIn - totalOut

  // 날짜별 잔액 누계
  const withBalance = [...entries].reverse().reduce<(CashBook & { balance: number })[]>((acc, e) => {
    const prev = acc[acc.length - 1]?.balance ?? 0
    const b = e.cash_type === 'in' ? prev + e.amount : prev - e.amount
    return [...acc, { ...e, balance: b }]
  }, []).reverse()

  return (
    <div>
      <PageHeader
        title="현금 출납"
        action={
          <div className="flex gap-2">
            <button onClick={() => openNew('in')} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">+ 입금</button>
            <button onClick={() => openNew('out')} className="px-4 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600">+ 출금</button>
          </div>
        }
      />

      {/* 필터 */}
      <div className="flex flex-wrap gap-2 mb-5">
        <select value={bizFilter} onChange={e => setBizFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">전체 사업자</option>
          {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <span className="text-gray-400 self-center text-sm">~</span>
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
          <p className="text-xs text-blue-500 mb-1">총 입금</p>
          <p className="text-2xl font-bold text-blue-700">{formatMoney(totalIn)}<span className="text-sm font-normal ml-1">원</span></p>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
          <p className="text-xs text-red-500 mb-1">총 출금</p>
          <p className="text-2xl font-bold text-red-600">{formatMoney(totalOut)}<span className="text-sm font-normal ml-1">원</span></p>
        </div>
        <div className={`${balance >= 0 ? 'bg-green-50 border-green-100' : 'bg-orange-50 border-orange-100'} border rounded-2xl p-4`}>
          <p className="text-xs text-gray-500 mb-1">잔액</p>
          <p className={`text-2xl font-bold ${balance >= 0 ? 'text-green-700' : 'text-orange-600'}`}>{formatMoney(balance)}<span className="text-sm font-normal ml-1">원</span></p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">불러오는 중...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>
                {['날짜','구분','카테고리','내용','금액','잔액',''].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {withBalance.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">내역이 없습니다</td></tr>
              )}
              {withBalance.map(e => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{e.cash_date}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${e.cash_type === 'in' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-600'}`}>
                      {e.cash_type === 'in' ? '입금' : '출금'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{e.category ?? '-'}</td>
                  <td className="px-4 py-3">{e.description ?? '-'}</td>
                  <td className={`px-4 py-3 font-bold ${e.cash_type === 'in' ? 'text-blue-600' : 'text-red-500'}`}>
                    {e.cash_type === 'in' ? '+' : '-'}{formatMoney(e.amount)}원
                  </td>
                  <td className={`px-4 py-3 font-medium ${e.balance >= 0 ? 'text-gray-800' : 'text-orange-600'}`}>{formatMoney(e.balance)}원</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => { setEditItem(e); setModalOpen(true) }} className="text-blue-600 hover:underline mr-3 text-xs">수정</button>
                    <button onClick={() => setConfirmId(e.id)} className="text-red-500 hover:underline text-xs">삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem.id ? '출납 수정' : (editItem.cash_type === 'in' ? '입금 등록' : '출금 등록')} size="sm">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>사업자 *</label>
              <select className={inputCls} value={editItem.business_id ?? ''} onChange={e => setEditItem(p => ({ ...p, business_id: e.target.value }))}>
                {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>날짜</label>
              <input type="date" className={inputCls} value={editItem.cash_date ?? ''} onChange={e => setEditItem(p => ({ ...p, cash_date: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className={labelCls}>구분</label>
            <div className="flex gap-2">
              {(['in', 'out'] as const).map(t => (
                <button key={t} onClick={() => setEditItem(p => ({ ...p, cash_type: t }))}
                  className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${editItem.cash_type === t ? (t === 'in' ? 'bg-blue-600 text-white border-blue-600' : 'bg-red-500 text-white border-red-500') : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {t === 'in' ? '입금' : '출금'}
                </button>
              ))}
            </div>
          </div>
          <div><label className={labelCls}>금액 *</label>
            <input type="number" className={inputCls} value={editItem.amount ?? 0} onChange={e => setEditItem(p => ({ ...p, amount: parseInt(e.target.value) || 0 }))} />
          </div>
          <div><label className={labelCls}>카테고리</label>
            <select className={inputCls} value={editItem.category ?? ''} onChange={e => setEditItem(p => ({ ...p, category: e.target.value || null }))}>
              <option value="">선택 안 함</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div><label className={labelCls}>내용</label>
            <input className={inputCls} value={editItem.description ?? ''} onChange={e => setEditItem(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">취소</button>
            <button onClick={save} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">저장</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!confirmId} message="이 출납 내역을 삭제하시겠습니까?" onConfirm={handleDelete} onCancel={() => setConfirmId(null)} />
    </div>
  )
}
