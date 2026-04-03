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

const TYPE_STYLE: Record<string, string> = {
  supplier: 'bg-blue-100 text-blue-700',
  customer: 'bg-green-100 text-green-700',
  both: 'bg-purple-100 text-purple-700',
}

export default function PartnerTableView({ partners, onSelect }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/60">
            <th className="text-left px-4 py-2.5 font-medium text-[#86868b]">거래처명</th>
            <th className="text-center px-4 py-2.5 font-medium text-[#86868b] w-[80px]">유형</th>
            <th className="text-left px-4 py-2.5 font-medium text-[#86868b] w-[120px]">전화번호</th>
            <th className="text-left px-4 py-2.5 font-medium text-[#86868b] w-[180px]">이메일</th>
            <th className="text-left px-4 py-2.5 font-medium text-[#86868b] w-[120px]">사업자번호</th>
            <th className="text-right px-4 py-2.5 font-medium text-[#86868b] w-[110px]">신용한도</th>
            <th className="text-left px-4 py-2.5 font-medium text-[#86868b]">주소</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {partners.map((p, i) => (
            <tr
              key={p.id}
              onClick={() => onSelect(p)}
              className={`cursor-pointer hover:bg-blue-50/40 transition-colors ${i % 2 === 1 ? 'bg-gray-50/40' : ''}`}
            >
              <td className="px-4 py-2.5 font-medium text-[#1d1d1f]">{p.name}</td>
              <td className="px-4 py-2.5 text-center">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_STYLE[p.partner_type]}`}>
                  {TYPE_LABEL[p.partner_type]}
                </span>
              </td>
              <td className="px-4 py-2.5 text-[#86868b] font-mono">
                {p.phone ?? <span className="text-gray-300">—</span>}
              </td>
              <td className="px-4 py-2.5 text-[#86868b]">
                {p.email ?? <span className="text-gray-300">—</span>}
              </td>
              <td className="px-4 py-2.5 text-[#86868b] font-mono">
                {p.business_no ?? <span className="text-gray-300">—</span>}
              </td>
              <td className="px-4 py-2.5 text-right text-[#1d1d1f] font-medium">
                {p.credit_limit > 0 ? `${fmt(p.credit_limit)}원` : <span className="text-gray-300">—</span>}
              </td>
              <td className="px-4 py-2.5 text-[#86868b] truncate max-w-[200px]">
                {p.address ?? <span className="text-gray-300">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
