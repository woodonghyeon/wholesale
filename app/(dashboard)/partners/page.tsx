'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/ui/PageHeader'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { getPartners, upsertPartner, deletePartner } from '@/lib/supabase/partners'
import { Partner, PartnerType } from '@/lib/types'
import { formatMoney } from '@/lib/utils/format'

const PARTNER_TYPE_LABEL: Record<PartnerType, string> = {
  supplier: '공급사', customer: '고객사', both: '공급사+고객사',
}

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const labelCls = 'block text-sm font-medium text-gray-700 mb-1'

export default function PartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'' | PartnerType>('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<Partial<Partner>>({})
  const [confirmId, setConfirmId] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try { setPartners(await getPartners()) }
    catch (e: unknown) { toast.error((e as Error).message) }
    finally { setLoading(false) }
  }

  async function save() {
    if (!editItem.name?.trim()) return toast.error('거래처명을 입력해주세요')
    try {
      await upsertPartner({ partner_type: 'both', ...editItem } as Partner & { name: string })
      toast.success('저장되었습니다')
      setModalOpen(false); setEditItem({})
      setPartners(await getPartners())
    } catch (e: unknown) { toast.error((e as Error).message) }
  }

  async function handleDelete() {
    if (!confirmId) return
    try {
      await deletePartner(confirmId)
      toast.success('삭제되었습니다')
      setPartners(await getPartners())
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setConfirmId(null) }
  }

  const filtered = partners.filter(p => {
    const matchType = !typeFilter || p.partner_type === typeFilter
    const matchSearch = !search || p.name.includes(search) || p.phone?.includes(search) || false
    return matchType && matchSearch
  })

  return (
    <div>
      <PageHeader
        title="거래처 관리"
        description={`총 ${filtered.length}개`}
        action={
          <button onClick={() => { setEditItem({ partner_type: 'both' }); setModalOpen(true) }}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
            + 거래처 추가
          </button>
        }
      />

      {/* 필터 */}
      <div className="flex gap-2 mb-4">
        <input
          placeholder="거래처명·전화번호 검색"
          value={search} onChange={e => setSearch(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
        />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as '' | PartnerType)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
          <option value="">전체</option>
          <option value="supplier">공급사</option>
          <option value="customer">고객사</option>
          <option value="both">공급사+고객사</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">불러오는 중...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>
                {['거래처명','구분','전화','이메일','외상한도','메모',''].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">거래처가 없습니다</td></tr>
              )}
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      p.partner_type === 'supplier' ? 'bg-orange-100 text-orange-700' :
                      p.partner_type === 'customer' ? 'bg-blue-100 text-blue-700' :
                      'bg-purple-100 text-purple-700'
                    }`}>{PARTNER_TYPE_LABEL[p.partner_type]}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{p.phone ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{p.email ?? '-'}</td>
                  <td className="px-4 py-3">{p.credit_limit > 0 ? formatMoney(p.credit_limit) + '원' : '-'}</td>
                  <td className="px-4 py-3 text-gray-400 max-w-[160px] truncate">{p.note ?? '-'}</td>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem.id ? '거래처 수정' : '거래처 추가'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>거래처명 *</label>
              <input className={inputCls} value={editItem.name ?? ''} onChange={e => setEditItem(p => ({ ...p, name: e.target.value }))} /></div>
            <div><label className={labelCls}>구분</label>
              <select className={inputCls} value={editItem.partner_type ?? 'both'} onChange={e => setEditItem(p => ({ ...p, partner_type: e.target.value as PartnerType }))}>
                <option value="both">공급사+고객사</option>
                <option value="supplier">공급사</option>
                <option value="customer">고객사</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>전화</label>
              <input className={inputCls} value={editItem.phone ?? ''} onChange={e => setEditItem(p => ({ ...p, phone: e.target.value }))} /></div>
            <div><label className={labelCls}>이메일</label>
              <input className={inputCls} value={editItem.email ?? ''} onChange={e => setEditItem(p => ({ ...p, email: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>사업자등록번호</label>
              <input className={inputCls} value={editItem.business_no ?? ''} onChange={e => setEditItem(p => ({ ...p, business_no: e.target.value }))} /></div>
            <div><label className={labelCls}>외상한도 (원)</label>
              <input type="number" className={inputCls} value={editItem.credit_limit ?? 0} onChange={e => setEditItem(p => ({ ...p, credit_limit: parseInt(e.target.value) }))} /></div>
          </div>
          <div><label className={labelCls}>주소</label>
            <input className={inputCls} value={editItem.address ?? ''} onChange={e => setEditItem(p => ({ ...p, address: e.target.value }))} /></div>
          <div><label className={labelCls}>메모</label>
            <textarea className={inputCls} rows={2} value={editItem.note ?? ''} onChange={e => setEditItem(p => ({ ...p, note: e.target.value }))} /></div>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">취소</button>
            <button onClick={save} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">저장</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!confirmId} message="거래처를 삭제하시겠습니까?" onConfirm={handleDelete} onCancel={() => setConfirmId(null)} />
    </div>
  )
}
