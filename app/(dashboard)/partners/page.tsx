'use client'

import { useEffect, useState, useCallback } from 'react'
import { fetchPartners } from '@/lib/supabase/partners'
import type { Partner, PartnerType } from '@/lib/types'
import { toast } from 'sonner'
import PartnerFormModal from './PartnerFormModal'
import PartnerTableView from './PartnerTableView'
import PartnerListView from './PartnerListView'
import PartnerCardView from './PartnerCardView'

type ViewMode = 'table' | 'list' | 'card'
type PageSize = 10 | 50 | 100
type TypeFilter = PartnerType | 'all'

function fmt(n: number) {
  return new Intl.NumberFormat('ko-KR').format(n)
}

export default function PartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [keyword, setKeyword] = useState('')

  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState<PageSize>(50)

  const [showForm, setShowForm] = useState(false)
  const [editPartner, setEditPartner] = useState<Partner | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await fetchPartners({ partnerType: typeFilter })
      setPartners(result)
    } catch {
      toast.error('데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [typeFilter])

  const filtered = partners.filter(p => {
    if (!keyword) return true
    const kw = keyword.toLowerCase()
    return (
      p.name.toLowerCase().includes(kw) ||
      (p.phone ?? '').toLowerCase().includes(kw) ||
      (p.email ?? '').toLowerCase().includes(kw) ||
      (p.business_no ?? '').toLowerCase().includes(kw)
    )
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated  = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  useEffect(() => { load() }, [load])
  useEffect(() => { setCurrentPage(1) }, [pageSize])
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(1) }, [currentPage, totalPages])

  // KPI
  const supplierCount = partners.filter(p => p.partner_type === 'supplier').length
  const customerCount = partners.filter(p => p.partner_type === 'customer').length
  const bothCount     = partners.filter(p => p.partner_type === 'both').length
  const totalCredit   = partners.reduce((s, p) => s + p.credit_limit, 0)

  function openNew() {
    setEditPartner(null)
    setShowForm(true)
  }

  function openEdit(p: Partner) {
    setEditPartner(p)
    setShowForm(true)
  }

  function handleSaved() {
    setShowForm(false)
    setEditPartner(null)
    load()
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#fafafa]">
      {/* 헤더 */}
      <div className="px-6 py-4 border-b border-black/[0.06] bg-white/72 backdrop-blur-xl flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-[#1d1d1f]">거래처 관리</h1>
          <p className="text-xs text-[#86868b] mt-0.5">공급업체·고객사 등록 및 관리</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[#007aff] text-white hover:bg-[#0066d6] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          거래처 등록
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {/* KPI */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: '전체 거래처', value: fmt(partners.length), unit: '개', color: 'text-[#1d1d1f]' },
            { label: '공급업체',   value: fmt(supplierCount),   unit: '개', color: 'text-[#007aff]' },
            { label: '고객사',     value: fmt(customerCount),   unit: '개', color: 'text-[#34c759]' },
            { label: '총 신용한도', value: fmt(totalCredit),    unit: '원', color: 'text-[#ff9f0a]' },
          ].map(kpi => (
            <div key={kpi.label} className="bg-white/80 backdrop-blur-xl border border-black/[0.06] rounded-2xl p-4">
              <p className="text-xs text-[#86868b]">{kpi.label}</p>
              <p className={`text-2xl font-semibold mt-1 ${kpi.color}`}>
                {kpi.value}
                <span className="text-sm font-normal text-[#86868b] ml-1">{kpi.unit}</span>
              </p>
            </div>
          ))}
        </div>

        {/* 필터 + 뷰 모드 */}
        <div className="bg-white/80 backdrop-blur-xl border border-black/[0.06] rounded-2xl px-4 py-3 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            {/* 유형 필터 */}
            <div className="inline-flex bg-gray-100 rounded-lg p-0.5">
              {([
                ['all', '전체'],
                ['supplier', '공급업체'],
                ['customer', '고객사'],
                ['both', '양방향'],
              ] as const).map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => { setTypeFilter(v); setCurrentPage(1); setKeyword('') }}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                    typeFilter === v ? 'bg-white shadow-sm text-[#1d1d1f]' : 'text-[#86868b] hover:text-[#1d1d1f]'
                  }`}
                >
                  {l}
                  {v !== 'all' && (
                    <span className="ml-1 text-[10px] text-[#86868b]">
                      ({v === 'supplier' ? supplierCount : v === 'customer' ? customerCount : bothCount})
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* 뷰 모드 */}
            <div className="inline-flex bg-gray-100 rounded-lg p-0.5">
              {([
                { mode: 'table' as const, label: '표',   icon: <TableIcon /> },
                { mode: 'list'  as const, label: '목록', icon: <ListIcon />  },
                { mode: 'card'  as const, label: '카드', icon: <CardIcon />  },
              ]).map(v => (
                <button
                  key={v.mode}
                  onClick={() => setViewMode(v.mode)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                    viewMode === v.mode ? 'bg-white text-[#1d1d1f] shadow-sm' : 'text-[#86868b] hover:text-[#1d1d1f]'
                  }`}
                >
                  {v.icon}{v.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#86868b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="거래처명, 전화, 이메일, 사업자번호 검색"
                value={keyword}
                onChange={e => { setKeyword(e.target.value); setCurrentPage(1) }}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-gray-200/60 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {keyword && (
              <button
                onClick={() => { setKeyword(''); setCurrentPage(1) }}
                className="text-xs text-[#007aff] hover:text-[#0066d6] transition-colors"
              >
                초기화
              </button>
            )}

            <span className="text-xs text-[#86868b] ml-auto">{fmt(filtered.length)}개</span>
          </div>
        </div>

        {/* 목록 */}
        <div className="bg-white/80 backdrop-blur-xl border border-black/[0.06] rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-48 text-sm text-[#86868b]">불러오는 중…</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2">
              <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <p className="text-sm text-[#86868b]">거래처가 없습니다.</p>
              <button onClick={openNew} className="text-xs text-[#007aff] hover:text-[#0066d6]">거래처 등록하기</button>
            </div>
          ) : (
            <>
              {viewMode === 'table' && <PartnerTableView partners={paginated} onSelect={openEdit} />}
              {viewMode === 'list'  && <PartnerListView  partners={paginated} onSelect={openEdit} />}
              {viewMode === 'card'  && <PartnerCardView  partners={paginated} onSelect={openEdit} />}

              <Pagination
                total={filtered.length}
                currentPage={currentPage}
                pageSize={pageSize}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                onPageSizeChange={s => { setPageSize(s as PageSize); setCurrentPage(1) }}
              />
            </>
          )}
        </div>
      </div>

      {showForm && (
        <PartnerFormModal
          partner={editPartner}
          onClose={() => { setShowForm(false); setEditPartner(null) }}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}

// ── 페이지네이션 ────────────────────────────────────────────────
interface PaginationProps {
  total: number; currentPage: number; pageSize: number
  totalPages: number
  onPageChange: (p: number) => void
  onPageSizeChange: (s: number) => void
}

function Pagination({ total, currentPage, pageSize, totalPages, onPageChange, onPageSizeChange }: PaginationProps) {
  const start = (currentPage - 1) * pageSize + 1
  const end   = Math.min(currentPage * pageSize, total)

  const pages: (number | '...')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (currentPage > 3) pages.push('...')
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i)
    if (currentPage < totalPages - 2) pages.push('...')
    pages.push(totalPages)
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
      <div className="flex items-center gap-3">
        <span className="text-xs text-[#86868b]">총 {fmt(total)}개 ({start}–{end})</span>
        <select
          value={pageSize}
          onChange={e => onPageSizeChange(Number(e.target.value))}
          className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white focus:outline-none"
        >
          {[10, 50, 100].map(s => <option key={s} value={s}>{s}개씩</option>)}
        </select>
      </div>

      <div className="flex items-center gap-1">
        <NavBtn onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>‹</NavBtn>
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`d${i}`} className="w-7 h-7 flex items-center justify-center text-xs text-[#86868b]">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p as number)}
              className={`w-7 h-7 flex items-center justify-center rounded-md text-xs transition-colors ${
                p === currentPage ? 'bg-[#007aff] text-white' : 'text-[#86868b] hover:bg-gray-100'
              }`}
            >
              {p}
            </button>
          )
        )}
        <NavBtn onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}>›</NavBtn>
      </div>
    </div>
  )
}

function NavBtn({ onClick, disabled, children }: { onClick: () => void; disabled: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick} disabled={disabled}
      className="w-7 h-7 flex items-center justify-center rounded-md text-sm text-[#86868b] hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      {children}
    </button>
  )
}

// ── 아이콘 ──────────────────────────────────────────────────────
function TableIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M10 3v18M6 3h12a3 3 0 013 3v12a3 3 0 01-3 3H6a3 3 0 01-3-3V6a3 3 0 013-3z" />
    </svg>
  )
}
function ListIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  )
}
function CardIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  )
}
