'use client'

import { useEffect, useState } from 'react'
import { fetchSlipWithItems, deleteSlip } from '@/lib/supabase/slips'
import type { Slip } from '@/lib/types'
import { toast } from 'sonner'

interface Props {
  slipId: string
  onClose: () => void
  onDeleted: () => void
}

function fmt(n: number) {
  return new Intl.NumberFormat('ko-KR').format(n)
}

const PAYMENT_LABEL: Record<string, string> = {
  cash: '현금', credit: '외상', mixed: '혼합',
}

export default function SlipDetailModal({ slipId, onClose, onDeleted }: Props) {
  const [slip, setSlip] = useState<Slip | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    fetchSlipWithItems(slipId)
      .then(setSlip)
      .catch(() => toast.error('전표를 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [slipId])

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    try {
      await deleteSlip(slipId)
      toast.success('전표가 삭제되었습니다.')
      onDeleted()
    } catch (err: any) {
      toast.error(err?.message ?? '삭제 실패')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-white/90 backdrop-blur-2xl rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06]">
          <div className="flex items-center gap-3">
            {slip && (
              <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                slip.slip_type === 'sale'
                  ? 'bg-blue-50 text-[#007aff]'
                  : 'bg-gray-100 text-[#86868b]'
              }`}>
                {slip.slip_type === 'sale' ? '매출' : '매입'}
              </span>
            )}
            <h2 className="text-base font-semibold text-[#1d1d1f]">
              {loading ? '전표 상세' : slip?.slip_no ?? '전표 상세'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition text-[#86868b]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="py-12 text-center text-sm text-[#86868b]">불러오는 중...</div>
          ) : !slip ? (
            <div className="py-12 text-center text-sm text-[#86868b]">전표를 찾을 수 없습니다.</div>
          ) : (
            <div className="space-y-5">
              {/* 기본 정보 */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: '전표번호', value: slip.slip_no },
                  { label: '전표일자', value: new Date(slip.slip_date).toLocaleDateString('ko-KR') },
                  { label: '사업자', value: (slip.business as any)?.name ?? '–' },
                  { label: slipType(slip.slip_type), value: (slip.partner as any)?.name ?? '–' },
                  { label: '판매채널', value: (slip.channel as any)?.name ?? '–' },
                  { label: '창고', value: (slip.warehouse as any)?.name ?? '–' },
                  { label: '결제방식', value: PAYMENT_LABEL[slip.payment_type] },
                  {
                    label: '세금계산서',
                    value: slip.tax_invoice_issued ? '발행' : '미발행',
                  },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-50/80 rounded-xl px-4 py-3">
                    <p className="text-xs text-[#86868b] mb-0.5">{label}</p>
                    <p className="text-sm font-medium text-[#1d1d1f]">{value}</p>
                  </div>
                ))}
              </div>

              {/* 품목 */}
              <div>
                <p className="text-xs font-medium text-[#86868b] mb-2">품목 내역</p>
                <div className="rounded-xl border border-black/[0.06] overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50/80">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-medium text-[#86868b]">상품</th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-[#86868b]">수량</th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-[#86868b]">단가</th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-[#86868b]">공급가</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(slip.items ?? []).map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50/50 transition">
                          <td className="px-3 py-2.5 font-medium text-[#1d1d1f]">
                            {(item.product as any)?.name ?? '–'}
                            <span className="ml-1 text-xs text-[#86868b]">({(item.product as any)?.unit ?? '개'})</span>
                          </td>
                          <td className="px-3 py-2.5 text-right text-[#86868b]">{fmt(item.quantity)}</td>
                          <td className="px-3 py-2.5 text-right text-[#86868b]">₩{fmt(item.unit_price)}</td>
                          <td className="px-3 py-2.5 text-right font-medium text-[#1d1d1f]">₩{fmt(item.supply_amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 금액 합계 */}
              <div className="flex justify-end">
                <div className="space-y-1.5 min-w-[220px]">
                  <div className="flex justify-between text-xs text-[#86868b]">
                    <span>공급가액</span>
                    <span className="font-medium text-[#1d1d1f]">₩{fmt(slip.supply_amount)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-[#86868b]">
                    <span>부가세</span>
                    <span className="font-medium text-[#1d1d1f]">₩{fmt(slip.tax_amount)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-[#86868b]">
                    <span>결제금액</span>
                    <span className="font-medium text-[#1d1d1f]">₩{fmt(slip.paid_amount)}</span>
                  </div>
                  <div className="flex justify-between text-sm pt-1.5 border-t border-gray-100">
                    <span className="font-semibold text-[#1d1d1f]">총액</span>
                    <span className="font-bold text-[#007aff]">₩{fmt(slip.total_amount)}</span>
                  </div>
                  {slip.total_amount - slip.paid_amount > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-[#ff3b30]">미수금</span>
                      <span className="font-semibold text-[#ff3b30]">₩{fmt(slip.total_amount - slip.paid_amount)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 메모 */}
              {slip.memo && (
                <div className="bg-yellow-50/60 rounded-xl px-4 py-3 text-sm text-[#1d1d1f]">
                  <p className="text-xs text-[#86868b] mb-1">메모</p>
                  {slip.memo}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 푸터 */}
        {!loading && slip && (
          <div className="px-6 py-4 border-t border-black/[0.06] flex items-center justify-between bg-gray-50/50">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${
                confirmDelete
                  ? 'bg-[#ff3b30] text-white hover:bg-red-600'
                  : 'border border-gray-200 text-[#ff3b30] hover:bg-red-50'
              }`}
            >
              {deleting ? '삭제 중...' : confirmDelete ? '정말 삭제' : '전표 삭제'}
            </button>
            {confirmDelete && (
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-sm text-[#86868b] hover:underline ml-2"
              >
                취소
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium border border-gray-200 hover:bg-gray-50 transition ml-auto"
            >
              닫기
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function slipType(type: string) {
  return type === 'sale' ? '고객사' : '공급처'
}
