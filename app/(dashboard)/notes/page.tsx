'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/ui/PageHeader'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { getBusinesses } from '@/lib/supabase/businesses'
import { getPartners } from '@/lib/supabase/partners'
import { getNotes, upsertNote, updateNoteStatus, deleteNote, NoteRow } from '@/lib/supabase/notes'
import { Business, Partner, NoteType, NoteStatus } from '@/lib/types'
import { formatMoney } from '@/lib/utils/format'

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const labelCls = 'block text-sm font-medium text-gray-700 mb-1'

const TYPE_LABEL: Record<NoteType, string> = { receivable: '받을어음', payable: '지급어음' }
const STATUS: Record<NoteStatus, { label: string; color: string }> = {
  pending: { label: '대기', color: 'bg-yellow-100 text-yellow-700' },
  cleared: { label: '결제완료', color: 'bg-green-100 text-green-700' },
  bounced: { label: '부도', color: 'bg-red-100 text-red-700' },
}

function getDday(dueDate: string): { text: string; color: string } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000)
  if (diff < 0) return { text: `D+${Math.abs(diff)}`, color: 'text-red-500 font-bold' }
  if (diff === 0) return { text: 'D-Day', color: 'text-red-500 font-bold' }
  if (diff <= 7) return { text: `D-${diff}`, color: 'text-orange-500 font-semibold' }
  return { text: `D-${diff}`, color: 'text-gray-500' }
}

export default function NotesPage() {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [notes, setNotes] = useState<NoteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [bizFilter, setBizFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState<NoteType | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<NoteStatus | 'all'>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<Partial<NoteRow>>({})
  const [confirmId, setConfirmId] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([getBusinesses(), getPartners()]).then(([b, p]) => {
      setBusinesses(b)
      setPartners(p)
    })
  }, [])

  useEffect(() => { load() }, [bizFilter, typeFilter])

  async function load() {
    setLoading(true)
    try {
      const biz = bizFilter !== 'all' ? bizFilter : undefined
      const type = typeFilter !== 'all' ? typeFilter : undefined
      const data = await getNotes(biz, type)
      setNotes(data)
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setLoading(false) }
  }

  async function save() {
    if (!editItem.business_id || !editItem.partner_id) return toast.error('사업자와 거래처를 선택해주세요')
    if (!editItem.due_date) return toast.error('만기일을 입력해주세요')
    try {
      await upsertNote(editItem)
      toast.success('저장되었습니다')
      setModalOpen(false)
      setEditItem({})
      await load()
    } catch (e: unknown) { toast.error((e as Error).message) }
  }

  async function handleStatusChange(id: string, status: NoteStatus) {
    try {
      await updateNoteStatus(id, status)
      toast.success('상태가 변경되었습니다')
      await load()
    } catch (e: unknown) { toast.error((e as Error).message) }
  }

  async function handleDelete() {
    if (!confirmId) return
    try {
      await deleteNote(confirmId)
      toast.success('삭제되었습니다')
      await load()
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setConfirmId(null) }
  }

  const filtered = statusFilter !== 'all' ? notes.filter(n => n.status === statusFilter) : notes
  const totalReceivable = notes.filter(n => n.note_type === 'receivable' && n.status === 'pending').reduce((s, n) => s + n.amount, 0)
  const totalPayable = notes.filter(n => n.note_type === 'payable' && n.status === 'pending').reduce((s, n) => s + n.amount, 0)

  return (
    <div>
      <PageHeader
        title="어음 · 수표 관리"
        description={`받을어음 ${formatMoney(totalReceivable)}원 · 지급어음 ${formatMoney(totalPayable)}원`}
        action={
          <button
            onClick={() => {
              setEditItem({
                note_type: 'receivable',
                status: 'pending',
                amount: 0,
                issue_date: new Date().toISOString().slice(0, 10),
                due_date: '',
                business_id: businesses[0]?.id,
              })
              setModalOpen(true)
            }}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            + 어음 등록
          </button>
        }
      />

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        {(['pending', 'cleared', 'bounced'] as NoteStatus[]).map(st => {
          const count = notes.filter(n => n.status === st).length
          const amt = notes.filter(n => n.status === st).reduce((s, n) => s + n.amount, 0)
          return (
            <div key={st} className="bg-white border border-gray-100 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS[st].color}`}>{STATUS[st].label}</span>
                <span className="text-xs text-gray-400">{count}건</span>
              </div>
              <p className="text-xl font-bold text-gray-800">{formatMoney(amt)}<span className="text-sm font-normal ml-1">원</span></p>
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <select value={bizFilter} onChange={e => setBizFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">전체 사업자</option>
          {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">전체 구분</option>
          {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">전체 상태</option>
          {Object.entries(STATUS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">불러오는 중...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>
                {['구분', '거래처', '어음번호', '발행일', '만기일', 'D-Day', '은행', '금액', '상태', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-12 text-center text-gray-400">어음이 없습니다</td></tr>
              )}
              {filtered.map(n => {
                const dday = getDday(n.due_date)
                return (
                  <tr key={n.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${n.note_type === 'receivable' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                        {TYPE_LABEL[n.note_type]}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">{n.partner_name ?? '-'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{n.note_no ?? '-'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{n.issue_date}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{n.due_date}</td>
                    <td className={`px-4 py-3 text-xs ${n.status === 'pending' ? dday.color : 'text-gray-400'}`}>
                      {n.status === 'pending' ? dday.text : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{n.bank_name ?? '-'}</td>
                    <td className="px-4 py-3 font-bold">{formatMoney(n.amount)}원</td>
                    <td className="px-4 py-3">
                      {n.status === 'pending' ? (
                        <div className="flex gap-1">
                          <button onClick={() => handleStatusChange(n.id, 'cleared')}
                            className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 hover:bg-green-200">결제</button>
                          <button onClick={() => handleStatusChange(n.id, 'bounced')}
                            className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 hover:bg-red-200">부도</button>
                        </div>
                      ) : (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS[n.status].color}`}>{STATUS[n.status].label}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => setConfirmId(n.id)} className="text-xs text-red-400 hover:text-red-600">삭제</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="어음 등록" size="md">
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
              <select className={inputCls} value={editItem.note_type ?? 'receivable'}
                onChange={e => setEditItem(p => ({ ...p, note_type: e.target.value as NoteType }))}>
                {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>어음번호</label>
              <input className={inputCls} value={editItem.note_no ?? ''}
                onChange={e => setEditItem(p => ({ ...p, note_no: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>발행일</label>
              <input type="date" className={inputCls} value={editItem.issue_date ?? ''}
                onChange={e => setEditItem(p => ({ ...p, issue_date: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>만기일 *</label>
              <input type="date" className={inputCls} value={editItem.due_date ?? ''}
                onChange={e => setEditItem(p => ({ ...p, due_date: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>은행</label>
              <input className={inputCls} placeholder="예: 국민은행" value={editItem.bank_name ?? ''}
                onChange={e => setEditItem(p => ({ ...p, bank_name: e.target.value }))} />
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

      <ConfirmDialog open={!!confirmId} message="어음을 삭제하시겠습니까?" onConfirm={handleDelete} onCancel={() => setConfirmId(null)} />
    </div>
  )
}
