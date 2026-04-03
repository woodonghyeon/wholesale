'use client'

import { useState } from 'react'
import type { Partner, PartnerType } from '@/lib/types'
import type { PartnerFormData } from '@/lib/supabase/partners'
import { createPartner, updatePartner, deletePartner } from '@/lib/supabase/partners'
import { toast } from 'sonner'

interface Props {
  partner?: Partner | null
  onClose: () => void
  onSaved: () => void
}

const PARTNER_TYPES: { value: PartnerType; label: string }[] = [
  { value: 'supplier', label: '공급업체' },
  { value: 'customer', label: '고객사' },
  { value: 'both', label: '양방향 (공급·고객 모두)' },
]

export default function PartnerFormModal({ partner, onClose, onSaved }: Props) {
  const isEdit = !!partner

  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [name, setName] = useState(partner?.name ?? '')
  const [partnerType, setPartnerType] = useState<PartnerType>(partner?.partner_type ?? 'supplier')
  const [phone, setPhone] = useState(partner?.phone ?? '')
  const [email, setEmail] = useState(partner?.email ?? '')
  const [address, setAddress] = useState(partner?.address ?? '')
  const [businessNo, setBusinessNo] = useState(partner?.business_no ?? '')
  const [creditLimit, setCreditLimit] = useState(String(partner?.credit_limit ?? '0'))
  const [note, setNote] = useState(partner?.note ?? '')

  async function handleSave() {
    if (!name.trim()) { toast.error('거래처명을 입력하세요.'); return }
    if (Number(creditLimit) < 0) { toast.error('신용한도는 0 이상이어야 합니다.'); return }

    setSaving(true)
    try {
      const formData: PartnerFormData = {
        name: name.trim(),
        partner_type: partnerType,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        business_no: businessNo.trim() || undefined,
        credit_limit: Number(creditLimit) || 0,
        note: note.trim() || undefined,
      }
      if (isEdit) {
        await updatePartner(partner.id, formData)
        toast.success('거래처가 수정되었습니다.')
      } else {
        await createPartner(formData)
        toast.success('거래처가 등록되었습니다.')
      }
      onSaved()
    } catch (e: any) {
      toast.error(e?.message ?? '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!partner) return
    setDeleting(true)
    try {
      await deletePartner(partner.id)
      toast.success('거래처가 삭제되었습니다.')
      onSaved()
    } catch (e: any) {
      toast.error(e?.message ?? '삭제에 실패했습니다.')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-white/90 backdrop-blur-2xl rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06]">
          <h2 className="text-base font-semibold text-[#1d1d1f]">
            {isEdit ? '거래처 수정' : '거래처 등록'}
          </h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-black/[0.06] transition-colors">
            <svg className="w-4 h-4 text-[#86868b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 바디 */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          {/* 거래처명 */}
          <div>
            <label className="block text-xs font-medium text-[#86868b] mb-1">거래처명 <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="거래처명을 입력하세요"
              className="w-full rounded-lg border border-gray-300/60 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* 거래처 유형 */}
          <div>
            <label className="block text-xs font-medium text-[#86868b] mb-1">거래처 유형 <span className="text-red-500">*</span></label>
            <div className="inline-flex bg-gray-100 rounded-lg p-0.5 w-full">
              {PARTNER_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setPartnerType(t.value)}
                  className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                    partnerType === t.value ? 'bg-white shadow-sm text-[#1d1d1f]' : 'text-[#86868b] hover:text-[#1d1d1f]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* 전화 + 이메일 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#86868b] mb-1">전화번호</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="02-0000-0000"
                className="w-full rounded-lg border border-gray-300/60 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#86868b] mb-1">이메일</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="example@company.com"
                className="w-full rounded-lg border border-gray-300/60 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          {/* 사업자번호 + 신용한도 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#86868b] mb-1">사업자번호</label>
              <input
                type="text"
                value={businessNo}
                onChange={e => setBusinessNo(e.target.value)}
                placeholder="000-00-00000"
                className="w-full rounded-lg border border-gray-300/60 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#86868b] mb-1">신용한도 (원)</label>
              <input
                type="number"
                min={0}
                value={creditLimit}
                onChange={e => setCreditLimit(e.target.value)}
                className="w-full rounded-lg border border-gray-300/60 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          {/* 주소 */}
          <div>
            <label className="block text-xs font-medium text-[#86868b] mb-1">주소</label>
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="사업장 주소"
              className="w-full rounded-lg border border-gray-300/60 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-xs font-medium text-[#86868b] mb-1">메모</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              placeholder="거래처에 대한 메모"
              className="w-full rounded-lg border border-gray-300/60 bg-white px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        {/* 푸터 */}
        <div className="px-6 py-4 border-t border-black/[0.06] flex items-center justify-between">
          {isEdit ? (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#ff3b30]">정말 삭제하시겠습니까?</span>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#ff3b30] text-white hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {deleting ? '삭제 중…' : '확인'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#ff3b30] hover:bg-red-50 transition-colors"
              >
                삭제
              </button>
            )
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-[#007aff] text-white hover:bg-[#0066d6] transition-colors disabled:opacity-50"
            >
              {saving ? '저장 중…' : isEdit ? '수정 완료' : '등록'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
