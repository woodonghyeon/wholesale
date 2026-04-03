'use client'

import { useEffect, useState, useCallback } from 'react'
import { useBusinessStore } from '@/store/businessStore'
import { fetchSlips } from '@/lib/supabase/slips'
import type { Slip, SlipType } from '@/lib/types'
import SlipFormModal from './SlipFormModal'
import SlipDetailModal from './SlipDetailModal'

function fmt(n: number) {
  return new Intl.NumberFormat('ko-KR').format(n)
}

const PAYMENT_LABEL: Record<string, string> = {
  cash: '현금', credit: '외상', mixed: '혼합',
}

type FilterType = 'all' | SlipType

export default function TransactionsPage() {
  const { selectedBusinessId } = useBusinessStore()

  const [slips, setSlips] = useState<Slip[]>([])
  const [loading, setLoading] = useState(true)

  // 필터
  const [typeFilter, setTypeFilter] = useState<FilterType>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [keyword, setKeyword] = useState('')

  // 모달
  const [showForm, setShowForm] = useState(false)
  const [defaultFormType, setDefaultFormType] = useState<SlipType>('sale')
  const [detailSlipId, setDetailSlipId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchSlips({
        businessId: selectedBusinessId,
        slipType: typeFilter !== 'all' ? typeFilter : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      })
      setSlips(data)
    } catch {
      // silently fail — no toast on initial load
    } finally {
      setLoading(false)
    }
  }, [selectedBusinessId, typeFilter, dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  // 키워드 필터 (클라이언트 사이드)
  const filtered = keyword
    ? slips.filter(s => {
        const kw = keyword.toLowerCase()
        const partnerName = (s.partner as any)?.name ?? ''
        const channelName = (s.channel as any)?.name ?? ''
        return (
          s.slip_no.toLowerCase().includes(kw) ||
          partnerName.toLowerCase().includes(kw) ||
          channelName.toLowerCase().includes(kw) ||
          (s.memo ?? '').toLowerCase().includes(kw)
        )
      })
    : slips

  // 집계
  const totalSales = filtered.filter(s => s.slip_type === 'sale').reduce((s, v) => s + v.total_amount, 0)
  const totalPurchase = filtered.filter(s => s.slip_type === 'purchase').reduce((s, v) => s + v.total_amount, 0)
  const totalUnpaid = filtered.filter(s => s.payment_type !== 'cash').reduce((s, v) => s + (v.total_amount - v.paid_amount), 0)

  function openNewSlip(type: SlipType) {
    setDefaultFormType(type)
    setShowForm(true)
  }

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#1d1d1f]">거래전표</h1>
          <p className="text-sm text-[#86868b] mt-0.5">매출·매입 전표 통합 관리</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => openNewSlip('purchase')}
            className="rounded-lg px-4 py-2 text-sm font-medium border border-gray-200 hover:bg-gray-50 transition"
          >
            + 매입 전표
          </button>
          <button
            onClick={() => openNewSlip('sale')}
            className="rounded-lg px-4 py-2 text-sm font-medium bg-[#007aff] text-white hover:bg-[#0066d6] transition"
          >
            + 매출 전표
          </button>
        </div>
      </div>

      {/* KPI 요약 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-black/[0.06] shadow-card p-5">
          <p className="text-xs font-medium text-[#86868b] mb-1">매출 합계</p>
          <p className="text-xl font-semibold text-[#007aff]">₩{fmt(totalSales)}</p>
          <p className="text-xs text-[#86868b] mt-0.5">{filtered.filter(s => s.slip_type === 'sale').length}건</p>
        </div>
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-black/[0.06] shadow-card p-5">
          <p className="text-xs font-medium text-[#86868b] mb-1">매입 합계</p>
          <p className="text-xl font-semibold text-[#1d1d1f]">₩{fmt(totalPurchase)}</p>
          <p className="text-xs text-[#86868b] mt-0.5">{filtered.filter(s => s.slip_type === 'purchase').length}건</p>
        </div>
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-black/[0.06] shadow-card p-5">
          <p className="text-xs font-medium text-[#86868b] mb-1">미수·미지급 잔액</p>
          <p className={`text-xl font-semibold ${totalUnpaid > 0 ? 'text-[#ff9f0a]' : 'text-[#34c759]'}`}>
            ₩{fmt(totalUnpaid)}
          </p>
          <p className="text-xs text-[#86868b] mt-0.5">외상 전표 기준</p>
        </div>
      </div>

      {/* 필터 영역 */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-black/[0.06] shadow-card p-4">
        <div className="flex flex-wrap gap-3 items-center">
          {/* 구분 세그먼트 */}
          <div className="inline-flex bg-gray-100 rounded-lg p-0.5">
            {(['all', 'sale', 'purchase'] as FilterType[]).map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                  typeFilter === t ? 'bg-white shadow-sm text-[#1d1d1f]' : 'text-[#86868b]'
                }`}
              >
                {t === 'all' ? '전체' : t === 'sale' ? '매출' : '매입'}
              </button>
            ))}
          </div>

          {/* 날짜 범위 */}
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="rounded-lg border border-gray-300/60 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <span className="text-xs text-[#86868b]">~</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="rounded-lg border border-gray-300/60 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(''); setDateTo('') }}
                className="text-xs text-[#86868b] hover:text-[#ff3b30] transition"
              >
                초기화
              </button>
            )}
          </div>

          {/* 키워드 검색 */}
          <div className="flex-1 min-w-[180px]">
            <input
              type="text"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="전표번호 · 거래처 · 채널 검색..."
              className="w-full rounded-lg border border-gray-300/60 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>
      </div>

      {/* 전표 목록 */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-black/[0.06] shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#1d1d1f]">전표 목록</h2>
          <p className="text-xs text-[#86868b]">총 {filtered.length}건</p>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-[#86868b]">불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-[#86868b]">전표가 없습니다.</p>
            <button
              onClick={() => openNewSlip('sale')}
              className="mt-3 text-xs text-[#007aff] hover:underline"
            >
              첫 번째 전표 등록하기
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/80">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[#86868b]">구분</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[#86868b]">전표번호</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[#86868b]">일자</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[#86868b]">거래처</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[#86868b]">채널</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[#86868b]">결제</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-[#86868b]">공급가액</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-[#86868b]">합계</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-[#86868b]">미수금</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((slip) => {
                  const unpaid = slip.total_amount - slip.paid_amount
                  return (
                    <tr
                      key={slip.id}
                      onClick={() => setDetailSlipId(slip.id)}
                      className="hover:bg-gray-50/50 transition cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          slip.slip_type === 'sale'
                            ? 'bg-blue-50 text-[#007aff]'
                            : 'bg-gray-100 text-[#86868b]'
                        }`}>
                          {slip.slip_type === 'sale' ? '매출' : '매입'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-[#1d1d1f]">{slip.slip_no}</td>
                      <td className="px-4 py-3 text-[#86868b] whitespace-nowrap">
                        {new Date(slip.slip_date).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="px-4 py-3 text-[#86868b]">
                        {(slip.partner as any)?.name ?? <span className="text-gray-300">–</span>}
                      </td>
                      <td className="px-4 py-3 text-[#86868b]">
                        {(slip.channel as any)?.name ?? <span className="text-gray-300">–</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          slip.payment_type === 'cash'
                            ? 'bg-green-50 text-[#34c759]'
                            : slip.payment_type === 'credit'
                            ? 'bg-orange-50 text-[#ff9f0a]'
                            : 'bg-purple-50 text-purple-500'
                        }`}>
                          {PAYMENT_LABEL[slip.payment_type]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-[#86868b]">₩{fmt(slip.supply_amount)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-[#1d1d1f]">₩{fmt(slip.total_amount)}</td>
                      <td className="px-4 py-3 text-right">
                        {unpaid > 0 ? (
                          <span className="font-medium text-[#ff3b30]">₩{fmt(unpaid)}</span>
                        ) : (
                          <span className="text-[#34c759] text-xs">완납</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 모달 */}
      {showForm && (
        <SlipFormModal
          businessId={selectedBusinessId}
          defaultType={defaultFormType}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load() }}
        />
      )}

      {detailSlipId && (
        <SlipDetailModal
          slipId={detailSlipId}
          onClose={() => setDetailSlipId(null)}
          onDeleted={() => { setDetailSlipId(null); load() }}
        />
      )}
    </div>
  )
}
