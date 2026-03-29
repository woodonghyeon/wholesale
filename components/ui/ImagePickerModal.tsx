'use client'

import { useState, useEffect, useRef } from 'react'
import Modal from './Modal'

interface ImageCandidate {
  image: string
  title: string
  price: number
}

interface Props {
  open: boolean
  productName: string
  currentImage?: string | null
  onSelect: (url: string) => void
  onClose: () => void
}

export default function ImagePickerModal({ open, productName, currentImage, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [candidates, setCandidates] = useState<ImageCandidate[]>([])
  const [loading, setLoading] = useState(false)
  const [manualUrl, setManualUrl] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const didInit = useRef(false)

  // 모달 열릴 때 상품명으로 자동 검색
  useEffect(() => {
    if (open && !didInit.current) {
      didInit.current = true
      setQuery(productName)
      setSelected(currentImage ?? null)
      setManualUrl(currentImage ?? '')
      search(productName)
    }
    if (!open) didInit.current = false
  }, [open, productName, currentImage])

  async function search(q?: string) {
    const searchQ = (q ?? query).trim()
    if (!searchQ) return
    setLoading(true)
    try {
      const res = await fetch(`/api/products/search-images?q=${encodeURIComponent(searchQ)}&display=8`)
      const data = await res.json()
      setCandidates(data.items ?? [])
    } catch {
      setCandidates([])
    } finally {
      setLoading(false)
    }
  }

  function handleConfirm() {
    const url = selected ?? manualUrl.trim()
    if (url) onSelect(url)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="이미지 선택" size="lg">
      <div className="space-y-4">
        {/* 검색창 */}
        <div className="flex gap-2">
          <input
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="검색어 입력 후 Enter"
          />
          <button
            onClick={() => search()}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
          >
            {loading ? '검색 중...' : '검색'}
          </button>
        </div>

        {/* 이미지 그리드 */}
        {candidates.length > 0 && (
          <div>
            <p className="text-xs text-gray-400 mb-2">클릭해서 선택 (네이버 쇼핑 결과)</p>
            <div className="grid grid-cols-4 gap-2">
              {candidates.map((c, i) => (
                <button
                  key={i}
                  onClick={() => { setSelected(c.image); setManualUrl(c.image) }}
                  className={`relative rounded-lg overflow-hidden border-2 transition-all aspect-square bg-gray-50 ${
                    selected === c.image
                      ? 'border-blue-500 ring-2 ring-blue-200'
                      : 'border-gray-100 hover:border-blue-300'
                  }`}
                  title={c.title}
                >
                  <img src={c.image} alt={c.title} className="w-full h-full object-contain p-1" />
                  {selected === c.image && (
                    <div className="absolute top-1 right-1 bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                      ✓
                    </div>
                  )}
                  {c.price > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-xs text-center py-0.5">
                      {c.price.toLocaleString()}원
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 직접 URL 입력 */}
        <div>
          <p className="text-xs text-gray-500 mb-1.5">또는 이미지 URL 직접 입력</p>
          <div className="flex gap-2 items-start">
            <input
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={manualUrl}
              onChange={e => { setManualUrl(e.target.value); setSelected(e.target.value || null) }}
              placeholder="https://..."
            />
            {manualUrl && (
              <img
                src={manualUrl}
                alt=""
                className="w-14 h-14 object-contain rounded-lg border border-gray-100 bg-gray-50 shrink-0"
                onError={e => (e.currentTarget.style.display = 'none')}
              />
            )}
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="flex justify-between items-center pt-1">
          <button
            onClick={() => { setSelected(null); setManualUrl(''); onSelect(''); onClose() }}
            className="text-xs text-red-400 hover:text-red-600"
          >
            이미지 제거
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
              취소
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selected && !manualUrl}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40"
            >
              선택 완료
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
