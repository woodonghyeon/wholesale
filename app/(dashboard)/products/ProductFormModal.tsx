'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Product, Business } from '@/lib/types'
import type { ProductFormData } from '@/lib/supabase/products'
import { createProduct, updateProduct, deleteProduct } from '@/lib/supabase/products'
import { toast } from 'sonner'

interface Props {
  product?: Product | null   // null = 신규, Product = 수정
  defaultBusinessId?: string // 신규 시 사업자 기본값
  onClose: () => void
  onSaved: () => void
}

const SUGGESTED_CATEGORIES = ['필기구', '용지', '노트', '바인더', '메모', '파일', '책상용품', '사무용품', '기타']
const SUGGESTED_UNITS = ['박스', '개', '권', '장', '세트', '팩', '롤']

export default function ProductFormModal({ product, defaultBusinessId, onClose, onSaved }: Props) {
  const isEdit = !!product

  const [businesses, setBusinesses] = useState<Business[]>([])
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // 폼 필드
  const [bizId, setBizId] = useState(product?.business_id ?? defaultBusinessId ?? '')
  const [name, setName] = useState(product?.name ?? '')
  const [barcode, setBarcode] = useState(product?.barcode ?? '')
  const [category, setCategory] = useState(product?.category ?? '')
  const [unit, setUnit] = useState(product?.unit ?? '개')
  const [buyPrice, setBuyPrice] = useState(String(product?.buy_price ?? ''))
  const [sellPrice, setSellPrice] = useState(String(product?.sell_price ?? ''))
  const [minStock, setMinStock] = useState(String(product?.min_stock ?? '0'))
  const [isBundle, setIsBundle] = useState(product?.is_bundle ?? false)
  const [note, setNote] = useState(product?.note ?? '')

  useEffect(() => {
    createClient()
      .from('businesses')
      .select('*')
      .order('sort_order')
      .then(({ data }) => {
        setBusinesses(data ?? [])
        if (!bizId && data && data.length > 0) setBizId(data[0].id)
      })
  }, [])

  const margin = (() => {
    const b = Number(buyPrice) || 0
    const s = Number(sellPrice) || 0
    if (s === 0) return 0
    return Math.round(((s - b) / s) * 100)
  })()

  async function handleSave() {
    if (!name.trim()) { toast.error('상품명을 입력하세요.'); return }
    if (!bizId) { toast.error('사업자를 선택하세요.'); return }
    if (Number(sellPrice) < 0 || Number(buyPrice) < 0) { toast.error('가격은 0 이상이어야 합니다.'); return }

    setSaving(true)
    try {
      const formData: ProductFormData = {
        business_id: bizId,
        barcode: barcode.trim() || undefined,
        name: name.trim(),
        category: category.trim() || undefined,
        unit: unit.trim() || '개',
        buy_price: Number(buyPrice) || 0,
        sell_price: Number(sellPrice) || 0,
        min_stock: Number(minStock) || 0,
        is_bundle: isBundle,
        note: note.trim() || undefined,
      }
      if (isEdit) {
        await updateProduct(product.id, formData)
        toast.success('상품이 수정되었습니다.')
      } else {
        await createProduct(formData)
        toast.success('상품이 등록되었습니다.')
      }
      onSaved()
    } catch (e: any) {
      toast.error(e?.message ?? '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!product) return
    setDeleting(true)
    try {
      await deleteProduct(product.id)
      toast.success('상품이 삭제되었습니다.')
      onSaved()
    } catch (e: any) {
      toast.error(e?.message ?? '삭제에 실패했습니다.')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-white/90 backdrop-blur-2xl rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06]">
          <h2 className="text-base font-semibold text-[#1d1d1f]">
            {isEdit ? '상품 수정' : '상품 등록'}
          </h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-black/[0.06] transition-colors">
            <svg className="w-4 h-4 text-[#86868b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 바디 */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          {/* 사업자 */}
          <div>
            <label className="block text-xs font-medium text-[#86868b] mb-1">사업자 <span className="text-red-500">*</span></label>
            <select
              value={bizId}
              onChange={e => setBizId(e.target.value)}
              className="w-full rounded-lg border border-gray-300/60 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">선택</option>
              {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          {/* 상품명 */}
          <div>
            <label className="block text-xs font-medium text-[#86868b] mb-1">상품명 <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="상품명을 입력하세요"
              className="w-full rounded-lg border border-gray-300/60 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* 바코드 */}
          <div>
            <label className="block text-xs font-medium text-[#86868b] mb-1">바코드</label>
            <input
              type="text"
              value={barcode}
              onChange={e => setBarcode(e.target.value)}
              placeholder="바코드 번호"
              className="w-full rounded-lg border border-gray-300/60 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* 카테고리 + 단위 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#86868b] mb-1">카테고리</label>
              <input
                type="text"
                list="category-list"
                value={category}
                onChange={e => setCategory(e.target.value)}
                placeholder="카테고리"
                className="w-full rounded-lg border border-gray-300/60 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <datalist id="category-list">
                {SUGGESTED_CATEGORIES.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#86868b] mb-1">단위</label>
              <input
                type="text"
                list="unit-list"
                value={unit}
                onChange={e => setUnit(e.target.value)}
                placeholder="단위"
                className="w-full rounded-lg border border-gray-300/60 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <datalist id="unit-list">
                {SUGGESTED_UNITS.map(u => <option key={u} value={u} />)}
              </datalist>
            </div>
          </div>

          {/* 가격 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#86868b] mb-1">매입가 (원)</label>
              <input
                type="number"
                min={0}
                value={buyPrice}
                onChange={e => setBuyPrice(e.target.value)}
                className="w-full rounded-lg border border-gray-300/60 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#86868b] mb-1">판매가 (원)</label>
              <input
                type="number"
                min={0}
                value={sellPrice}
                onChange={e => setSellPrice(e.target.value)}
                className="w-full rounded-lg border border-gray-300/60 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          {/* 마진율 표시 */}
          {(Number(buyPrice) > 0 || Number(sellPrice) > 0) && (
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50/60 rounded-lg">
              <span className="text-xs text-[#86868b]">마진율</span>
              <span className={`text-sm font-semibold ${margin >= 30 ? 'text-[#34c759]' : margin >= 10 ? 'text-[#007aff]' : 'text-[#ff3b30]'}`}>
                {margin}%
              </span>
              <span className="text-xs text-[#86868b] ml-1">
                (이익 {new Intl.NumberFormat('ko-KR').format(Number(sellPrice) - Number(buyPrice))}원)
              </span>
            </div>
          )}

          {/* 최소재고 */}
          <div>
            <label className="block text-xs font-medium text-[#86868b] mb-1">안전재고 (최소 수량)</label>
            <input
              type="number"
              min={0}
              value={minStock}
              onChange={e => setMinStock(e.target.value)}
              className="w-full rounded-lg border border-gray-300/60 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* 세트 상품 */}
          <div className="flex items-center gap-3 px-3 py-2.5 border border-gray-200/60 rounded-lg">
            <input
              type="checkbox"
              id="is-bundle"
              checked={isBundle}
              onChange={e => setIsBundle(e.target.checked)}
              className="w-4 h-4 rounded accent-[#007aff]"
            />
            <label htmlFor="is-bundle" className="text-sm text-[#1d1d1f] cursor-pointer select-none">
              세트 상품
            </label>
            <span className="text-xs text-[#86868b]">여러 상품을 묶어 판매하는 세트</span>
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-xs font-medium text-[#86868b] mb-1">메모</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              placeholder="상품에 대한 메모"
              className="w-full rounded-lg border border-gray-300/60 bg-white px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        {/* 푸터 */}
        <div className="px-6 py-4 border-t border-black/[0.06] flex items-center justify-between">
          {isEdit ? (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#ff3b30]">정말 삭제하시겠습니까?</span>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#ff3b30] text-white hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {deleting ? '삭제 중…' : '확인'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#ff3b30] hover:bg-red-50 transition-colors"
              >
                삭제
              </button>
            )
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-[#007aff] text-white hover:bg-[#0066d6] transition-colors disabled:opacity-50"
            >
              {saving ? '저장 중…' : isEdit ? '수정 완료' : '등록'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
