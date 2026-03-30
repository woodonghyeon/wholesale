'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/ui/PageHeader'
import Modal from '@/components/ui/Modal'
import { useBusinessStore } from '@/store/businessStore'
import { formatMoney } from '@/lib/utils/format'

// ── 타입 ──────────────────────────────────────────────────────
interface Channel {
  id: string
  name: string
  platform_type: string | null
  commission_rate: number | null
}

interface MappingRow {
  mapping_id: string
  product_id: string
  product_name: string
  product_image: string | null
  platform_product_id: string
  channel_price: number | null
  sync_price: boolean
  sync_inventory: boolean
  last_synced_at: string | null
  last_sync_status: 'success' | 'failed' | 'pending' | null
  last_sync_error: string | null
  combination_count: number
}

interface PlatformProduct {
  platformProductId: string
  name: string
  price: number
  isMapped: boolean
  mappedTo: { product_id: string; product_name: string } | null
}

interface LocalProduct {
  id: string
  name: string
  sell_price: number
}

// ── 상수 ──────────────────────────────────────────────────────
const PAGE_SIZE = 20

const PLATFORM_LABELS: Record<string, { label: string; color: string }> = {
  naver:   { label: '네이버 스마트스토어', color: 'bg-green-500' },
  '11st':  { label: '11번가',             color: 'bg-red-500'   },
  gmarket: { label: 'G마켓',              color: 'bg-yellow-500'},
  auction: { label: '옥션',               color: 'bg-orange-500'},
  own:     { label: '자사몰',             color: 'bg-blue-500'  },
  offline: { label: '오프라인',           color: 'bg-gray-500'  },
}

// ── 유틸 컴포넌트 ──────────────────────────────────────────────
function StatusBadge({ status, error }: { status: string | null; error?: string | null }) {
  if (!status) return <span className="text-xs text-gray-300">미동기화</span>
  if (status === 'success') return <span className="text-xs text-green-600 font-medium">✓ 성공</span>
  if (status === 'failed')  return <span className="text-xs text-red-500 font-medium" title={error ?? ''}>✗ 실패</span>
  return <span className="text-xs text-yellow-500">⏳ 대기</span>
}

function formatRelativeTime(iso: string | null) {
  if (!iso) return '-'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return '방금 전'
  if (mins < 60) return `${mins}분 전`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}시간 전`
  return `${Math.floor(hrs / 24)}일 전`
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────
export default function ChannelSyncPage() {
  const { selectedBusinessId } = useBusinessStore()

  const [channels, setChannels]                   = useState<Channel[]>([])
  const [selectedChannelId, setSelectedChannelId] = useState<string>('')
  const [mappings, setMappings]                   = useState<MappingRow[]>([])
  const [loadingMappings, setLoadingMappings]     = useState(false)
  const [bulkSyncing, setBulkSyncing]             = useState(false)
  const [syncingIds, setSyncingIds]               = useState<Set<string>>(new Set())

  // 검색 + 페이지네이션
  const [search, setSearch] = useState('')
  const [page, setPage]     = useState(1)

  // 채널가격 인라인 편집
  const [editPriceId, setEditPriceId]   = useState<string | null>(null)
  const [editPriceVal, setEditPriceVal] = useState('')

  // 플랫폼 ID 인라인 편집
  const [editPidId, setEditPidId]   = useState<string | null>(null)
  const [editPidVal, setEditPidVal] = useState('')

  // 진단 모달
  const [diagnoseModalOpen, setDiagnoseModalOpen] = useState(false)
  const [diagnoseMappingId, setDiagnoseMappingId] = useState<string | null>(null)
  const [diagnosing, setDiagnosing]               = useState(false)
  const [diagnoseResult, setDiagnoseResult]       = useState<any>(null)

  // 플랫폼 상품 불러오기 모달
  const [importModalOpen, setImportModalOpen]     = useState(false)
  const [platformProducts, setPlatformProducts]   = useState<PlatformProduct[]>([])
  const [localProducts, setLocalProducts]         = useState<LocalProduct[]>([])
  const [importLoading, setImportLoading]         = useState(false)
  const [importSearch, setImportSearch]           = useState('')
  const [matchMap, setMatchMap]                   = useState<Record<string, string>>({})
  const [savingImport, setSavingImport]           = useState(false)

  // ── 채널 목록 로드 ──────────────────────────────────────────
  useEffect(() => {
    fetch('/api/channels/list')
      .then(r => r.json())
      .then((data: Channel[]) => {
        const filtered = (Array.isArray(data) ? data : []).filter(
          c => c.platform_type && c.platform_type !== 'offline'
        )
        setChannels(filtered)
        if (filtered.length > 0) setSelectedChannelId(filtered[0].id)
      })
      .catch(() => toast.error('채널 목록 조회 실패'))
  }, [])

  // ── 매핑 목록 로드 ──────────────────────────────────────────
  const loadMappings = useCallback(async () => {
    if (!selectedChannelId) return
    setLoadingMappings(true)
    try {
      const params = new URLSearchParams({ channel_id: selectedChannelId })
      if (selectedBusinessId && selectedBusinessId !== 'all') {
        params.set('business_id', selectedBusinessId)
      }
      const res  = await fetch(`/api/channels/mappings/by-channel?${params}`)
      const data = await res.json()
      setMappings(Array.isArray(data) ? data : [])
      setPage(1)
    } catch {
      toast.error('매핑 목록 조회 실패')
    } finally {
      setLoadingMappings(false)
    }
  }, [selectedChannelId, selectedBusinessId])

  useEffect(() => { loadMappings() }, [loadMappings])

  // 채널 변경 시 검색어·페이지 초기화
  useEffect(() => { setSearch(''); setPage(1) }, [selectedChannelId])

  // ── 검색 필터 + 페이지네이션 ────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return mappings
    return mappings.filter(m =>
      m.product_name.toLowerCase().includes(q) ||
      m.platform_product_id.toLowerCase().includes(q)
    )
  }, [mappings, search])

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paged       = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const pageNumbers = useMemo(() => {
    const pages: (number | string)[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (currentPage > 3) pages.push('...')
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i)
      if (currentPage < totalPages - 2) pages.push('...')
      pages.push(totalPages)
    }
    return pages
  }, [currentPage, totalPages])

  // 검색 변경 시 페이지 1로 리셋
  useEffect(() => { setPage(1) }, [search])

  // ── 개별 동기화 ─────────────────────────────────────────────
  async function syncOne(productId: string) {
    setSyncingIds(prev => new Set(prev).add(productId))
    try {
      const res  = await fetch('/api/channels/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId }),
      })
      const data = await res.json()
      if (data.success) toast.success('동기화 완료')
      else toast.error(`동기화 실패: ${data.results?.find((r: any) => !r.success)?.error ?? '알 수 없는 오류'}`)
      await loadMappings()
    } catch {
      toast.error('동기화 요청 실패')
    } finally {
      setSyncingIds(prev => { const s = new Set(prev); s.delete(productId); return s })
    }
  }

  // ── 전체 일괄 동기화 ─────────────────────────────────────────
  async function bulkSync() {
    if (!selectedChannelId) return
    setBulkSyncing(true)
    try {
      const res  = await fetch('/api/channels/bulk-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel_id: selectedChannelId }),
      })
      const data = await res.json()
      if (data.failed_count === 0) {
        toast.success(`전체 동기화 완료 (${data.success_count}개)`)
      } else {
        toast.warning(`동기화 완료 — 성공 ${data.success_count}개 / 실패 ${data.failed_count}개`)
      }
      await loadMappings()
    } catch {
      toast.error('일괄 동기화 실패')
    } finally {
      setBulkSyncing(false)
    }
  }

  // ── 채널가격 저장 ────────────────────────────────────────────
  async function savePriceEdit(mappingId: string) {
    const price = editPriceVal === '' ? null : parseInt(editPriceVal)
    if (editPriceVal !== '' && isNaN(price!)) { toast.error('올바른 숫자를 입력하세요'); return }
    try {
      const res  = await fetch('/api/channels/mappings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: mappingId, channel_price: price }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      toast.success('채널가격 저장됨')
      setMappings(prev => prev.map(m =>
        m.mapping_id === mappingId ? { ...m, channel_price: price } : m
      ))
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setEditPriceId(null)
    }
  }

  // ── 동기화 플래그 토글 ───────────────────────────────────────
  async function toggleFlag(mappingId: string, field: 'sync_price' | 'sync_inventory', value: boolean) {
    try {
      await fetch('/api/channels/mappings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: mappingId, [field]: value }),
      })
      setMappings(prev => prev.map(m =>
        m.mapping_id === mappingId ? { ...m, [field]: value } : m
      ))
    } catch {
      toast.error('설정 변경 실패')
    }
  }

  // ── 플랫폼 ID 수정 ──────────────────────────────────────────
  async function savePidEdit(mappingId: string) {
    const val = editPidVal.trim()
    if (!val) { toast.error('ID를 입력하세요'); return }
    try {
      const res  = await fetch('/api/channels/mappings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: mappingId, platform_product_id: val }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      toast.success('플랫폼 ID 수정됨')
      setMappings(prev => prev.map(m =>
        m.mapping_id === mappingId ? { ...m, platform_product_id: val } : m
      ))
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setEditPidId(null)
    }
  }

  // ── 진단 실행 ────────────────────────────────────────────────
  async function runDiagnose(mappingId: string) {
    setDiagnoseMappingId(mappingId)
    setDiagnoseModalOpen(true)
    setDiagnoseResult(null)
    setDiagnosing(true)
    try {
      const bizParam = selectedBusinessId && selectedBusinessId !== 'all'
        ? `&business_id=${selectedBusinessId}` : ''
      const res  = await fetch(`/api/channels/diagnose?mapping_id=${mappingId}${bizParam}`)
      const data = await res.json()
      setDiagnoseResult(data)

      // 자동 보정 가능하면 즉시 적용
      if (data.success && data.resolved_id) {
        const stored = mappings.find(m => m.mapping_id === mappingId)?.platform_product_id
        if (stored && data.resolved_id !== stored) {
          await fetch('/api/channels/mappings', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: mappingId, platform_product_id: data.resolved_id }),
          })
          setMappings(prev => prev.map(m =>
            m.mapping_id === mappingId ? { ...m, platform_product_id: data.resolved_id } : m
          ))
          toast.success(`ID 자동 보정: ${stored} → ${data.resolved_id}`)
        }
      }
    } catch (e: any) {
      setDiagnoseResult({ error: e.message })
    } finally {
      setDiagnosing(false)
    }
  }

  // ── 매핑 삭제 ────────────────────────────────────────────────
  async function deleteMapping(mappingId: string) {
    if (!confirm('이 매핑을 삭제하시겠습니까?')) return
    try {
      await fetch(`/api/channels/mappings?id=${mappingId}`, { method: 'DELETE' })
      setMappings(prev => prev.filter(m => m.mapping_id !== mappingId))
      toast.success('매핑 삭제됨')
    } catch {
      toast.error('삭제 실패')
    }
  }

  // ── 플랫폼 상품 불러오기 모달 열기 ──────────────────────────
  async function openImportModal() {
    setImportModalOpen(true)
    setImportLoading(true)
    setMatchMap({})
    setImportSearch('')
    try {
      const bizParam = selectedBusinessId && selectedBusinessId !== 'all'
        ? `&business_id=${selectedBusinessId}` : ''
      const [platformRes, productRes] = await Promise.all([
        fetch(`/api/channels/platform-products?channel_id=${selectedChannelId}${bizParam}`),
        fetch(`/api/products/list?business_id=${selectedBusinessId ?? 'all'}`),
      ])
      const platformData = await platformRes.json()
      const productData  = await productRes.json()
      const ppList: PlatformProduct[] = platformData.products ?? []
      const lpList: LocalProduct[]    = Array.isArray(productData) ? productData : (productData.data ?? [])
      setPlatformProducts(ppList)
      setLocalProducts(lpList)

      // 이름 기반 자동 매칭
      const autoMatch: Record<string, string> = {}
      for (const pp of ppList) {
        if (pp.isMapped) continue
        const matched = lpList.find(
          lp => lp.name === pp.name || lp.name.includes(pp.name) || pp.name.includes(lp.name)
        )
        if (matched) autoMatch[pp.platformProductId] = matched.id
      }
      setMatchMap(autoMatch)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setImportLoading(false)
    }
  }

  // ── 매핑 일괄 저장 ───────────────────────────────────────────
  async function saveImport() {
    const toSave = Object.entries(matchMap).filter(([, id]) => !!id)
    if (!toSave.length) { toast.error('매핑할 항목을 선택하세요'); return }
    setSavingImport(true)
    try {
      const bizId = selectedBusinessId && selectedBusinessId !== 'all' ? selectedBusinessId : undefined
      const mappingsToSave = toSave.map(([platformProductId, productId]) => ({
        product_id: productId,
        channel_id: selectedChannelId,
        platform_product_id: platformProductId,
        business_id: bizId ?? null,
        sync_price: true,
        sync_inventory: true,
      }))
      const res  = await fetch('/api/channels/mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings: mappingsToSave }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      toast.success(`${toSave.length}개 매핑 저장 완료`)
      setImportModalOpen(false)
      await loadMappings()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSavingImport(false)
    }
  }

  // ── 통계 ─────────────────────────────────────────────────────
  const stats = {
    total:     mappings.length,
    success:   mappings.filter(m => m.last_sync_status === 'success').length,
    failed:    mappings.filter(m => m.last_sync_status === 'failed').length,
    notSynced: mappings.filter(m => !m.last_sync_status).length,
  }

  const selectedChannel = channels.find(c => c.id === selectedChannelId)
  const filteredImport  = platformProducts.filter(p =>
    p.name.toLowerCase().includes(importSearch.toLowerCase()) ||
    p.platformProductId.includes(importSearch)
  )
  const unmappedCount = platformProducts.filter(p => !p.isMapped).length

  // ── 렌더 ──────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-full">
      <PageHeader
        title="채널 연동 관리"
        description="판매 채널별 상품 가격·재고를 동기화합니다"
      />

      {channels.length === 0 ? (
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <p className="text-sm text-yellow-700 font-medium">연동 가능한 채널이 없습니다</p>
          <p className="text-xs text-yellow-600 mt-1">
            기준정보 설정 → 판매채널에서 플랫폼 유형을 선택해주세요
          </p>
        </div>
      ) : (
        <>
          {/* ── 채널 탭 ──────────────────────────────────────── */}
          <div className="flex gap-1 mt-6 border-b border-gray-200">
            {channels.map(ch => {
              const info = PLATFORM_LABELS[ch.platform_type ?? '']
              return (
                <button
                  key={ch.id}
                  onClick={() => setSelectedChannelId(ch.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    selectedChannelId === ch.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${info?.color ?? 'bg-gray-400'}`} />
                  {ch.name}
                </button>
              )
            })}
          </div>

          {/* ── 통계 + 검색 + 액션 바 ────────────────────────── */}
          <div className="flex items-center justify-between mt-5 gap-3">
            {/* 좌측: 통계 */}
            <div className="flex items-center gap-4 shrink-0">
              <StatChip label="전체"    value={stats.total}     color="text-gray-700" />
              <StatChip label="성공"    value={stats.success}   color="text-green-600" />
              <StatChip label="실패"    value={stats.failed}    color="text-red-500" />
              <StatChip label="미동기화" value={stats.notSynced} color="text-gray-400" />
            </div>

            {/* 중앙: 검색 */}
            <div className="relative flex-1 max-w-xs">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <input
                type="text"
                placeholder="상품명 또는 플랫폼 ID 검색…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">✕</button>
              )}
            </div>

            {/* 우측: 액션 */}
            <div className="flex gap-2 shrink-0">
              <button
                onClick={openImportModal}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700"
              >
                📥 플랫폼 상품 불러오기
              </button>
              <button
                onClick={bulkSync}
                disabled={bulkSyncing || mappings.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {bulkSyncing
                  ? <><span className="animate-spin inline-block">⟳</span> 동기화 중…</>
                  : <>⟳ 전체 동기화 ({stats.total}개)</>
                }
              </button>
            </div>
          </div>

          {/* ── 매핑 테이블 ──────────────────────────────────── */}
          <div className="mt-4 bg-white border border-gray-100 rounded-xl overflow-hidden">
            {loadingMappings ? (
              <div className="py-16 text-center text-gray-400 text-sm">로딩 중…</div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center">
                {search ? (
                  <p className="text-gray-400 text-sm">"{search}" 검색 결과가 없습니다</p>
                ) : (
                  <>
                    <p className="text-gray-400 text-sm">매핑된 상품이 없습니다</p>
                    <p className="text-xs text-gray-300 mt-1">
                      [📥 플랫폼 상품 불러오기]로 일괄 매핑하거나 상품 관리에서 개별 설정하세요
                    </p>
                  </>
                )}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-4 py-3 font-medium text-gray-600 w-64">상품명</th>
                    <th className="px-4 py-3 font-medium text-gray-600">플랫폼 ID</th>
                    <th className="px-4 py-3 font-medium text-gray-600 w-36">채널 가격</th>
                    <th className="px-4 py-3 font-medium text-gray-600 text-center w-20">가격동기</th>
                    <th className="px-4 py-3 font-medium text-gray-600 text-center w-20">재고동기</th>
                    <th className="px-4 py-3 font-medium text-gray-600 w-28">마지막 동기화</th>
                    <th className="px-4 py-3 font-medium text-gray-600 w-20">상태</th>
                    <th className="px-4 py-3 font-medium text-gray-600 text-right w-32">액션</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paged.map(row => (
                    <tr key={row.mapping_id} className="hover:bg-gray-50 group">
                      {/* 상품명 */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {row.product_image
                            ? <img src={row.product_image} alt="" className="w-8 h-8 object-contain rounded bg-gray-50 shrink-0" />
                            : <div className="w-8 h-8 bg-gray-100 rounded shrink-0" />
                          }
                          <span className="font-medium text-gray-800 truncate max-w-[180px]" title={row.product_name}>
                            {row.product_name}
                          </span>
                        </div>
                      </td>

                      {/* 플랫폼 ID (인라인 편집) */}
                      <td className="px-4 py-3">
                        {editPidId === row.mapping_id ? (
                          <div className="flex items-center gap-1">
                            <input
                              value={editPidVal}
                              onChange={e => setEditPidVal(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter')  savePidEdit(row.mapping_id)
                                if (e.key === 'Escape') setEditPidId(null)
                              }}
                              className="w-32 border border-blue-300 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                              autoFocus
                            />
                            <button onClick={() => savePidEdit(row.mapping_id)} className="text-blue-600 text-xs hover:underline">저장</button>
                            <button onClick={() => setEditPidId(null)} className="text-gray-400 text-xs hover:underline">취소</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditPidId(row.mapping_id); setEditPidVal(row.platform_product_id) }}
                            className="text-gray-500 font-mono text-xs hover:text-blue-600 hover:underline"
                            title="클릭하여 수정"
                          >
                            {row.platform_product_id}
                          </button>
                        )}
                      </td>

                      {/* 채널 가격 인라인 편집 */}
                      <td className="px-4 py-3">
                        {editPriceId === row.mapping_id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={editPriceVal}
                              onChange={e => setEditPriceVal(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter')  savePriceEdit(row.mapping_id)
                                if (e.key === 'Escape') setEditPriceId(null)
                              }}
                              placeholder="기본가"
                              className="w-24 border border-blue-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                              autoFocus
                            />
                            <button onClick={() => savePriceEdit(row.mapping_id)} className="text-blue-600 text-xs hover:underline">저장</button>
                            <button onClick={() => setEditPriceId(null)} className="text-gray-400 text-xs hover:underline">취소</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditPriceId(row.mapping_id); setEditPriceVal(row.channel_price?.toString() ?? '') }}
                            className="text-left hover:underline"
                          >
                            {row.channel_price != null
                              ? <span className="text-blue-600 font-medium">{formatMoney(row.channel_price)}원</span>
                              : <span className="text-gray-400 text-xs">기본가</span>
                            }
                          </button>
                        )}
                      </td>

                      {/* 가격 동기화 토글 */}
                      <td className="px-4 py-3 text-center">
                        <Toggle value={row.sync_price} onChange={v => toggleFlag(row.mapping_id, 'sync_price', v)} />
                      </td>

                      {/* 재고 동기화 토글 */}
                      <td className="px-4 py-3 text-center">
                        <Toggle value={row.sync_inventory} onChange={v => toggleFlag(row.mapping_id, 'sync_inventory', v)} />
                      </td>

                      {/* 마지막 동기화 */}
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {formatRelativeTime(row.last_synced_at)}
                      </td>

                      {/* 상태 */}
                      <td className="px-4 py-3">
                        <StatusBadge status={row.last_sync_status} error={row.last_sync_error} />
                      </td>

                      {/* 액션 */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => syncOne(row.product_id)}
                            disabled={syncingIds.has(row.product_id)}
                            className="px-2.5 py-1 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 disabled:opacity-50"
                          >
                            {syncingIds.has(row.product_id) ? '…' : '동기화'}
                          </button>
                          <button
                            onClick={() => runDiagnose(row.mapping_id)}
                            className="px-2.5 py-1 text-xs text-yellow-600 bg-yellow-50 hover:bg-yellow-100 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                            title="ID 진단 및 자동 보정"
                          >
                            진단
                          </button>
                          <button
                            onClick={() => deleteMapping(row.mapping_id)}
                            className="px-2.5 py-1 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* ── 페이지네이션 ─────────────────────────────────── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-gray-400">
                {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} / 총 {filtered.length}개
                {search && <span className="ml-1 text-blue-500">(검색: "{search}")</span>}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-30 hover:bg-gray-50"
                >
                  ‹ 이전
                </button>
                {pageNumbers.map((n, i) =>
                  n === '...'
                    ? <span key={`dot-${i}`} className="px-1 text-gray-400 text-xs">…</span>
                    : <button
                        key={n}
                        onClick={() => setPage(n as number)}
                        className={`w-8 h-7 text-xs rounded-lg transition-colors ${
                          currentPage === n
                            ? 'bg-blue-600 text-white font-medium'
                            : 'border border-gray-200 hover:bg-gray-50 text-gray-600'
                        }`}
                      >{n}</button>
                )}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-30 hover:bg-gray-50"
                >
                  다음 ›
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── 플랫폼 상품 불러오기 모달 ─────────────────────────── */}
      <Modal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title={`📥 플랫폼 상품 불러오기 — ${selectedChannel?.name ?? ''}`}
        size="xl"
      >
        {importLoading ? (
          <div className="py-16 text-center text-gray-400">플랫폼에서 상품 목록을 불러오는 중…</div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500">
                총 <span className="font-medium text-gray-800">{platformProducts.length}</span>개 ·
                미연동 <span className="font-medium text-blue-600">{unmappedCount}</span>개
              </p>
              <input
                type="text"
                placeholder="상품명 또는 ID 검색…"
                value={importSearch}
                onChange={e => setImportSearch(e.target.value)}
                className="w-52 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="max-h-[420px] overflow-y-auto border border-gray-100 rounded-lg">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">플랫폼 상품명</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 w-28">판매가</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">연동할 내부 상품</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-600 w-20">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredImport.length === 0 ? (
                    <tr><td colSpan={4} className="px-3 py-8 text-center text-gray-400 text-sm">
                      {importSearch ? `"${importSearch}" 검색 결과 없음` : '상품이 없습니다'}
                    </td></tr>
                  ) : filteredImport.map(pp => (
                    <tr key={pp.platformProductId} className={pp.isMapped ? 'bg-gray-50 opacity-60' : ''}>
                      <td className="px-3 py-2">
                        <p className="font-medium text-gray-800 truncate max-w-[220px]" title={pp.name}>{pp.name}</p>
                        <p className="text-xs text-gray-400 font-mono">{pp.platformProductId}</p>
                      </td>
                      <td className="px-3 py-2 text-gray-600">{formatMoney(pp.price)}원</td>
                      <td className="px-3 py-2">
                        {pp.isMapped ? (
                          <span className="text-xs text-gray-500">{pp.mappedTo?.product_name ?? '연동됨'}</span>
                        ) : (
                          <select
                            value={matchMap[pp.platformProductId] ?? ''}
                            onChange={e => setMatchMap(prev => ({ ...prev, [pp.platformProductId]: e.target.value }))}
                            className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="">-- 선택 안 함 --</option>
                            {localProducts.map(lp => (
                              <option key={lp.id} value={lp.id}>{lp.name} ({formatMoney(lp.sell_price)}원)</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {pp.isMapped
                          ? <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">연동됨</span>
                          : matchMap[pp.platformProductId]
                            ? <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">매핑됨</span>
                            : <span className="text-xs text-gray-300">-</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-gray-400">선택된 매핑: {Object.values(matchMap).filter(Boolean).length}개</p>
              <div className="flex gap-2">
                <button onClick={() => setImportModalOpen(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">취소</button>
                <button
                  onClick={saveImport}
                  disabled={savingImport || Object.values(matchMap).filter(Boolean).length === 0}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingImport ? '저장 중…' : `매핑 저장 (${Object.values(matchMap).filter(Boolean).length}개)`}
                </button>
              </div>
            </div>
          </>
        )}
      </Modal>

      {/* ── 진단 모달 ──────────────────────────────────────────── */}
      <Modal
        open={diagnoseModalOpen}
        onClose={() => setDiagnoseModalOpen(false)}
        title="🔍 플랫폼 ID 진단"
        size="xl"
      >
        {diagnosing ? (
          <div className="py-12 text-center text-gray-400 text-sm">네이버 API 확인 중…</div>
        ) : diagnoseResult ? (
          <div className="space-y-4">
            {/* 결과 요약 */}
            {diagnoseResult.success ? (
              <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <span className="text-green-600 font-bold mt-0.5">✓</span>
                <div>
                  <p className="text-sm font-medium text-green-700">상품 조회 성공</p>
                  <p className="text-xs text-green-600 mt-0.5">
                    사용된 ID: <span className="font-mono font-bold">{diagnoseResult.resolved_id}</span>
                    {diagnoseResult.steps?.stored_platform_product_id !== diagnoseResult.resolved_id && (
                      <span className="ml-2 text-orange-600">
                        (저장된 ID <span className="font-mono">{diagnoseResult.steps?.stored_platform_product_id}</span>에서 자동 보정됨)
                      </span>
                    )}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <span className="text-red-500 font-bold mt-0.5">✗</span>
                <div>
                  <p className="text-sm font-medium text-red-700">상품을 찾을 수 없습니다</p>
                  <p className="text-xs text-red-600 mt-0.5">
                    저장된 ID: <span className="font-mono font-bold">{diagnoseResult.steps?.stored_platform_product_id}</span>
                  </p>
                </div>
              </div>
            )}

            {/* 단계별 결과 */}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">진단 단계</p>
              <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 text-xs font-mono max-h-64 overflow-y-auto">
                {Object.entries(diagnoseResult.steps ?? {}).map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <span className="text-gray-400 shrink-0">{k}:</span>
                    <span className={`text-gray-700 break-all ${
                      String(v).includes('"ok":true') || k.includes('result') ? 'text-green-700' :
                      String(v).includes('"ok":false') || k.includes('error') ? 'text-red-600' : ''
                    }`}>
                      {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 수동 ID 입력 */}
            {!diagnoseResult.success && (
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs text-gray-500 mb-2">
                  올바른 originProductNo를 직접 입력하여 수정할 수 있습니다
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="올바른 originProductNo 입력"
                    value={editPidVal}
                    onChange={e => setEditPidVal(e.target.value)}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={async () => {
                      if (!diagnoseMappingId || !editPidVal.trim()) return
                      await savePidEdit(diagnoseMappingId)
                      setDiagnoseModalOpen(false)
                    }}
                    className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    저장
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

// ── 서브 컴포넌트 ──────────────────────────────────────────────
function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-sm font-bold ${color}`}>{value}</span>
    </div>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${value ? 'bg-blue-500' : 'bg-gray-200'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${value ? 'translate-x-4' : 'translate-x-1'}`} />
    </button>
  )
}
