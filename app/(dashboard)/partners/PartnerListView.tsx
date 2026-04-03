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

const TYPE_BAR: Record<string, string> = {
  supplier: 'bg-[#007aff]',
  customer: 'bg-[#34c759]',
  both: 'bg-[#af52de]',
}

const TYPE_BADGE: Record<string, string> = {
  supplier: 'bg-blue-100 text-blue-700',
  customer: 'bg-green-100 text-green-700',
  both: 'bg-purple-100 text-purple-700',
}

export default function PartnerListView({ partners, onSelect }: Props) {
  return (
    <div className="divide-y divide-gray-100">
      {partners.map(p => (
        <div
          key={p.id}
          onClick={() => onSelect(p)}
          className="flex items-stretch gap-0 cursor-pointer hover:bg-blue-50/40 transition-colors"
        >
          {/* 컬러바 */}
          <div className={`w-1 flex-shrink-0 ${TYPE_BAR[p.partner_type]}`} />

          <div className="flex-1 px-4 py-3">
            {/* 1행 */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-[#1d1d1f]">{p.name}</span>
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGE[p.partner_type]}`}>
                {TYPE_LABEL[p.partner_type]}
              </span>
              {p.credit_limit > 0 && (
                <span className="ml-auto text-xs font-medium text-[#1d1d1f]">
                  신용한도 {fmt(p.credit_limit)}원
                </span>
              )}
            </div>
            {/* 2행 */}
            <div className="flex items-center gap-4 text-xs text-[#86868b]">
              {p.phone && <span>{p.phone}</span>}
              {p.email && <span>{p.email}</span>}
              {p.business_no && <span className="font-mono">{p.business_no}</span>}
              {p.address && <span className="truncate max-w-[300px]">{p.address}</span>}
              {!p.phone && !p.email && !p.business_no && !p.address && (
                <span className="text-gray-300">연락처 정보 없음</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
