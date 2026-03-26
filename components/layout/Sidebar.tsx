'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface SubItem {
  href: string
  label: string
  badge?: string
}

interface NavGroup {
  key: string
  label: string
  icon: string
  items: SubItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    key: 'sales',
    label: '판매',
    icon: '↑',
    items: [
      { href: '/transactions', label: '거래 입력' },
      { href: '/sales', label: '매출 현황' },
      { href: '/channel-sales', label: '채널별 매출' },
      { href: '/quotes', label: '견적·발주' },
      { href: '/returns', label: '반품 관리' },
      { href: '/tax', label: '세금계산서' },
    ],
  },
  {
    key: 'purchase',
    label: '구매',
    icon: '↓',
    items: [
      { href: '/purchase', label: '매입 현황' },
    ],
  },
  {
    key: 'inventory',
    label: '재고',
    icon: '⊟',
    items: [
      { href: '/inventory', label: '재고 현황' },
      { href: '/stocktake', label: '재고 실사' },
      { href: '/products', label: '상품 관리' },
    ],
  },
  {
    key: 'finance',
    label: '자금',
    icon: '₩',
    items: [
      { href: '/cash', label: '현금 출납' },
      { href: '/receivables', label: '미수금·미지급금' },
      { href: '/notes', label: '어음·수표' },
    ],
  },
  {
    key: 'customer',
    label: '고객',
    icon: '◎',
    items: [
      { href: '/partners', label: '거래처 관리' },
      { href: '/customers', label: '정기 고객' },
    ],
  },
  {
    key: 'report',
    label: '보고서',
    icon: '⊕',
    items: [
      { href: '/reports', label: '종합 보고서' },
      { href: '/alerts', label: '알림 센터' },
    ],
  },
  {
    key: 'system',
    label: '시스템',
    icon: '◈',
    items: [
      { href: '/logs', label: '시스템 로그' },
    ],
  },
]

function findActiveGroup(pathname: string): string | null {
  for (const g of NAV_GROUPS) {
    if (g.items.some(i => pathname === i.href || pathname.startsWith(i.href + '/'))) {
      return g.key
    }
  }
  return null
}

export default function Sidebar() {
  const pathname = usePathname()
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const active = findActiveGroup(pathname)
    return active ? new Set([active]) : new Set()
  })

  // pathname 변경 시 해당 그룹 자동 오픈
  useEffect(() => {
    const active = findActiveGroup(pathname)
    if (active) {
      setOpenGroups(prev => {
        if (prev.has(active)) return prev
        return new Set([...prev, active])
      })
    }
  }, [pathname])

  function toggle(key: string) {
    setOpenGroups(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const isDashboard = pathname === '/dashboard' || pathname.startsWith('/dashboard/')

  return (
    <aside className="w-52 shrink-0 h-screen bg-white border-r border-gray-100 flex flex-col">
      {/* 로고 */}
      <div className="px-4 py-5 border-b border-gray-100">
        <p className="text-xs text-gray-400">문구 도매</p>
        <p className="font-bold text-gray-900">통합 관리 시스템</p>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {/* 대시보드 - 단독 항목 */}
        <Link
          href="/dashboard"
          className={`flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${
            isDashboard
              ? 'bg-blue-50 text-blue-700 font-semibold'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <span className="text-base w-5 text-center">▣</span>
          대시보드
        </Link>

        <div className="mt-1 space-y-0.5">
          {NAV_GROUPS.map(group => {
            const isOpen = openGroups.has(group.key)
            const hasActive = group.items.some(
              i => pathname === i.href || pathname.startsWith(i.href + '/')
            )

            return (
              <div key={group.key}>
                {/* 그룹 헤더 */}
                <button
                  onClick={() => toggle(group.key)}
                  className={`w-full flex items-center justify-between px-4 py-2 text-sm font-medium transition-colors ${
                    hasActive
                      ? 'text-blue-700'
                      : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base w-5 text-center">{group.icon}</span>
                    <span>{group.label}</span>
                  </div>
                  {/* 화살표 */}
                  <svg
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* 서브 메뉴 */}
                {isOpen && (
                  <div className="pb-1">
                    {group.items.map(item => {
                      const active = pathname === item.href || pathname.startsWith(item.href + '/')
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`flex items-center gap-2 pl-11 pr-4 py-1.5 text-sm transition-colors ${
                            active
                              ? 'text-blue-600 font-medium bg-blue-50'
                              : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                          }`}
                        >
                          <span className={`w-1 h-1 rounded-full shrink-0 ${active ? 'bg-blue-500' : 'bg-gray-300'}`} />
                          {item.label}
                          {item.badge && (
                            <span className="ml-auto text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </nav>

      {/* 하단 고정: 기준정보 설정 */}
      <div className="border-t border-gray-100">
        <Link
          href="/settings"
          className={`flex items-center gap-2.5 px-4 py-3 text-sm transition-colors ${
            pathname.startsWith('/settings')
              ? 'bg-blue-50 text-blue-700 font-semibold'
              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
          }`}
        >
          <span className="text-base w-5 text-center">⚙</span>
          기준정보 설정
        </Link>
      </div>
    </aside>
  )
}
