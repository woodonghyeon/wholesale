'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/ui/PageHeader'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { getBusinesses, upsertBusiness, deleteBusiness } from '@/lib/supabase/businesses'
import { getChannels, upsertChannel, deleteChannel } from '@/lib/supabase/channels'
import { getWarehouses, upsertWarehouse, deleteWarehouse } from '@/lib/supabase/warehouses'
import { Business, Channel, Warehouse } from '@/lib/types'

type Tab = 'businesses' | 'channels' | 'warehouses'

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('businesses')
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)

  // 모달 상태
  const [bizModal, setBizModal] = useState(false)
  const [chModal, setChModal] = useState(false)
  const [whModal, setWhModal] = useState(false)
  const [editBiz, setEditBiz] = useState<Partial<Business>>({})
  const [editCh, setEditCh] = useState<Partial<Channel>>({})
  const [editWh, setEditWh] = useState<Partial<Warehouse>>({})
  const [confirmId, setConfirmId] = useState<{ type: Tab; id: string } | null>(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [b, c, w] = await Promise.all([getBusinesses(), getChannels(), getWarehouses()])
      setBusinesses(b); setChannels(c); setWarehouses(w)
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally { setLoading(false) }
  }

  // ── 사업자 ──
  async function saveBusiness() {
    if (!editBiz.name?.trim()) return toast.error('사업자명을 입력해주세요')
    try {
      await upsertBusiness(editBiz as Business & { name: string })
      toast.success('저장되었습니다')
      setBizModal(false); setEditBiz({})
      const b = await getBusinesses(); setBusinesses(b)
    } catch (e: unknown) { toast.error((e as Error).message) }
  }

  // ── 채널 ──
  async function saveChannel() {
    if (!editCh.name?.trim()) return toast.error('채널명을 입력해주세요')
    try {
      await upsertChannel(editCh as Channel & { name: string })
      toast.success('저장되었습니다')
      setChModal(false); setEditCh({})
      const c = await getChannels(); setChannels(c)
    } catch (e: unknown) { toast.error((e as Error).message) }
  }

  // ── 창고 ──
  async function saveWarehouse() {
    if (!editWh.name?.trim()) return toast.error('창고명을 입력해주세요')
    try {
      await upsertWarehouse(editWh as Warehouse & { name: string })
      toast.success('저장되었습니다')
      setWhModal(false); setEditWh({})
      const w = await getWarehouses(); setWarehouses(w)
    } catch (e: unknown) { toast.error((e as Error).message) }
  }

  async function handleDelete() {
    if (!confirmId) return
    try {
      if (confirmId.type === 'businesses') { await deleteBusiness(confirmId.id); setBusinesses(await getBusinesses()) }
      if (confirmId.type === 'channels') { await deleteChannel(confirmId.id); setChannels(await getChannels()) }
      if (confirmId.type === 'warehouses') { await deleteWarehouse(confirmId.id); setWarehouses(await getWarehouses()) }
      toast.success('삭제되었습니다')
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setConfirmId(null) }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'businesses', label: '사업자' },
    { key: 'channels', label: '판매채널' },
    { key: 'warehouses', label: '창고' },
  ]

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1'

  return (
    <div>
      <PageHeader title="설정" description="사업자·채널·창고 기준 정보 관리" />

      {/* 탭 */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-900'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? <p className="text-sm text-gray-400">불러오는 중...</p> : (
        <>
          {/* ── 사업자 ── */}
          {tab === 'businesses' && (
            <div>
              <div className="flex justify-end mb-3">
                <button onClick={() => { setEditBiz({}); setBizModal(true) }}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">+ 사업자 추가</button>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs">
                    <tr>
                      {['사업자명','사업자번호','대표자','전화','이메일',''].map(h => (
                        <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {businesses.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">사업자가 없습니다</td></tr>
                    )}
                    {businesses.map(b => (
                      <tr key={b.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{b.name}</td>
                        <td className="px-4 py-3 text-gray-500">{b.business_no ?? '-'}</td>
                        <td className="px-4 py-3">{b.owner_name ?? '-'}</td>
                        <td className="px-4 py-3">{b.phone ?? '-'}</td>
                        <td className="px-4 py-3">{b.email ?? '-'}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => { setEditBiz(b); setBizModal(true) }} className="text-blue-600 hover:underline mr-3">수정</button>
                          <button onClick={() => setConfirmId({ type: 'businesses', id: b.id })} className="text-red-500 hover:underline">삭제</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── 채널 ── */}
          {tab === 'channels' && (
            <div>
              <div className="flex justify-end mb-3">
                <button onClick={() => { setEditCh({}); setChModal(true) }}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">+ 채널 추가</button>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs">
                    <tr>
                      {['채널명','플랫폼 수수료(%)','결제 수수료(%)','기본 배송비',''].map(h => (
                        <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {channels.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">채널이 없습니다</td></tr>
                    )}
                    {channels.map(c => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{c.name}</td>
                        <td className="px-4 py-3">{c.commission_rate}%</td>
                        <td className="px-4 py-3">{c.payment_fee_rate}%</td>
                        <td className="px-4 py-3">{c.shipping_fee.toLocaleString()}원</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => { setEditCh(c); setChModal(true) }} className="text-blue-600 hover:underline mr-3">수정</button>
                          <button onClick={() => setConfirmId({ type: 'channels', id: c.id })} className="text-red-500 hover:underline">삭제</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── 창고 ── */}
          {tab === 'warehouses' && (
            <div>
              <div className="flex justify-end mb-3">
                <button onClick={() => { setEditWh({}); setWhModal(true) }}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">+ 창고 추가</button>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs">
                    <tr>
                      {['창고명','주소','메모',''].map(h => (
                        <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {warehouses.length === 0 && (
                      <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">창고가 없습니다</td></tr>
                    )}
                    {warehouses.map(w => (
                      <tr key={w.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{w.name}</td>
                        <td className="px-4 py-3 text-gray-500">{w.address ?? '-'}</td>
                        <td className="px-4 py-3 text-gray-500">{w.note ?? '-'}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => { setEditWh(w); setWhModal(true) }} className="text-blue-600 hover:underline mr-3">수정</button>
                          <button onClick={() => setConfirmId({ type: 'warehouses', id: w.id })} className="text-red-500 hover:underline">삭제</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── 사업자 모달 ── */}
      <Modal open={bizModal} onClose={() => setBizModal(false)} title={editBiz.id ? '사업자 수정' : '사업자 추가'}>
        <div className="space-y-4">
          <div><label className={labelCls}>사업자명 *</label>
            <input className={inputCls} value={editBiz.name ?? ''} onChange={e => setEditBiz(p => ({ ...p, name: e.target.value }))} /></div>
          <div><label className={labelCls}>사업자등록번호</label>
            <input className={inputCls} placeholder="000-00-00000" value={editBiz.business_no ?? ''} onChange={e => setEditBiz(p => ({ ...p, business_no: e.target.value }))} /></div>
          <div><label className={labelCls}>대표자명</label>
            <input className={inputCls} value={editBiz.owner_name ?? ''} onChange={e => setEditBiz(p => ({ ...p, owner_name: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>전화</label>
              <input className={inputCls} value={editBiz.phone ?? ''} onChange={e => setEditBiz(p => ({ ...p, phone: e.target.value }))} /></div>
            <div><label className={labelCls}>이메일</label>
              <input className={inputCls} value={editBiz.email ?? ''} onChange={e => setEditBiz(p => ({ ...p, email: e.target.value }))} /></div>
          </div>
          <div><label className={labelCls}>주소</label>
            <input className={inputCls} value={editBiz.address ?? ''} onChange={e => setEditBiz(p => ({ ...p, address: e.target.value }))} /></div>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => setBizModal(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">취소</button>
            <button onClick={saveBusiness} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">저장</button>
          </div>
        </div>
      </Modal>

      {/* ── 채널 모달 ── */}
      <Modal open={chModal} onClose={() => setChModal(false)} title={editCh.id ? '채널 수정' : '채널 추가'}>
        <div className="space-y-4">
          <div><label className={labelCls}>채널명 *</label>
            <input className={inputCls} value={editCh.name ?? ''} onChange={e => setEditCh(p => ({ ...p, name: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>플랫폼 수수료 (%)</label>
              <input type="number" step="0.01" className={inputCls} value={editCh.commission_rate ?? 0} onChange={e => setEditCh(p => ({ ...p, commission_rate: parseFloat(e.target.value) }))} /></div>
            <div><label className={labelCls}>결제 수수료 (%)</label>
              <input type="number" step="0.01" className={inputCls} value={editCh.payment_fee_rate ?? 0} onChange={e => setEditCh(p => ({ ...p, payment_fee_rate: parseFloat(e.target.value) }))} /></div>
          </div>
          <div><label className={labelCls}>기본 배송비 (원)</label>
            <input type="number" className={inputCls} value={editCh.shipping_fee ?? 0} onChange={e => setEditCh(p => ({ ...p, shipping_fee: parseInt(e.target.value) }))} /></div>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => setChModal(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">취소</button>
            <button onClick={saveChannel} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">저장</button>
          </div>
        </div>
      </Modal>

      {/* ── 창고 모달 ── */}
      <Modal open={whModal} onClose={() => setWhModal(false)} title={editWh.id ? '창고 수정' : '창고 추가'}>
        <div className="space-y-4">
          <div><label className={labelCls}>창고명 *</label>
            <input className={inputCls} value={editWh.name ?? ''} onChange={e => setEditWh(p => ({ ...p, name: e.target.value }))} /></div>
          <div><label className={labelCls}>주소</label>
            <input className={inputCls} value={editWh.address ?? ''} onChange={e => setEditWh(p => ({ ...p, address: e.target.value }))} /></div>
          <div><label className={labelCls}>메모</label>
            <textarea className={inputCls} rows={2} value={editWh.note ?? ''} onChange={e => setEditWh(p => ({ ...p, note: e.target.value }))} /></div>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => setWhModal(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">취소</button>
            <button onClick={saveWarehouse} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">저장</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmId}
        message="정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
        onConfirm={handleDelete}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  )
}
