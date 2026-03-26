'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/ui/PageHeader'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { getRegularCustomers, upsertRegularCustomer, deleteRegularCustomer, RegularCustomerRow } from '@/lib/supabase/customers'
import { getBusinesses } from '@/lib/supabase/businesses'
import { getPartners } from '@/lib/supabase/partners'
import { getChannels } from '@/lib/supabase/channels'
import { RegularCustomer, Business, Partner, Channel } from '@/lib/types'

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const labelCls = 'block text-sm font-medium text-gray-700 mb-1'

export default function CustomersPage() {
  const [customers, setCustomers] = useState<RegularCustomerRow[]>([])
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [bizFilter, setBizFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<Partial<RegularCustomer>>({})
  const [confirmId, setConfirmId] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([getBusinesses(), getPartners('customer'), getChannels()])
      .then(([b, p, c]) => { setBusinesses(b); setPartners(p); setChannels(c) })
  }, [])
  useEffect(() => { load() }, [bizFilter])

  async function load() {
    setLoading(true)
    try { setCustomers(await getRegularCustomers(bizFilter !== 'all' ? bizFilter : undefined)) }
    catch (e: unknown) { toast.error((e as Error).message) }
    finally { setLoading(false) }
  }

  async function save() {
    if (!editItem.business_id) return toast.error('사업자를 선택해주세요')
    if (!editItem.order_cycle_days || editItem.order_cycle_days <= 0) return toast.error('주문 주기를 입력해주세요')
    try {
      await upsertRegularCustomer(editItem as RegularCustomer & { business_id: string; order_cycle_days: number })
      toast.success('저장되었습니다')
      setModalOpen(false); setEditItem({})
      await load()
    } catch (e: unknown) { toast.error((e as Error).message) }
  }

  async function handleDelete() {
    if (!confirmId) return
    try { await deleteRegularCustomer(confirmId); toast.success('삭제되었습니다'); await load() }
    catch (e: unknown) { toast.error((e as Error).message) }
    finally { setConfirmId(null) }
  }

  // 주문 임박 (7일 이내) 고객
  const dueCustomers = customers.filter(c => c.days_until_next <= 7)

  return (
    <div>
      <PageHeader
        title="정기 고객"
        description={`총 ${customers.length}명 · 주문 임박 ${dueCustomers.length}명`}
        action={
          <button onClick={() => { setEditItem({ business_id: businesses[0]?.id, order_cycle_days: 7 }); setModalOpen(true) }}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">+ 고객 등록</button>
        }
      />

      {dueCustomers.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-3 mb-4 text-sm">
          <span className="font-medium text-blue-800">📅 주문 임박 고객:</span>
          <span className="text-blue-600 ml-2">{dueCustomers.map(c => c.partner_name ?? '(미지정)').join(', ')}</span>
        </div>
      )}

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
              <tr>{['거래처','채널','주문주기','최근주문일','다음주문 예정','주문품목',''].map(h => <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {customers.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">등록된 정기 고객이 없습니다</td></tr>}
              {customers.map(c => (
                <tr key={c.id} className={`hover:bg-gray-50 ${c.days_until_next <= 7 ? 'bg-blue-50/30' : ''}`}>
                  <td className="px-4 py-3 font-medium">{c.partner_name ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{c.channel_name ?? '-'}</td>
                  <td className="px-4 py-3">{c.order_cycle_days}일</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{c.last_order_date ?? '-'}</td>
                  <td className="px-4 py-3">
                    {c.last_order_date ? (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        c.days_until_next < 0 ? 'bg-red-100 text-red-700' :
                        c.days_until_next <= 3 ? 'bg-orange-100 text-orange-700' :
                        c.days_until_next <= 7 ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {c.days_until_next < 0 ? `${Math.abs(c.days_until_next)}일 초과` : `${c.days_until_next}일 후`}
                      </span>
                    ) : <span className="text-gray-400 text-xs">미확인</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {c.items.slice(0, 2).map(i => i.product_name ?? '(미지정)').join(', ')}
                    {c.items.length > 2 && ` 외 ${c.items.length - 2}개`}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => { setEditItem(c); setModalOpen(true) }} className="text-blue-600 hover:underline mr-3 text-xs">수정</button>
                    <button onClick={() => setConfirmId(c.id)} className="text-red-500 hover:underline text-xs">삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem.id ? '정기 고객 수정' : '정기 고객 등록'} size="md">
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
            <div><label className={labelCls}>주문 주기 (일)</label>
              <input type="number" className={inputCls} value={editItem.order_cycle_days ?? 7} onChange={e => setEditItem(p => ({ ...p, order_cycle_days: parseInt(e.target.value) || 7 }))} />
            </div>
            <div><label className={labelCls}>최근 주문일</label>
              <input type="date" className={inputCls} value={editItem.last_order_date ?? ''} onChange={e => setEditItem(p => ({ ...p, last_order_date: e.target.value || null }))} />
            </div>
          </div>
          <div><label className={labelCls}>채널</label>
            <select className={inputCls} value={editItem.channel_id ?? ''} onChange={e => setEditItem(p => ({ ...p, channel_id: e.target.value || null }))}>
              <option value="">선택 안 함</option>
              {channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
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

      <ConfirmDialog open={!!confirmId} message="정기 고객을 삭제하시겠습니까?" onConfirm={handleDelete} onCancel={() => setConfirmId(null)} />
    </div>
  )
}
