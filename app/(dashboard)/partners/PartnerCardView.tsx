'use client'

import type { Partner } from '@/lib/types'

interface Props {
  partners: Partner[]
  onSelect: (p: Partner) => void
}

function fmt(n: number) {
  return new Intl.NumberFormat('ko-KR').format(n)
}

const TYPE_LABEL: Record<string, string> = {
  supplier: '공급업체',
  customer: '고객사',
  both: '양방향',
}

const TYPE_BADGE: Record<string, string> = {
  supplier: 'bg-blue-100 text-blue-700',
  customer: 'bg-green-100 text-green-700',
  both: 'bg-purple-100 text-purple-700',
}

const TYPE_ICON_BG: Record<string, string> = {
  supplier: 'bg-blue-50',
  customer: 'bg-green-50',
  both: 'bg-purple-50',
}

const TYPE_ICON_COLOR: Record<string, string> = {
  supplier: 'text-[#007aff]',
  customer: 'text-[#34c759]',
  both: 'text-[#af52de]',
}

export default function PartnerCardView({ partners, onSelect }: Props) {
  return (
    <div className="p-4 grid grid-cols-4 gap-3">
      {partners.map(p => (
        <div
          key={p.id}
          onClick={() => onSelect(p)}
          className="bg-white border border-black/[0.06] rounded-xl p-4 cursor-pointer hover:shadow-md hover:border-[#007aff]/20 transition-all duration-200"
        >
          {/* 헤더 */}
          <div className="flex items-start justify-between mb-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${TYPE_ICON_BG[p.partner_type]}`}>
              <svg className={`w-5 h-5 ${TYPE_ICON_COLOR[p.partner_type]}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGE[p.partner_type]}`}>
              {TYPE_LABEL[p.partner_type]}
            </span>
          </div>

          {/* 거래처명 */}
          <p className="text-sm font-semibold text-[#1d1d1f] mb-1 truncate">{p.name}</p>

          {/* 구분선 */}
          <div className="border-t border-gray-100 my-2" />

          {/* 연락처 정보 */}
          <div className="space-y-1">
            {p.phone && (
              <div className="flex items-center gap-1.5 text-xs text-[#86868b]">
                <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <span className="truncate">{p.phone}</span>
              </div>
            )}
            {p.email && (
              <div className="flex items-center gap-1.5 text-xs text-[#86868b]">
                <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="truncate">{p.email}</span>
              </div>
            )}
            {p.credit_limit > 0 && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-[#86868b]">신용한도</span>
                <span className="text-xs font-semibold text-[#1d1d1f]">{fmt(p.credit_limit)}원</span>
              </div>
            )}
            {!p.phone && !p.email && !p.credit_limit && (
              <p className="text-xs text-gray-300">정보 없음</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
