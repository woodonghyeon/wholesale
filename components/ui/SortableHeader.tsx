'use client'

import { useState, useMemo } from 'react'

export type SortDir = 'asc' | 'desc'

export interface SortCriteria {
  key: string
  dir: SortDir
}

// ── 멀티 정렬 헤더 컴포넌트 ─────────────────────────────────────
interface SortableHeaderProps {
  children: React.ReactNode
  field: string
  // 멀티 정렬용
  criteria?: SortCriteria[]
  onSort?: (field: string, multi: boolean) => void
  // 단일 정렬 하위 호환
  sortKey?: string | null
  sortDir?: SortDir
  className?: string
  align?: 'left' | 'right' | 'center'
}

export function SortableHeader({
  children, field, criteria, onSort,
  sortKey, sortDir,
  className = '', align = 'left',
}: SortableHeaderProps) {

  // 멀티 정렬 모드
  if (criteria !== undefined && onSort) {
    const idx   = criteria.findIndex(c => c.key === field)
    const active = idx !== -1
    const dir    = active ? criteria[idx].dir : null
    const rank   = active && criteria.length > 1 ? idx + 1 : null   // 2개 이상일 때만 순위 표시

    return (
      <th
        onClick={e => onSort(field, e.shiftKey)}
        title="클릭: 기본 정렬 · Shift+클릭: 추가 정렬"
        className={`px-3 py-3 font-medium cursor-pointer select-none whitespace-nowrap
          hover:bg-gray-100 transition-colors group
          text-${align} ${active ? 'text-blue-600' : 'text-gray-500'} ${className}`}
      >
        <span className="inline-flex items-center gap-1">
          {children}
          {rank && (
            <span className="text-[10px] bg-blue-500 text-white rounded-full w-4 h-4 flex items-center justify-center leading-none font-bold">
              {rank}
            </span>
          )}
          <span className={`text-xs transition-opacity ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'}`}>
            {active ? (dir === 'asc' ? '↑' : '↓') : '↕'}
          </span>
        </span>
      </th>
    )
  }

  // 단일 정렬 하위 호환 모드
  const active = sortKey === field
  return (
    <th
      onClick={() => onSort?.(field, false)}
      className={`px-3 py-3 font-medium cursor-pointer select-none whitespace-nowrap
        hover:bg-gray-100 transition-colors group
        text-${align} ${active ? 'text-blue-600' : 'text-gray-500'} ${className}`}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <span className={`text-xs transition-opacity ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'}`}>
          {active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </span>
    </th>
  )
}

// ── 멀티 정렬 훅 ─────────────────────────────────────────────────
// - 클릭: 해당 컬럼을 최우선 정렬로 설정 (asc → desc → 제거)
// - Shift+클릭: 기존 정렬에 추가 (보조 정렬)
export function useSortable<T extends Record<string, any>>(data: T[]) {
  const [criteria, setCriteria] = useState<SortCriteria[]>([])

  function toggle(key: string, multi = false) {
    setCriteria(prev => {
      const existing = prev.find(c => c.key === key)

      if (multi) {
        // Shift+클릭: 보조 정렬 추가/토글/제거
        if (!existing) return [...prev, { key, dir: 'asc' }]
        if (existing.dir === 'asc') return prev.map(c => c.key === key ? { ...c, dir: 'desc' } : c)
        return prev.filter(c => c.key !== key)  // desc → 제거
      } else {
        // 일반 클릭: 단독 최우선 정렬
        if (!existing) return [{ key, dir: 'asc' }]
        if (existing.dir === 'asc') return [{ key, dir: 'desc' }]
        return []  // desc → 전체 제거
      }
    })
  }

  const sorted = useMemo(() => {
    if (!criteria.length) return data
    return [...data].sort((a, b) => {
      for (const { key, dir } of criteria) {
        let av = a[key] ?? ''
        let bv = b[key] ?? ''
        let cmp = 0

        if (av == null && bv == null) { cmp = 0 }
        else if (av == null) { cmp = -1 }
        else if (bv == null) { cmp = 1 }
        else if (typeof av === 'number' && typeof bv === 'number') {
          cmp = av - bv
        } else if (typeof av === 'boolean' && typeof bv === 'boolean') {
          cmp = Number(av) - Number(bv)
        } else {
          av = String(av).toLowerCase()
          bv = String(bv).toLowerCase()
          cmp = av < bv ? -1 : av > bv ? 1 : 0
        }

        if (cmp !== 0) return dir === 'asc' ? cmp : -cmp
      }
      return 0
    })
  }, [data, criteria])

  // 하위 호환: 단일 정렬 속성도 노출
  const sortKey = criteria[0]?.key ?? null
  const sortDir = criteria[0]?.dir ?? 'asc'

  return { sorted, criteria, sortKey, sortDir, toggle }
}
