'use client'

import { useEffect, useState, useCallback } from 'react'
import { useBusinessStore } from '@/store/businessStore'
import { fetchChannelOrders, fetchOrderStats } from '@/lib/supabase/orders'
import { createClient } from '@/lib/supabase/client'
import type { OrderStats } from '@/lib/supabase/orders'
import { toast } from 'sonner'
import OrderDetailPanel from './OrderDetailPanel'
import OrderTableView from './OrderTableView'
import OrderListView from './OrderListView'
import OrderCardView from './OrderCardView'
import type { Order } from './types'
import { fmt } from './types'

type ViewMode = 'table' | 'list' | 'card'
type PageSize = 10 | 50 | 100

const STATUS_TABS = [
  { value: 'all',       label: '전체' },
  { value: 'paid',      label: '결제완료' },
  { value: 'shipping',  label: '배송중' },
  { value: 'delivered', label: '배송완료' },
  { value: 'confirmed', label: '구매확정' },
  { value: 'cancelled', label: '취소/반품' },
]

const today   = () => new Date().toISOString().slice(0, 10)
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }

export default function OrdersPage() {
  const { selectedBusinessId } = useBusinessStore()

  const [orders,   setOrders]   = useState<Order[]>([])
  const [stats,    setStats]    = useState<OrderStats | null>(null)
  const [channels, setChannels] = useState<{ id: string; name: string }[]>([])
  const [loading,  setLoading]  = useState(true)
  const [syncing,  setSyncing]  = useState(false)
  const [selected, setSelected] = useState<Order | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('table')

  // ── 필터 ──────────────────────────────────────────────────
  const [status,    setStatus]    = useState('all')
  const [channelId, setChannelId] = useState('')
  const [from,      setFrom]      = useState(daysAgo(90))
  const [to,        setTo]        = useState(today())
  const [search,    setSearch]    = useState('')

  // ── 페이지네이션 ──────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize,    setPageSize]    = useState<PageSize>(50)

  const totalPages      = Math.max(1, Math.ceil(orders.length / pageSize))
  const paginatedOrders = orders.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // 채널 목록 로드
  useEffect(() => {
    createClient()
      .from('channels')
      .select('id, name')
      .order('sort_order')
      .then(({ data }) => { if (data) setChannels(data) })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setCurrentPage(1)
    try {
      const [rows, st] = await Promise.all([
        fetchChannelOrders({
          businessId: selectedBusinessId,
          status,
          channelId: channelId || undefined,
          from:      from      || undefined,
          to:        to        || undefined,
          search:    search    || undefined,
        }),
        fetchOrderStats(selectedBusinessId),
      ])
      setOrders(rows as Order[])
      setStats(st)
    } catch {
      toast.error('주문 데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [selectedBusinessId, status, channelId, from, to, search])

  useEffect(() => { load() }, [load])
  useEffect(() => { setCurrentPage(1) }, [pageSize])

  async function handleSync(days: number) {
    setSyncing(true)
    try {
      const res  = await fetch('/api/channels/sync-orders', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ days }),
      })
      const data = await res.json() as { synced: number; errors: string[] }
      if (data.errors.length > 0) {
        toast.error(`동기화 오류: ${data.errors[0]}`)
      } else {
        toast.success(`${data.synced}건 동기화 완료`)
        load()
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '동기화 요청에 실패했습니다.')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="p-6 space-y-5">

      {/* ── 헤더 ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#1d1d1f]">통합 주문</h1>
          <p className="text-sm text-[#86868b] mt-0.5">네이버 스마트스토어 주문 현황</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSync(1)} disabled={syncing}
            className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-all disabled:opacity-50"
          >
            <SyncIcon spinning={syncing} />
            {syncing ? '동기화 중...' : '1일 동기화'}
          </button>
          <button
            onClick={() => handleSync(7)} disabled={syncing}
            className="px-3.5 py-2 text-sm font-medium bg-[#007aff] text-white rounded-lg hover:bg-[#0066d6] transition-all disabled:opacity-50"
          >
            7일 동기화
          </button>
        </div>
      </div>

      {/* ── KPI ───────────────────────────────────────────── */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: '30일 총 주문', value: stats?.total     ?? 0, color: 'text-[#1d1d1f]' },
          { label: '결제완료',     value: stats?.paid      ?? 0, color: 'text-green-600' },
          { label: '배송중',       value: stats?.shipping  ?? 0, color: 'text-blue-600' },
          { label: '배송완료',     value: stats?.delivered ?? 0, color: 'text-emerald-600' },
          { label: '취소/반품',    value: stats?.cancelled ?? 0, color: 'text-red-600' },
        ].map(k => (
          <div key={k.label} className="bg-white/80 backdrop-blur-xl border border-black/[0.06] rounded-2xl p-4">
            <p className="text-xs text-[#86868b]">{k.label}</p>
            <p className={`text-2xl font-semibold mt-1 tabular-nums ${k.color}`}>{fmt(k.value)}</p>
            <p className="text-xs text-[#86868b]">건</p>
          </div>
        ))}
      </div>

      {/* ── 필터 ──────────────────────────────────────────── */}
      <div className="bg-white/80 backdrop-blur-xl border border-black/[0.06] rounded-2xl p-4 space-y-3">
        {/* Row 1: 상태 세그먼트 + 뷰 모드 */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="inline-flex bg-gray-100 rounded-lg p-0.5">
            {STATUS_TABS.map(t => (
              <button
                key={t.value}
                onClick={() => setStatus(t.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                  status === t.value ? 'bg-white text-[#1d1d1f] shadow-sm' : 'text-[#86868b] hover:text-[#1d1d1f]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* 뷰 모드 선택 */}
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

        {/* Row 2: 채널 + 날짜 + 검색 */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 채널 필터 */}
          {channels.length > 0 && (
            <select
              value={channelId}
              onChange={e => setChannelId(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">전체 채널</option>
              {channels.map(ch => (
                <option key={ch.id} value={ch.id}>{ch.name}</option>
              ))}
            </select>
          )}

          {/* 날짜 */}
          <div className="flex items-center gap-2">
            <input
              type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <span className="text-xs text-[#86868b]">~</span>
            <input
              type="date" value={to} onChange={e => setTo(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <button
              onClick={() => { setFrom(''); setTo('') }}
              className="text-xs text-[#86868b] hover:text-[#1d1d1f] px-2.5 py-1.5 rounded-lg border border-transparent hover:border-gray-200 hover:bg-gray-50 transition-all"
            >
              전체 기간
            </button>
          </div>

          {/* 검색 */}
          <input
            type="text"
            placeholder="주문번호 · 구매자 · 상품명 검색"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </div>

      {/* ── 주문 목록 ──────────────────────────────────────── */}
      <div className="bg-white/80 backdrop-blur-xl border border-black/[0.06] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-[#86868b]">불러오는 중...</div>
        ) : orders.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {viewMode === 'table' && <OrderTableView orders={paginatedOrders} onSelect={setSelected} />}
            {viewMode === 'list'  && <OrderListView  orders={paginatedOrders} onSelect={setSelected} />}
            {viewMode === 'card'  && <OrderCardView  orders={paginatedOrders} onSelect={setSelected} />}

            <Pagination
              total={orders.length}
              currentPage={currentPage}
              pageSize={pageSize}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              onPageSizeChange={(s) => setPageSize(s as PageSize)}
            />
          </>
        )}
      </div>

      {selected && <OrderDetailPanel order={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

// ── 빈 상태 ────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-2">
      <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
      <p className="text-sm text-[#86868b]">주문이 없습니다.</p>
      <p className="text-xs text-[#86868b]">동기화 버튼을 눌러 네이버 주문을 가져오세요.</p>
    </div>
  )
}

// ── 페이지네이션 ────────────────────────────────────────────
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
        <span className="text-xs text-[#86868b]">
          총 {fmt(total)}건 ({start}–{end})
        </span>
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

// ── 아이콘 ──────────────────────────────────────────────────
function SyncIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg className={`w-3.5 h-3.5 ${spinning ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  )
}
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
