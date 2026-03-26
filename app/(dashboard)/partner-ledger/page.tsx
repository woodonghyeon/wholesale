'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getPartnerLedger, LedgerRow, PartnerLedgerSummary } from '@/lib/supabase/partner-ledger'

const today = new Date().toISOString().slice(0, 10)
const yearStart = today.slice(0, 4) + '-01-01'

const FMT = (n: number) => n.toLocaleString() + '원'

export default function PartnerLedgerPage() {
  const [partners, setPartners] = useState<{ id: string; name: string; partner_type: string }[]>([])
  const [partnerId, setPartnerId] = useState('')
  const [from, setFrom] = useState(yearStart)
  const [to, setTo] = useState(today)
  const [rows, setRows] = useState<LedgerRow[]>([])
  const [summary, setSummary] = useState<PartnerLedgerSummary>({ total_sale: 0, total_purchase: 0, net: 0 })
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    const sb = createClient()
    sb.from('partners').select('id, name, partner_type').order('name').then(({ data }) => {
      setPartners(data ?? [])
      if (data && data.length > 0) setPartnerId(data[0].id)
    })
  }, [])

  const load = useCallback(async () => {
    if (!partnerId) return
    setLoading(true)
    setSearched(true)
    try {
      const result = await getPartnerLedger(partnerId, from || undefined, to || undefined)
      setRows(result.rows)
      setSummary(result.summary)
    } finally {
      setLoading(false)
    }
  }, [partnerId, from, to])

  const selectedPartner = partners.find(p => p.id === partnerId)

  const thCls = 'px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200'
  const tdCls = 'px-3 py-2 text-sm border-b border-gray-100'

  const TYPE_LABEL: Record<string, string> = {
    sale: '매출',
    purchase: '매입',
  }
  const PAYMENT_LABEL: Record<string, string> = {
    cash: '현금',
    credit: '외상',
    card: '카드',
    transfer: '이체',
    note: '어음',
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">거래처별 판매 원장</h1>
        <p className="text-sm text-gray-500 mt-1">거래처 단위 매출·매입 전체 이력 및 누계 잔액</p>
      </div>

      {/* 필터 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">거래처</label>
          <select value={partnerId} onChange={e => setPartnerId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[200px]">
            <option value="">거래처 선택</option>
            {partners.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.partner_type === 'supplier' ? '공급' : p.partner_type === 'customer' ? '판매' : '겸용'})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">기간</label>
          <div className="flex items-center gap-2">
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <span className="text-gray-400">~</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        <button onClick={load} disabled={!partnerId}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
          조회
        </button>
      </div>

      {searched && selectedPartner && (
        <>
          {/* 요약 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-xs text-blue-600 mb-1">총 매출</p>
              <p className="text-2xl font-bold text-blue-700">{FMT(summary.total_sale)}</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-xs text-red-600 mb-1">총 매입</p>
              <p className="text-2xl font-bold text-red-700">{FMT(summary.total_purchase)}</p>
            </div>
            <div className={`rounded-xl p-4 border ${summary.net >= 0 ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
              <p className={`text-xs mb-1 ${summary.net >= 0 ? 'text-green-600' : 'text-orange-600'}`}>
                순거래액 (매출–매입)
              </p>
              <p className={`text-2xl font-bold ${summary.net >= 0 ? 'text-green-700' : 'text-orange-700'}`}>
                {summary.net >= 0 ? '' : '-'}{FMT(Math.abs(summary.net))}
              </p>
            </div>
          </div>

          {/* 원장 테이블 */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <span className="font-semibold text-gray-800">{selectedPartner.name} 거래 원장</span>
              <span className="text-sm text-gray-500">총 {rows.length}건</span>
            </div>
            {loading ? (
              <div className="p-12 text-center text-gray-400">로딩 중...</div>
            ) : rows.length === 0 ? (
              <div className="p-12 text-center text-gray-400">거래 이력이 없습니다</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      {['일자', '전표번호', '구분', '결제방식', '공급가', '세액', '합계', '누계잔액', '비고'].map(h => (
                        <th key={h} className={thCls}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={r.id} className={`hover:bg-gray-50 ${r.slip_type === 'sale' ? '' : 'bg-gray-50/50'}`}>
                        <td className={tdCls + ' text-gray-500'}>{r.slip_date}</td>
                        <td className={tdCls + ' font-mono text-xs text-gray-400'}>{r.slip_no ?? '-'}</td>
                        <td className={tdCls}>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                            r.slip_type === 'sale' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                          }`}>
                            {TYPE_LABEL[r.slip_type]}
                          </span>
                        </td>
                        <td className={tdCls + ' text-gray-500 text-xs'}>{PAYMENT_LABEL[r.payment_type] ?? r.payment_type}</td>
                        <td className={tdCls + ' text-right'}>{r.supply_amount.toLocaleString()}</td>
                        <td className={tdCls + ' text-right text-gray-400'}>{r.tax_amount.toLocaleString()}</td>
                        <td className={`${tdCls} text-right font-semibold ${r.slip_type === 'sale' ? 'text-blue-700' : 'text-orange-700'}`}>
                          {r.slip_type === 'sale' ? '+' : '-'}{r.total_amount.toLocaleString()}
                        </td>
                        <td className={`${tdCls} text-right font-bold ${r.running_balance >= 0 ? 'text-gray-800' : 'text-red-600'}`}>
                          {r.running_balance.toLocaleString()}
                        </td>
                        <td className={tdCls + ' text-gray-400 text-xs'}>{r.memo ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {!searched && (
        <div className="bg-white border border-gray-200 rounded-xl p-16 text-center text-gray-400">
          <p className="text-4xl mb-3">📋</p>
          <p>거래처를 선택하고 조회하세요</p>
        </div>
      )}
    </div>
  )
}
