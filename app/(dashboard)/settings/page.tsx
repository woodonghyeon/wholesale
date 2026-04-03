'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Business, Channel } from '@/lib/types'
import { toast } from 'sonner'

// ─── 사업자 폼 ──────────────────────────────────────────────
interface BizForm {
  name: string
  business_no: string
  owner_name: string
  phone: string
  email: string
  address: string
}
const emptyBiz = (): BizForm => ({ name: '', business_no: '', owner_name: '', phone: '', email: '', address: '' })

// ─── 채널 폼 ────────────────────────────────────────────────
interface ChForm {
  business_id: string
  name: string
  platform_type: string
  commission_rate: string
  payment_fee_rate: string
  shipping_fee: string
}
const emptyCh = (bizId = ''): ChForm => ({
  business_id: bizId, name: '', platform_type: '',
  commission_rate: '0', payment_fee_rate: '0', shipping_fee: '0',
})

const PLATFORM_OPTIONS = [
  { value: '', label: '직접 입력 (기타)' },
  { value: 'naver', label: '네이버 스마트스토어' },
  { value: '11st', label: '11번가' },
  { value: 'auction', label: '옥션' },
  { value: 'gmarket', label: 'G마켓' },
  { value: 'coupang', label: '쿠팡' },
  { value: 'own', label: '자사몰' },
  { value: 'offline', label: '오프라인' },
]

export default function SettingsPage() {
  const supabase = createClient()

  // 사업자
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [bizModal, setBizModal] = useState<{ open: boolean; editing: Business | null }>({ open: false, editing: null })
  const [bizForm, setBizForm] = useState<BizForm>(emptyBiz())
  const [bizSaving, setBizSaving] = useState(false)
  const [bizDeleteId, setBizDeleteId] = useState<string | null>(null)
  const [bizDeleteConfirm, setBizDeleteConfirm] = useState(false)

  // 채널
  const [selectedBizForChannel, setSelectedBizForChannel] = useState<string>('')
  const [channels, setChannels] = useState<Channel[]>([])
  const [chModal, setChModal] = useState<{ open: boolean; editing: Channel | null }>({ open: false, editing: null })
  const [chForm, setChForm] = useState<ChForm>(emptyCh())
  const [chSaving, setChSaving] = useState(false)
  const [chDeleteId, setChDeleteId] = useState<string | null>(null)
  const [chDeleteConfirm, setChDeleteConfirm] = useState(false)

  // ─── 데이터 로드 ─────────────────────────────────────────
  const loadBusinesses = useCallback(async () => {
    const { data } = await supabase.from('businesses').select('*').order('sort_order')
    const list = data ?? []
    setBusinesses(list)
    if (!selectedBizForChannel && list.length > 0) {
      setSelectedBizForChannel(list[0].id)
    }
  }, [selectedBizForChannel])

  const loadChannels = useCallback(async () => {
    if (!selectedBizForChannel) return
    const { data } = await supabase
      .from('channels')
      .select('*')
      .eq('business_id', selectedBizForChannel)
      .order('sort_order')
    setChannels(data ?? [])
  }, [selectedBizForChannel])

  useEffect(() => { loadBusinesses() }, [])
  useEffect(() => { loadChannels() }, [selectedBizForChannel])

  // ─── 사업자 CRUD ─────────────────────────────────────────
  function openNewBiz() {
    setBizForm(emptyBiz())
    setBizModal({ open: true, editing: null })
  }
  function openEditBiz(biz: Business) {
    setBizForm({
      name: biz.name, business_no: biz.business_no ?? '',
      owner_name: biz.owner_name ?? '', phone: biz.phone ?? '',
      email: biz.email ?? '', address: biz.address ?? '',
    })
    setBizModal({ open: true, editing: biz })
  }
  function closeBizModal() {
    setBizModal({ open: false, editing: null })
    setBizDeleteConfirm(false)
    setBizDeleteId(null)
  }

  async function saveBiz(e: React.FormEvent) {
    e.preventDefault()
    if (!bizForm.name.trim()) { toast.error('사업자명을 입력하세요.'); return }
    setBizSaving(true)
    try {
      if (bizModal.editing) {
        const { error } = await supabase.from('businesses').update({
          name: bizForm.name.trim(),
          business_no: bizForm.business_no.trim() || null,
          owner_name: bizForm.owner_name.trim() || null,
          phone: bizForm.phone.trim() || null,
          email: bizForm.email.trim() || null,
          address: bizForm.address.trim() || null,
        }).eq('id', bizModal.editing.id)
        if (error) throw error
        toast.success('사업자 정보가 수정되었습니다.')
      } else {
        const maxOrder = businesses.reduce((m, b) => Math.max(m, b.sort_order), 0)
        const { error } = await supabase.from('businesses').insert({
          name: bizForm.name.trim(),
          business_no: bizForm.business_no.trim() || null,
          owner_name: bizForm.owner_name.trim() || null,
          phone: bizForm.phone.trim() || null,
          email: bizForm.email.trim() || null,
          address: bizForm.address.trim() || null,
          sort_order: maxOrder + 1,
        })
        if (error) throw error
        toast.success('사업자가 추가되었습니다.')
      }
      closeBizModal()
      await loadBusinesses()
    } catch (err: any) {
      toast.error(err.message ?? '저장에 실패했습니다.')
    } finally {
      setBizSaving(false)
    }
  }

  async function deleteBiz(id: string) {
    try {
      const { error } = await supabase.from('businesses').delete().eq('id', id)
      if (error) throw error
      toast.success('사업자가 삭제되었습니다.')
      setBizDeleteId(null)
      setBizDeleteConfirm(false)
      if (selectedBizForChannel === id) setSelectedBizForChannel('')
      await loadBusinesses()
    } catch (err: any) {
      toast.error(err.message ?? '삭제에 실패했습니다.')
    }
  }

  // ─── 채널 CRUD ───────────────────────────────────────────
  function openNewCh() {
    setChForm(emptyCh(selectedBizForChannel))
    setChModal({ open: true, editing: null })
  }
  function openEditCh(ch: Channel) {
    setChForm({
      business_id: ch.business_id ?? selectedBizForChannel,
      name: ch.name,
      platform_type: ch.platform_type ?? '',
      commission_rate: String(ch.commission_rate),
      payment_fee_rate: String(ch.payment_fee_rate),
      shipping_fee: String(ch.shipping_fee),
    })
    setChModal({ open: true, editing: ch })
  }
  function closeChModal() {
    setChModal({ open: false, editing: null })
    setChDeleteConfirm(false)
    setChDeleteId(null)
  }

  async function saveCh(e: React.FormEvent) {
    e.preventDefault()
    if (!chForm.name.trim()) { toast.error('채널명을 입력하세요.'); return }
    if (!chForm.business_id) { toast.error('사업자를 선택하세요.'); return }
    setChSaving(true)
    try {
      const payload = {
        business_id: chForm.business_id,
        name: chForm.name.trim(),
        platform_type: chForm.platform_type || null,
        commission_rate: parseFloat(chForm.commission_rate) || 0,
        payment_fee_rate: parseFloat(chForm.payment_fee_rate) || 0,
        shipping_fee: parseInt(chForm.shipping_fee) || 0,
      }
      if (chModal.editing) {
        const { error } = await supabase.from('channels').update(payload).eq('id', chModal.editing.id)
        if (error) throw error
        toast.success('채널이 수정되었습니다.')
      } else {
        const maxOrder = channels.reduce((m, c) => Math.max(m, c.sort_order), 0)
        const { error } = await supabase.from('channels').insert({ ...payload, sort_order: maxOrder + 1 })
        if (error) throw error
        toast.success('채널이 추가되었습니다.')
      }
      closeChModal()
      await loadChannels()
    } catch (err: any) {
      toast.error(err.message ?? '저장에 실패했습니다.')
    } finally {
      setChSaving(false)
    }
  }

  async function deleteCh(id: string) {
    try {
      const { error } = await supabase.from('channels').delete().eq('id', id)
      if (error) throw error
      toast.success('채널이 삭제되었습니다.')
      setChDeleteId(null)
      setChDeleteConfirm(false)
      await loadChannels()
    } catch (err: any) {
      toast.error(err.message ?? '삭제에 실패했습니다.')
    }
  }

  // ─── 렌더 ────────────────────────────────────────────────
  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold text-[#1d1d1f]">설정</h1>
        <p className="text-sm text-[#86868b] mt-0.5">사업자 및 채널 관리</p>
      </div>

      {/* ── 사업자 관리 ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-[#1d1d1f]">사업자 관리</h2>
          <button onClick={openNewBiz}
            className="rounded-lg px-4 py-2 text-sm font-medium bg-[#007aff] text-white hover:bg-[#0066d6] transition">
            + 사업자 추가
          </button>
        </div>
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-black/[0.06] shadow-card overflow-hidden">
          {businesses.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#86868b]">등록된 사업자가 없습니다.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50/80">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-medium text-[#86868b]">사업자명</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-[#86868b]">사업자번호</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-[#86868b]">대표자</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-[#86868b]">연락처</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {businesses.map(biz => (
                  <tr key={biz.id} className="hover:bg-gray-50/50 transition">
                    <td className="px-5 py-3 font-medium text-[#1d1d1f]">{biz.name}</td>
                    <td className="px-5 py-3 text-[#86868b]">{biz.business_no ?? '–'}</td>
                    <td className="px-5 py-3 text-[#86868b]">{biz.owner_name ?? '–'}</td>
                    <td className="px-5 py-3 text-[#86868b]">{biz.phone ?? '–'}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEditBiz(biz)}
                          className="text-xs text-[#007aff] hover:underline">수정</button>
                        {bizDeleteId === biz.id ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-[#86868b]">정말 삭제?</span>
                            <button onClick={() => deleteBiz(biz.id)}
                              className="text-xs text-[#ff3b30] hover:underline font-medium">확인</button>
                            <button onClick={() => { setBizDeleteId(null); setBizDeleteConfirm(false) }}
                              className="text-xs text-[#86868b] hover:underline">취소</button>
                          </div>
                        ) : (
                          <button onClick={() => setBizDeleteId(biz.id)}
                            className="text-xs text-[#86868b] hover:text-[#ff3b30] transition">삭제</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* ── 채널 관리 ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-[#1d1d1f]">채널 관리</h2>
            {/* 사업자 선택 탭 */}
            {businesses.length > 0 && (
              <div className="inline-flex bg-gray-100 rounded-lg p-0.5">
                {businesses.map(biz => (
                  <button key={biz.id}
                    onClick={() => setSelectedBizForChannel(biz.id)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                      selectedBizForChannel === biz.id
                        ? 'bg-white shadow-sm text-[#1d1d1f]'
                        : 'text-[#86868b] hover:text-[#1d1d1f]'
                    }`}
                  >
                    {biz.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={openNewCh} disabled={!selectedBizForChannel}
            className="rounded-lg px-4 py-2 text-sm font-medium bg-[#007aff] text-white hover:bg-[#0066d6] transition disabled:opacity-40">
            + 채널 추가
          </button>
        </div>
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-black/[0.06] shadow-card overflow-hidden">
          {!selectedBizForChannel ? (
            <div className="py-12 text-center text-sm text-[#86868b]">사업자를 선택하세요.</div>
          ) : channels.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-[#86868b]">등록된 채널이 없습니다.</p>
              <button onClick={openNewCh} className="mt-2 text-xs text-[#007aff] hover:underline">
                첫 채널 추가하기
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50/80">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-medium text-[#86868b]">채널명</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-[#86868b]">플랫폼</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-[#86868b]">판매수수료</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-[#86868b]">결제수수료</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-[#86868b]">기본배송비</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {channels.map(ch => (
                  <tr key={ch.id} className="hover:bg-gray-50/50 transition">
                    <td className="px-5 py-3 font-medium text-[#1d1d1f]">{ch.name}</td>
                    <td className="px-5 py-3">
                      {ch.platform_type ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-[#007aff]">
                          {PLATFORM_OPTIONS.find(p => p.value === ch.platform_type)?.label ?? ch.platform_type}
                        </span>
                      ) : (
                        <span className="text-[#86868b]">–</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right text-[#86868b]">{ch.commission_rate}%</td>
                    <td className="px-5 py-3 text-right text-[#86868b]">{ch.payment_fee_rate}%</td>
                    <td className="px-5 py-3 text-right text-[#86868b]">
                      {ch.shipping_fee > 0 ? `₩${ch.shipping_fee.toLocaleString('ko-KR')}` : '무료'}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEditCh(ch)}
                          className="text-xs text-[#007aff] hover:underline">수정</button>
                        {chDeleteId === ch.id ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-[#86868b]">정말 삭제?</span>
                            <button onClick={() => deleteCh(ch.id)}
                              className="text-xs text-[#ff3b30] hover:underline font-medium">확인</button>
                            <button onClick={() => { setChDeleteId(null); setChDeleteConfirm(false) }}
                              className="text-xs text-[#86868b] hover:underline">취소</button>
                          </div>
                        ) : (
                          <button onClick={() => setChDeleteId(ch.id)}
                            className="text-xs text-[#86868b] hover:text-[#ff3b30] transition">삭제</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* ── 사업자 모달 ── */}
      {bizModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={closeBizModal} />
          <div className="relative z-10 bg-white/90 backdrop-blur-2xl rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-base font-semibold text-[#1d1d1f] mb-5">
              {bizModal.editing ? '사업자 수정' : '사업자 추가'}
            </h3>
            <form onSubmit={saveBiz} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#86868b] mb-1">사업자명 *</label>
                <input value={bizForm.name} onChange={e => setBizForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="예: 강남점"
                  className="w-full rounded-lg border border-gray-300/60 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#86868b] mb-1">사업자번호</label>
                  <input value={bizForm.business_no} onChange={e => setBizForm(f => ({ ...f, business_no: e.target.value }))}
                    placeholder="000-00-00000"
                    className="w-full rounded-lg border border-gray-300/60 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#86868b] mb-1">대표자</label>
                  <input value={bizForm.owner_name} onChange={e => setBizForm(f => ({ ...f, owner_name: e.target.value }))}
                    placeholder="홍길동"
                    className="w-full rounded-lg border border-gray-300/60 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#86868b] mb-1">연락처</label>
                  <input value={bizForm.phone} onChange={e => setBizForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="02-0000-0000"
                    className="w-full rounded-lg border border-gray-300/60 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#86868b] mb-1">이메일</label>
                  <input value={bizForm.email} onChange={e => setBizForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="example@email.com"
                    className="w-full rounded-lg border border-gray-300/60 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#86868b] mb-1">주소</label>
                <input value={bizForm.address} onChange={e => setBizForm(f => ({ ...f, address: e.target.value }))}
                  placeholder="서울시 ..."
                  className="w-full rounded-lg border border-gray-300/60 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={closeBizModal}
                  className="flex-1 rounded-lg px-4 py-2 text-sm font-medium border border-gray-200 hover:bg-gray-50 transition">
                  취소
                </button>
                <button type="submit" disabled={bizSaving}
                  className="flex-1 rounded-lg px-4 py-2 text-sm font-medium bg-[#007aff] text-white hover:bg-[#0066d6] transition disabled:opacity-50">
                  {bizSaving ? '저장 중...' : '저장'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 채널 모달 ── */}
      {chModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={closeChModal} />
          <div className="relative z-10 bg-white/90 backdrop-blur-2xl rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-base font-semibold text-[#1d1d1f] mb-5">
              {chModal.editing ? '채널 수정' : '채널 추가'}
            </h3>
            <form onSubmit={saveCh} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#86868b] mb-1">사업자 *</label>
                <select value={chForm.business_id}
                  onChange={e => setChForm(f => ({ ...f, business_id: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300/60 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                  <option value="">선택하세요</option>
                  {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#86868b] mb-1">플랫폼</label>
                <select value={chForm.platform_type}
                  onChange={e => {
                    const pt = e.target.value
                    const preset = PLATFORM_OPTIONS.find(p => p.value === pt)
                    setChForm(f => ({
                      ...f,
                      platform_type: pt,
                      name: pt && f.name === '' ? (preset?.label ?? '') : f.name,
                    }))
                  }}
                  className="w-full rounded-lg border border-gray-300/60 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                  {PLATFORM_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#86868b] mb-1">채널명 *</label>
                <input value={chForm.name} onChange={e => setChForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="예: 네이버 스마트스토어"
                  className="w-full rounded-lg border border-gray-300/60 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#86868b] mb-1">판매수수료 (%)</label>
                  <input type="number" step="0.01" min="0" max="100"
                    value={chForm.commission_rate}
                    onChange={e => setChForm(f => ({ ...f, commission_rate: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300/60 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#86868b] mb-1">결제수수료 (%)</label>
                  <input type="number" step="0.01" min="0" max="100"
                    value={chForm.payment_fee_rate}
                    onChange={e => setChForm(f => ({ ...f, payment_fee_rate: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300/60 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#86868b] mb-1">기본배송비 (₩)</label>
                  <input type="number" step="100" min="0"
                    value={chForm.shipping_fee}
                    onChange={e => setChForm(f => ({ ...f, shipping_fee: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300/60 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={closeChModal}
                  className="flex-1 rounded-lg px-4 py-2 text-sm font-medium border border-gray-200 hover:bg-gray-50 transition">
                  취소
                </button>
                <button type="submit" disabled={chSaving}
                  className="flex-1 rounded-lg px-4 py-2 text-sm font-medium bg-[#007aff] text-white hover:bg-[#0066d6] transition disabled:opacity-50">
                  {chSaving ? '저장 중...' : '저장'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
