'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/ui/PageHeader'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import ImagePickerModal from '@/components/ui/ImagePickerModal'
import { SortableHeader, useSortable } from '@/components/ui/SortableHeader'
import { getProducts, upsertProduct, deleteProduct, mergeDuplicateProducts } from '@/lib/supabase/products'
import { getBusinesses } from '@/lib/supabase/businesses'
import { getChannels } from '@/lib/supabase/channels'
import { getProductOptions, saveProductOptions, type OptionGroupInput, type CombinationInput } from '@/lib/supabase/product-options'
import { Product, Business, Channel, ProductOptionCombination } from '@/lib/types'
import { formatMoney } from '@/lib/utils/format'

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const labelCls = 'block text-sm font-medium text-gray-700 mb-1'
const PAGE_SIZE_OPTIONS = [20, 50, 100]
type ViewMode = 'list' | 'card'
type ModalTab = 'info' | 'options' | 'channels'

// ── 옵션 관리 타입 ────────────────────────────────────
interface OptionGroupDraft {
  id?: string
  name: string
  values: { id?: string; text: string }[]
}
interface CombinationDraft {
  id?: string
  label: string
  valueRefs: [number, number][]  // [groupIdx, valueIdx]
  add_price: number
  sku: string
  is_active: boolean
}

// ── 채널 연동 타입 ────────────────────────────────────
interface MappingRow {
  id: string
  channel_id: string
  channel_name: string
  platform_type: string | null
  platform_product_id: string
  platform_option_id: string | null
  option_combination_id: string | null
  combination_label: string | null
  sync_price: boolean
  sync_inventory: boolean
  last_sync_status: string | null
  last_synced_at: string | null
  last_sync_error: string | null
}
interface AddMappingDraft {
  channelId: string
  platformProductId: string
  platformData: { name: string; price: number; options: { platformOptionId: string; label: string; inventory: number }[] } | null
  optionMappings: { platformOptionId: string; platformLabel: string; ourCombinationId: string }[]
  syncPrice: boolean
  syncInventory: boolean
  loading: boolean
}

// ── 유틸 ─────────────────────────────────────────────
function categoryColor(category: string | null | undefined) {
  if (!category) return 'bg-gray-100 text-gray-500'
  const map: Record<string, string> = {
    '필기도구': 'bg-blue-100 text-blue-700', '매직': 'bg-purple-100 text-purple-700',
    '보드마카': 'bg-indigo-100 text-indigo-700', '풀/접착제': 'bg-yellow-100 text-yellow-700',
    '종이접기': 'bg-pink-100 text-pink-700', '샤프': 'bg-cyan-100 text-cyan-700', '펜': 'bg-green-100 text-green-700',
  }
  for (const [key, cls] of Object.entries(map)) { if (category.includes(key)) return cls }
  return 'bg-gray-100 text-gray-600'
}

function platformBadge(type: string | null) {
  const map: Record<string, { label: string; cls: string }> = {
    naver: { label: '네이버', cls: 'bg-green-100 text-green-700' },
    '11st': { label: '11번가', cls: 'bg-red-100 text-red-700' },
    gmarket: { label: 'G마켓', cls: 'bg-yellow-100 text-yellow-700' },
    auction: { label: '옥션', cls: 'bg-orange-100 text-orange-700' },
    own: { label: '자사몰', cls: 'bg-blue-100 text-blue-700' },
  }
  const info = type ? map[type] : null
  if (!info) return <span className="text-xs text-gray-400">{type ?? '-'}</span>
  return <span className={`text-xs px-2 py-0.5 rounded-full ${info.cls}`}>{info.label}</span>
}

function syncStatusBadge(status: string | null) {
  if (!status) return <span className="text-xs text-gray-300">미동기화</span>
  if (status === 'success') return <span className="text-xs text-green-600 font-medium">✅ 성공</span>
  if (status === 'failed') return <span className="text-xs text-red-500 font-medium">❌ 실패</span>
  return <span className="text-xs text-yellow-500">⏳ 대기</span>
}

// ── 카테시안 곱(조합 자동 생성) ───────────────────────
function generateCombinations(groups: OptionGroupDraft[]): CombinationDraft[] {
  const nonEmpty = groups.map((g, gi) =>
    g.values
      .map((v, vi) => ({ text: v.text.trim(), gi, vi }))
      .filter(v => v.text)
  ).filter(vs => vs.length > 0)

  if (nonEmpty.length === 0) return []

  let result: { text: string; ref: [number, number] }[][] = [[]]
  for (const values of nonEmpty) {
    result = result.flatMap(prefix => values.map(v => [...prefix, { text: v.text, ref: [v.gi, v.vi] as [number, number] }]))
  }

  return result.map(combo => ({
    label: combo.map(c => c.text).join(' / '),
    valueRefs: combo.map(c => c.ref),
    add_price: 0,
    sku: '',
    is_active: true,
  }))
}

// ════════════════════════════════════════════════════
export default function ProductsPage() {
  // ── 기본 상태 ────────────────────────────────────
  const [products, setProducts] = useState<Product[]>([])
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [bizFilter, setBizFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<Partial<Product>>({})
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [pageSize, setPageSize] = useState(50)
  const [page, setPage] = useState(1)
  const [merging, setMerging] = useState(false)
  const [fetchingImages, setFetchingImages] = useState(false)
  const [fetchImageResult, setFetchImageResult] = useState<{ total: number; updated: number; failed: number } | null>(null)
  const [pickerTarget, setPickerTarget] = useState<Product | null>(null)

  // ── 모달 탭 상태 ─────────────────────────────────
  const [modalTab, setModalTab] = useState<ModalTab>('info')

  // ── 옵션 관리 상태 ───────────────────────────────
  const [hasOptions, setHasOptions] = useState(false)
  const [optionGroups, setOptionGroups] = useState<OptionGroupDraft[]>([])
  const [combinations, setCombinations] = useState<CombinationDraft[]>([])
  const [optionsLoading, setOptionsLoading] = useState(false)

  // ── 채널 연동 상태 ───────────────────────────────
  const [mappings, setMappings] = useState<MappingRow[]>([])
  const [mappingsLoading, setMappingsLoading] = useState(false)
  const [addMapping, setAddMapping] = useState<AddMappingDraft | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncConfirm, setSyncConfirm] = useState<{ productId: string } | null>(null)
  const [combinations4mapping, setCombinations4mapping] = useState<ProductOptionCombination[]>([])

  useEffect(() => { loadAll() }, [])
  useEffect(() => { setPage(1) }, [search, bizFilter, pageSize])

  async function loadAll() {
    setLoading(true)
    try {
      const [p, b, c] = await Promise.all([getProducts(), getBusinesses(), getChannels()])
      setProducts(p); setBusinesses(b); setChannels(c)
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setLoading(false) }
  }

  // ── 모달 열기 ─────────────────────────────────────
  function openEdit(p: Partial<Product>) {
    setEditItem(p)
    setModalTab('info')
    setHasOptions(false)
    setOptionGroups([])
    setCombinations([])
    setMappings([])
    setAddMapping(null)
    setModalOpen(true)

    if (p.id) {
      loadOptions(p.id)
      loadMappings(p.id)
    }
  }

  // ── 옵션 로드 ─────────────────────────────────────
  async function loadOptions(productId: string) {
    setOptionsLoading(true)
    try {
      const data = await getProductOptions(productId)
      if (data.groups.length > 0) {
        setHasOptions(true)
        setOptionGroups(data.groups.map(g => ({
          id: g.id,
          name: g.name,
          values: (g.values ?? []).map(v => ({ id: v.id, text: v.value })),
        })))
        setCombinations(data.combinations.map(c => ({
          id: c.id,
          label: c.label,
          valueRefs: [],
          add_price: c.add_price,
          sku: c.sku ?? '',
          is_active: c.is_active,
        })))
        // 채널 연동용 조합 목록 저장
        setCombinations4mapping(data.combinations)
      }
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setOptionsLoading(false) }
  }

  // ── 채널 매핑 로드 ────────────────────────────────
  async function loadMappings(productId: string) {
    setMappingsLoading(true)
    try {
      const res = await fetch(`/api/channels/mappings?product_id=${productId}`)
      const data = await res.json()
      setMappings((data ?? []).map((m: any) => ({
        id: m.id,
        channel_id: m.channel_id,
        channel_name: m.channel?.name ?? '-',
        platform_type: m.channel?.platform_type ?? null,
        platform_product_id: m.platform_product_id,
        platform_option_id: m.platform_option_id,
        option_combination_id: m.option_combination_id,
        combination_label: m.combination?.label ?? null,
        sync_price: m.sync_price,
        sync_inventory: m.sync_inventory,
        last_sync_status: m.last_sync_status,
        last_synced_at: m.last_synced_at,
        last_sync_error: m.last_sync_error,
      })))
    } catch { /* ignore */ }
    finally { setMappingsLoading(false) }
  }

  // ── 상품 저장 ─────────────────────────────────────
  async function save() {
    if (!editItem.name?.trim()) return toast.error('상품명을 입력해주세요')
    try {
      const saved = await upsertProduct({ unit: 'ea', buy_price: 0, sell_price: 0, min_stock: 0, is_bundle: false, ...editItem } as Product & { name: string })
      // 옵션 저장
      if (hasOptions && optionGroups.length > 0) {
        const groupInputs: OptionGroupInput[] = optionGroups.map(g => ({
          name: g.name,
          values: g.values.map(v => v.text).filter(Boolean),
        }))
        const comboInputs: CombinationInput[] = combinations.map(c => ({
          label: c.label,
          valueRefs: c.valueRefs,
          add_price: c.add_price,
          sku: c.sku,
          is_active: c.is_active,
        }))
        await saveProductOptions(saved.id, groupInputs, comboInputs)
      } else if (!hasOptions && editItem.id) {
        // 옵션 해제 → 기존 옵션 삭제
        await saveProductOptions(saved.id, [], [])
      }
      toast.success('저장되었습니다')
      setModalOpen(false); setEditItem({})
      setProducts(await getProducts())
    } catch (e: unknown) { toast.error((e as Error).message) }
  }

  // ── 옵션 그룹 관리 ────────────────────────────────
  function addOptionGroup() {
    setOptionGroups(prev => [...prev, { name: '', values: [{ text: '' }] }])
  }
  function updateGroupName(gi: number, name: string) {
    setOptionGroups(prev => prev.map((g, i) => i === gi ? { ...g, name } : g))
  }
  function removeGroup(gi: number) {
    setOptionGroups(prev => prev.filter((_, i) => i !== gi))
    setCombinations([])
  }
  function addValue(gi: number) {
    setOptionGroups(prev => prev.map((g, i) => i === gi ? { ...g, values: [...g.values, { text: '' }] } : g))
  }
  function updateValue(gi: number, vi: number, text: string) {
    setOptionGroups(prev => prev.map((g, i) => i === gi ? { ...g, values: g.values.map((v, j) => j === vi ? { ...v, text } : v) } : g))
  }
  function removeValue(gi: number, vi: number) {
    setOptionGroups(prev => prev.map((g, i) => i === gi ? { ...g, values: g.values.filter((_, j) => j !== vi) } : g))
    setCombinations([])
  }
  function handleGenerateCombinations() {
    const newCombos = generateCombinations(optionGroups)
    if (newCombos.length === 0) return toast.error('옵션값을 먼저 입력해주세요')
    setCombinations(newCombos)
  }
  function updateCombo(idx: number, field: 'add_price' | 'sku' | 'is_active', value: number | string | boolean) {
    setCombinations(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c))
  }

  // ── 채널 매핑: 플랫폼 상품 조회 ──────────────────
  async function lookupPlatformProduct() {
    if (!addMapping?.channelId || !addMapping.platformProductId) return toast.error('채널과 상품번호를 입력해주세요')
    setAddMapping(prev => prev ? { ...prev, loading: true, platformData: null } : prev)
    try {
      const params = new URLSearchParams({
        channel_id: addMapping.channelId,
        platform_product_id: addMapping.platformProductId,
        ...(editItem.id ? { product_id: editItem.id } : {}),
      })
      const res = await fetch(`/api/channels/preview?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const pd = data.platform
      setAddMapping(prev => prev ? {
        ...prev,
        loading: false,
        platformData: pd,
        optionMappings: pd.options.map((o: any) => ({
          platformOptionId: o.platformOptionId,
          platformLabel: o.label,
          ourCombinationId: '',
        })),
      } : prev)
    } catch (e: unknown) {
      toast.error((e as Error).message)
      setAddMapping(prev => prev ? { ...prev, loading: false } : prev)
    }
  }

  // ── 채널 매핑 저장 ────────────────────────────────
  async function saveChannelMapping() {
    if (!addMapping || !editItem.id) return
    const { channelId, platformProductId, platformData, optionMappings, syncPrice, syncInventory } = addMapping

    const mappingsToSave = platformData?.options.length
      ? optionMappings.map(om => ({
          product_id: editItem.id,
          option_combination_id: om.ourCombinationId || null,
          channel_id: channelId,
          platform_product_id: platformProductId,
          platform_option_id: om.platformOptionId,
          business_id: editItem.business_id ?? null,
          sync_price: syncPrice,
          sync_inventory: syncInventory,
        }))
      : [{
          product_id: editItem.id,
          option_combination_id: null,
          channel_id: channelId,
          platform_product_id: platformProductId,
          platform_option_id: null,
          business_id: editItem.business_id ?? null,
          sync_price: syncPrice,
          sync_inventory: syncInventory,
        }]

    try {
      const res = await fetch('/api/channels/mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings: mappingsToSave }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      toast.success('채널 연동이 저장되었습니다')
      setAddMapping(null)
      if (editItem.id) loadMappings(editItem.id)
    } catch (e: unknown) { toast.error((e as Error).message) }
  }

  // ── 채널 매핑 삭제 ────────────────────────────────
  async function deleteMapping(id: string) {
    try {
      const res = await fetch(`/api/channels/mappings?id=${id}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      if (editItem.id) loadMappings(editItem.id)
      toast.success('연동이 해제되었습니다')
    } catch (e: unknown) { toast.error((e as Error).message) }
  }

  // ── 동기화 실행 ───────────────────────────────────
  async function executeSyncForProduct(productId: string) {
    setSyncing(true)
    setSyncConfirm(null)
    try {
      const res = await fetch('/api/channels/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId }),
      })
      const data = await res.json()
      if (data.failed > 0) {
        toast.error(`${data.failed}개 채널 동기화 실패`)
      } else {
        toast.success(`${data.total}개 채널 동기화 완료`)
      }
      if (editItem.id) loadMappings(editItem.id)
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setSyncing(false) }
  }

  // ── 이미지·중복병합·삭제 ──────────────────────────
  async function handleImagePicked(product: Product, url: string) {
    try {
      await upsertProduct({ ...product, image_url: url || null })
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, image_url: url || null } : p))
      toast.success(url ? '이미지가 저장되었습니다' : '이미지가 제거되었습니다')
    } catch (e: unknown) { toast.error((e as Error).message) }
  }
  async function handleFetchImages() {
    setFetchingImages(true); setFetchImageResult(null)
    try {
      const res = await fetch('/api/products/fetch-images', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setFetchImageResult({ total: data.total, updated: data.updated, failed: data.failed })
      toast.success(`이미지 수집 완료: ${data.updated}개 성공`)
      setProducts(await getProducts())
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setFetchingImages(false) }
  }
  async function handleMergeDuplicates() {
    setMerging(true)
    try {
      const count = await mergeDuplicateProducts()
      toast.success(count === 0 ? '중복 상품이 없습니다' : `${count}개 중복 상품 병합`)
      setProducts(await getProducts())
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setMerging(false) }
  }
  async function handleDelete() {
    if (!confirmId) return
    try { await deleteProduct(confirmId); toast.success('삭제되었습니다'); setProducts(await getProducts()) }
    catch (e: unknown) { toast.error((e as Error).message) }
    finally { setConfirmId(null) }
  }

  // ── 필터·정렬·페이지네이션 ────────────────────────
  const filtered = useMemo(() => products.filter(p => {
    const matchBiz = bizFilter === 'all' || p.business_id === bizFilter
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode?.includes(search) || p.category?.includes(search) || false
    return matchBiz && matchSearch
  }), [products, bizFilter, search])
  const { sorted: sortedProducts, criteria: sortCriteria, toggle: sortToggle } = useSortable(filtered)
  const totalPages = Math.max(1, Math.ceil(sortedProducts.length / pageSize))
  const paginated = sortedProducts.slice((page - 1) * pageSize, page * pageSize)
  const bizName = (id: string | null) => businesses.find(b => b.id === id)?.name ?? '-'
  const channelsWithPlatform = channels.filter(c => c.platform_type)
  const pageNumbers = useMemo(() => {
    const pages: (number | '...')[] = []
    if (totalPages <= 7) { for (let i = 1; i <= totalPages; i++) pages.push(i) }
    else {
      pages.push(1)
      if (page > 3) pages.push('...')
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
      if (page < totalPages - 2) pages.push('...')
      pages.push(totalPages)
    }
    return pages
  }, [page, totalPages])

  // ── 탭 버튼 공통 스타일 ───────────────────────────
  const tabCls = (active: boolean) =>
    `px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${active ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`

  return (
    <div>
      <PageHeader
        title="상품 관리"
        description={`총 ${filtered.length}개${filtered.length !== products.length ? ` (전체 ${products.length}개)` : ''}`}
        action={
          <div className="flex gap-2">
            <button onClick={handleFetchImages} disabled={fetchingImages}
              title={fetchImageResult ? `총 ${fetchImageResult.total}개 중 ${fetchImageResult.updated}개 성공` : ''}
              className="px-4 py-2 bg-green-50 text-green-700 text-sm rounded-lg hover:bg-green-100 border border-green-200 disabled:opacity-50 flex items-center gap-1.5">
              {fetchingImages ? <><svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>수집 중...</> : '🖼️ 이미지 자동 수집'}
            </button>
            <button onClick={handleMergeDuplicates} disabled={merging}
              className="px-4 py-2 bg-orange-50 text-orange-700 text-sm rounded-lg hover:bg-orange-100 border border-orange-200 disabled:opacity-50">
              {merging ? '병합 중...' : '중복 상품 정리'}
            </button>
            <button onClick={() => { const biz = bizFilter !== 'all' ? `&businessId=${bizFilter}` : ''; window.open(`/api/pdf/price-list?${biz}`, '_blank') }}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 border border-gray-200">
              🖨️ 가격표 출력
            </button>
            <button onClick={() => openEdit({ unit: 'ea', buy_price: 0, sell_price: 0, min_stock: 0, is_bundle: false })}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
              + 상품 추가
            </button>
          </div>
        }
      />

      {/* ── 툴바 ────────────────── */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <input placeholder="상품명·바코드·카테고리 검색" value={search} onChange={e => setSearch(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-56" />
        <select value={bizFilter} onChange={e => setBizFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
          <option value="all">전체 사업자</option>
          {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-gray-400">페이지당</span>
          <div className="flex border border-gray-200 rounded-lg overflow-hidden">
            {PAGE_SIZE_OPTIONS.map(n => (
              <button key={n} onClick={() => setPageSize(n)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${pageSize === n ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{n}</button>
            ))}
          </div>
          <div className="flex border border-gray-200 rounded-lg overflow-hidden ml-1">
            <button onClick={() => setViewMode('list')} className={`px-3 py-1.5 text-xs transition-colors flex items-center gap-1 ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>리스트
            </button>
            <button onClick={() => setViewMode('card')} className={`px-3 py-1.5 text-xs transition-colors flex items-center gap-1 ${viewMode === 'card' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm8 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm8 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>카드
            </button>
          </div>
        </div>
      </div>

      {/* ── 콘텐츠 ────────────────── */}
      {loading ? (
        <div className="py-16 text-center text-sm text-gray-400">불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-gray-400 bg-white rounded-xl border border-gray-100">상품이 없습니다</div>
      ) : viewMode === 'list' ? (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>
                <th className="px-4 py-3 w-10" />
                <SortableHeader field="barcode" criteria={sortCriteria} onSort={sortToggle}>바코드</SortableHeader>
                <SortableHeader field="name" criteria={sortCriteria} onSort={sortToggle}>상품명</SortableHeader>
                <SortableHeader field="category" criteria={sortCriteria} onSort={sortToggle}>카테고리</SortableHeader>
                <SortableHeader field="unit" criteria={sortCriteria} onSort={sortToggle}>단위</SortableHeader>
                <SortableHeader field="buy_price" criteria={sortCriteria} onSort={sortToggle} align="right">매입가</SortableHeader>
                <SortableHeader field="sell_price" criteria={sortCriteria} onSort={sortToggle} align="right">판매가</SortableHeader>
                <SortableHeader field="min_stock" criteria={sortCriteria} onSort={sortToggle} align="right">안전재고</SortableHeader>
                <SortableHeader field="business_id" criteria={sortCriteria} onSort={sortToggle}>사업자</SortableHeader>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginated.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 group">
                  <td className="pl-3 pr-1 py-2 w-10">
                    <button onClick={() => setPickerTarget(p)} title="이미지 변경" className="group/img relative block">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="w-9 h-9 object-contain rounded-lg border border-gray-100 bg-gray-50 group-hover/img:opacity-70 transition-opacity" />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-300 text-lg group-hover/img:bg-blue-50 group-hover/img:border-blue-200 transition-colors">+</div>
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">{p.barcode ?? '-'}</td>
                  <td className="px-4 py-3 font-medium">{p.name}{p.is_bundle && <span className="ml-1.5 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">묶음</span>}</td>
                  <td className="px-4 py-3">{p.category ? <span className={`text-xs px-2 py-0.5 rounded-full ${categoryColor(p.category)}`}>{p.category}</span> : <span className="text-gray-300">-</span>}</td>
                  <td className="px-4 py-3 text-gray-500">{p.unit}</td>
                  <td className="px-4 py-3 text-gray-600">{formatMoney(p.buy_price)}원</td>
                  <td className="px-4 py-3 font-medium text-blue-600">{formatMoney(p.sell_price)}원</td>
                  <td className="px-4 py-3"><span className={p.min_stock > 0 ? 'text-orange-600 font-medium' : 'text-gray-300'}>{p.min_stock > 0 ? p.min_stock : '-'}</span></td>
                  <td className="px-4 py-3 text-gray-500">{bizName(p.business_id)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(p)} className="text-blue-600 hover:underline mr-3 text-xs">수정</button>
                    <button onClick={() => setConfirmId(p.id)} className="text-red-500 hover:underline text-xs">삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {paginated.map(p => (
            <div key={p.id} className="bg-white border border-gray-100 rounded-xl overflow-hidden hover:shadow-md hover:border-blue-100 transition-all group flex flex-col">
              <button onClick={() => setPickerTarget(p)} title="이미지 변경" className="group/img relative w-full h-32 block">
                {p.image_url ? (
                  <div className="h-32 bg-gray-50 flex items-center justify-center overflow-hidden">
                    <img src={p.image_url} alt={p.name} className="w-full h-full object-contain p-2 group-hover/img:opacity-70 transition-opacity" />
                  </div>
                ) : (
                  <div className="h-32 bg-gray-50 flex items-center justify-center text-gray-300 text-4xl group-hover/img:bg-blue-50 transition-colors">+</div>
                )}
              </button>
              <div className="p-3 flex flex-col flex-1">
                <div className="flex items-start justify-between mb-1.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${categoryColor(p.category)}`}>{p.category ?? '미분류'}</span>
                  {p.is_bundle && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">묶음</span>}
                </div>
                <p className="text-sm font-medium text-gray-800 leading-snug mb-1 flex-1 line-clamp-2">{p.name}</p>
                {p.barcode && <p className="text-xs text-gray-300 font-mono mb-2 truncate">{p.barcode}</p>}
                <div className="pt-2 border-t border-gray-50">
                  <div className="flex justify-between items-end mb-1">
                    <span className="text-xs text-gray-400">판매가</span>
                    <span className="text-sm font-bold text-blue-600">{formatMoney(p.sell_price)}원</span>
                  </div>
                  {p.buy_price > 0 && <div className="flex justify-between items-end"><span className="text-xs text-gray-400">매입가</span><span className="text-xs text-gray-500">{formatMoney(p.buy_price)}원</span></div>}
                </div>
                <div className="flex gap-1.5 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(p)} className="flex-1 text-xs py-1.5 border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50">수정</button>
                  <button onClick={() => setConfirmId(p.id)} className="flex-1 text-xs py-1.5 border border-red-200 text-red-500 rounded-lg hover:bg-red-50">삭제</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── 페이지네이션 ────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-gray-400">{((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, filtered.length)} / 총 {filtered.length}개</p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-30 hover:bg-gray-50">‹ 이전</button>
            {pageNumbers.map((n, i) => n === '...'
              ? <span key={`dot-${i}`} className="px-1 text-gray-400 text-xs">…</span>
              : <button key={n} onClick={() => setPage(n as number)} className={`w-8 h-7 text-xs rounded-lg transition-colors ${page === n ? 'bg-blue-600 text-white font-medium' : 'border border-gray-200 hover:bg-gray-50 text-gray-600'}`}>{n}</button>
            )}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-30 hover:bg-gray-50">다음 ›</button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          상품 추가/수정 모달 (탭 구조)
      ══════════════════════════════════════════════════ */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem.id ? '상품 수정' : '상품 추가'} size="xl">
        {/* 탭 헤더 */}
        <div className="flex border-b border-gray-100 -mx-6 px-6 mb-5">
          <button className={tabCls(modalTab === 'info')} onClick={() => setModalTab('info')}>기본 정보</button>
          <button className={tabCls(modalTab === 'options')} onClick={() => setModalTab('options')}>옵션 관리</button>
          {editItem.id && (
            <button className={tabCls(modalTab === 'channels')} onClick={() => setModalTab('channels')}>
              채널 연동
              {mappings.length > 0 && <span className="ml-1.5 text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">{mappings.length}</span>}
            </button>
          )}
        </div>

        {/* ── 탭: 기본 정보 ────────────────────────── */}
        {modalTab === 'info' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={labelCls}>상품명 *</label>
                <input className={inputCls} value={editItem.name ?? ''} onChange={e => setEditItem(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>바코드</label>
                <input className={inputCls} value={editItem.barcode ?? ''} onChange={e => setEditItem(p => ({ ...p, barcode: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>카테고리</label>
                <input className={inputCls} value={editItem.category ?? ''} onChange={e => setEditItem(p => ({ ...p, category: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>단위</label>
                <input className={inputCls} value={editItem.unit ?? 'ea'} onChange={e => setEditItem(p => ({ ...p, unit: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>매입가 (원)</label>
                <input type="number" className={inputCls} value={editItem.buy_price ?? 0} onChange={e => setEditItem(p => ({ ...p, buy_price: parseInt(e.target.value) || 0 }))} />
              </div>
              <div>
                <label className={labelCls}>판매가 (원)</label>
                <input type="number" className={inputCls} value={editItem.sell_price ?? 0} onChange={e => setEditItem(p => ({ ...p, sell_price: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>안전재고</label>
                <input type="number" className={inputCls} value={editItem.min_stock ?? 0} onChange={e => setEditItem(p => ({ ...p, min_stock: parseInt(e.target.value) || 0 }))} />
              </div>
              <div>
                <label className={labelCls}>사업자</label>
                <select className={inputCls} value={editItem.business_id ?? ''} onChange={e => setEditItem(p => ({ ...p, business_id: e.target.value || null }))}>
                  <option value="">선택 안 함</option>
                  {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="is_bundle" checked={editItem.is_bundle ?? false} onChange={e => setEditItem(p => ({ ...p, is_bundle: e.target.checked }))} className="w-4 h-4 rounded border-gray-300" />
              <label htmlFor="is_bundle" className="text-sm text-gray-700">묶음 상품</label>
            </div>
            <div>
              <label className={labelCls}>이미지 URL</label>
              <div className="flex gap-2 items-start">
                <input className={inputCls} value={editItem.image_url ?? ''} onChange={e => setEditItem(p => ({ ...p, image_url: e.target.value || null }))} placeholder="https://..." />
                {editItem.image_url && <img src={editItem.image_url} alt="" className="w-14 h-14 object-contain rounded-lg border border-gray-100 bg-gray-50 shrink-0" />}
              </div>
            </div>
            <div>
              <label className={labelCls}>메모</label>
              <textarea className={inputCls} rows={2} value={editItem.note ?? ''} onChange={e => setEditItem(p => ({ ...p, note: e.target.value }))} />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">취소</button>
              <button onClick={save} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">저장</button>
            </div>
          </div>
        )}

        {/* ── 탭: 옵션 관리 ────────────────────────── */}
        {modalTab === 'options' && (
          <div className="space-y-5">
            {optionsLoading ? (
              <div className="py-8 text-center text-sm text-gray-400">불러오는 중...</div>
            ) : (
              <>
                {/* 옵션 사용 여부 토글 */}
                <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={!hasOptions} onChange={() => { setHasOptions(false); setOptionGroups([]); setCombinations([]) }} className="w-4 h-4" />
                    <span className="text-sm text-gray-700">옵션 없음</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={hasOptions} onChange={() => setHasOptions(true)} className="w-4 h-4" />
                    <span className="text-sm text-gray-700">옵션 있음 (색상, 사이즈 등)</span>
                  </label>
                </div>

                {hasOptions && (
                  <>
                    {/* 옵션 그룹 편집 */}
                    <div className="space-y-3">
                      {optionGroups.map((group, gi) => (
                        <div key={gi} className="border border-gray-200 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <input
                              className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="옵션명 (예: 색상, 사이즈)"
                              value={group.name}
                              onChange={e => updateGroupName(gi, e.target.value)}
                            />
                            <button onClick={() => removeGroup(gi)} className="text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded border border-red-200 hover:bg-red-50">삭제</button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {group.values.map((val, vi) => (
                              <div key={vi} className="flex items-center gap-1">
                                <input
                                  className="border border-gray-200 rounded px-2 py-1 text-xs w-24 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  placeholder={`값 ${vi + 1}`}
                                  value={val.text}
                                  onChange={e => updateValue(gi, vi, e.target.value)}
                                />
                                {group.values.length > 1 && (
                                  <button onClick={() => removeValue(gi, vi)} className="text-gray-300 hover:text-red-400 text-xs">×</button>
                                )}
                              </div>
                            ))}
                            <button onClick={() => addValue(gi)} className="text-xs text-blue-500 hover:text-blue-700 px-2 py-1 border border-blue-200 rounded hover:bg-blue-50">+ 값 추가</button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <button onClick={addOptionGroup} className="text-sm text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50">+ 옵션 추가</button>
                      <button onClick={handleGenerateCombinations} disabled={optionGroups.length === 0} className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50">조합 자동 생성</button>
                    </div>

                    {/* 조합 테이블 */}
                    {combinations.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 mb-2">총 {combinations.length}개 조합</p>
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                          <table className="w-full text-xs">
                            <thead className="bg-gray-50 text-gray-500">
                              <tr>
                                <th className="px-3 py-2 text-left">조합</th>
                                <th className="px-3 py-2 text-right w-28">추가금액 (원)</th>
                                <th className="px-3 py-2 w-32">SKU</th>
                                <th className="px-3 py-2 w-16 text-center">판매</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {combinations.map((combo, idx) => (
                                <tr key={idx} className={combo.is_active ? '' : 'opacity-40'}>
                                  <td className="px-3 py-2 font-medium text-gray-700">{combo.label}</td>
                                  <td className="px-3 py-2">
                                    <input type="number" value={combo.add_price} onChange={e => updateCombo(idx, 'add_price', parseInt(e.target.value) || 0)}
                                      className="w-full text-right border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                  </td>
                                  <td className="px-3 py-2">
                                    <input value={combo.sku} onChange={e => updateCombo(idx, 'sku', e.target.value)}
                                      className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="SKU" />
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    <input type="checkbox" checked={combo.is_active} onChange={e => updateCombo(idx, 'is_active', e.target.checked)} className="w-3.5 h-3.5" />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                )}

                <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
                  <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">취소</button>
                  <button onClick={save} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">저장</button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── 탭: 채널 연동 ────────────────────────── */}
        {modalTab === 'channels' && editItem.id && (
          <div className="space-y-4">
            {/* 동기화 버튼 */}
            {mappings.length > 0 && (
              <div className="flex justify-end">
                <button
                  onClick={() => setSyncConfirm({ productId: editItem.id! })}
                  disabled={syncing}
                  className="text-sm bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1.5">
                  {syncing ? '동기화 중...' : '📡 전체 채널 동기화'}
                </button>
              </div>
            )}

            {/* 연동된 채널 목록 */}
            {mappingsLoading ? (
              <div className="py-6 text-center text-sm text-gray-400">불러오는 중...</div>
            ) : mappings.length === 0 ? (
              <div className="py-6 text-center text-sm text-gray-400 bg-gray-50 rounded-lg">연동된 채널이 없습니다</div>
            ) : (
              <div className="space-y-2">
                {/* 채널+상품번호 기준으로 그룹핑하여 표시 */}
                {Array.from(
                  mappings.reduce((acc, m) => {
                    const key = `${m.channel_id}::${m.platform_product_id}`
                    if (!acc.has(key)) acc.set(key, { ...m, optionCount: 0 })
                    acc.get(key)!.optionCount++
                    return acc
                  }, new Map<string, MappingRow & { optionCount: number }>())
                  .values()
                ).map(m => (
                  <div key={m.id} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {platformBadge(m.platform_type)}
                        <span className="text-sm font-medium text-gray-800">{m.channel_name}</span>
                        <span className="text-xs text-gray-400 font-mono">#{m.platform_product_id}</span>
                        {m.optionCount > 1 && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">옵션 {m.optionCount}개</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        {syncStatusBadge(m.last_sync_status)}
                        {m.last_synced_at && <span className="text-xs text-gray-300">{new Date(m.last_synced_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>}
                        <button onClick={() => deleteMapping(m.id)} className="text-xs text-red-400 hover:text-red-600 ml-2">해제</button>
                      </div>
                    </div>
                    {m.last_sync_error && <p className="mt-1 text-xs text-red-400 bg-red-50 rounded px-2 py-1">{m.last_sync_error}</p>}
                    <div className="flex gap-3 mt-2">
                      <span className={`text-xs ${m.sync_price ? 'text-green-600' : 'text-gray-300'}`}>가격동기화 {m.sync_price ? 'ON' : 'OFF'}</span>
                      <span className={`text-xs ${m.sync_inventory ? 'text-green-600' : 'text-gray-300'}`}>재고동기화 {m.sync_inventory ? 'ON' : 'OFF'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 채널 연동 추가 폼 */}
            {channelsWithPlatform.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-2">기준정보 설정에서 채널에 플랫폼 유형을 먼저 설정해주세요</p>
            ) : addMapping ? (
              <div className="border border-blue-200 rounded-lg p-4 bg-blue-50/30 space-y-3">
                <p className="text-sm font-medium text-gray-800">채널 연동 추가</p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>채널</label>
                    <select className={inputCls} value={addMapping.channelId} onChange={e => setAddMapping(prev => prev ? { ...prev, channelId: e.target.value, platformData: null } : prev)}>
                      <option value="">선택</option>
                      {channelsWithPlatform.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>플랫폼 상품번호</label>
                    <div className="flex gap-1.5">
                      <input className={inputCls} placeholder="예: 1234567890" value={addMapping.platformProductId} onChange={e => setAddMapping(prev => prev ? { ...prev, platformProductId: e.target.value } : prev)} />
                      <button onClick={lookupPlatformProduct} disabled={addMapping.loading} className="shrink-0 px-3 py-2 text-xs bg-gray-700 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50">
                        {addMapping.loading ? '조회 중...' : '조회'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* 플랫폼 상품 정보 */}
                {addMapping.platformData && (
                  <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-3">
                    <div className="flex justify-between text-xs text-gray-600">
                      <span className="font-medium">{addMapping.platformData.name}</span>
                      <span>{formatMoney(addMapping.platformData.price)}원</span>
                    </div>

                    {/* 옵션 매핑 (플랫폼 옵션 ↔ 우리 조합) */}
                    {addMapping.platformData.options.length > 0 && combinations4mapping.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 mb-2">옵션 매핑 (플랫폼 옵션 → 우리 상품 조합)</p>
                        <div className="space-y-1.5">
                          {addMapping.optionMappings.map((om, idx) => (
                            <div key={om.platformOptionId} className="flex items-center gap-2">
                              <span className="text-xs text-gray-600 w-28 shrink-0">{om.platformLabel}</span>
                              <span className="text-xs text-gray-400">→</span>
                              <select
                                className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                value={om.ourCombinationId}
                                onChange={e => setAddMapping(prev => {
                                  if (!prev) return prev
                                  const updated = [...prev.optionMappings]
                                  updated[idx] = { ...updated[idx], ourCombinationId: e.target.value }
                                  return { ...prev, optionMappings: updated }
                                })}>
                                <option value="">조합 선택</option>
                                {combinations4mapping.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                              </select>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 동기화 옵션 */}
                    <div className="flex gap-4">
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input type="checkbox" checked={addMapping.syncPrice} onChange={e => setAddMapping(prev => prev ? { ...prev, syncPrice: e.target.checked } : prev)} className="w-3.5 h-3.5" />
                        가격 동기화
                      </label>
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input type="checkbox" checked={addMapping.syncInventory} onChange={e => setAddMapping(prev => prev ? { ...prev, syncInventory: e.target.checked } : prev)} className="w-3.5 h-3.5" />
                        재고 동기화
                      </label>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 justify-end">
                  <button onClick={() => setAddMapping(null)} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50">취소</button>
                  {addMapping.platformData && (
                    <button onClick={saveChannelMapping} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">연동 저장</button>
                  )}
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAddMapping({ channelId: channelsWithPlatform[0]?.id ?? '', platformProductId: '', platformData: null, optionMappings: [], syncPrice: true, syncInventory: true, loading: false })}
                className="w-full py-2 text-sm text-blue-600 border border-blue-200 border-dashed rounded-lg hover:bg-blue-50">
                + 채널 연동 추가
              </button>
            )}
          </div>
        )}
      </Modal>

      {/* ── 동기화 확인 모달 ───────────────────────── */}
      {syncConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSyncConfirm(null)} />
          <div className="relative bg-white rounded-xl shadow-xl p-6 w-80">
            <p className="font-semibold text-gray-900 mb-2">채널 동기화</p>
            <p className="text-sm text-gray-600 mb-1">연동된 모든 채널에 현재 가격과 재고를 반영합니다.</p>
            {products.find(p => p.id === syncConfirm.productId) && (() => {
              const p = products.find(pp => pp.id === syncConfirm.productId)!
              const inv = 0  // 실제 재고는 별도 조회 필요
              return <p className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1.5 mt-2">현재 DB 재고 기준으로 동기화됩니다. 재고가 0이면 채널에도 0으로 반영됩니다.</p>
            })()}
            <div className="flex gap-2 justify-end mt-4">
              <button onClick={() => setSyncConfirm(null)} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">취소</button>
              <button onClick={() => executeSyncForProduct(syncConfirm.productId)} className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">동기화 실행</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog open={!!confirmId} message="상품을 삭제하시겠습니까?" onConfirm={handleDelete} onCancel={() => setConfirmId(null)} />
      <ImagePickerModal
        open={!!pickerTarget} productName={pickerTarget?.name ?? ''} currentImage={pickerTarget?.image_url}
        onSelect={url => pickerTarget && handleImagePicked(pickerTarget, url)} onClose={() => setPickerTarget(null)}
      />
    </div>
  )
}
