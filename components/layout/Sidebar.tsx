'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
}

interface NavGroup {
  title: string
  items: NavItem[]
}

function Icon({ path }: { path: string }) {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  )
}

const navGroups: NavGroup[] = [
  {
    title: '거래',
    items: [
      { href: '/transactions', label: '거래전표', icon: <Icon path="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /> },
      { href: '/orders', label: '통합 주문', icon: <Icon path="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /> },
      { href: '/sales', label: '매출 집계', icon: <Icon path="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /> },
      { href: '/channel-sales', label: '채널별 매출', icon: <Icon path="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /> },
      { href: '/purchase', label: '매입 집계', icon: <Icon path="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /> },
    ],
  },
  {
    title: '재고',
    items: [
      { href: '/inventory', label: '재고 관리', icon: <Icon path="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /> },
      { href: '/stocktake', label: '재고 실사', icon: <Icon path="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /> },
      { href: '/stock-ledger', label: '재고 원장', icon: <Icon path="M4 6h16M4 10h16M4 14h16M4 18h16" /> },
    ],
  },
  {
    title: '상품·거래처',
    items: [
      { href: '/products', label: '상품 관리', icon: <Icon path="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /> },
      { href: '/price-list', label: '가격표', icon: <Icon path="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /> },
      { href: '/partners', label: '거래처 관리', icon: <Icon path="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /> },
      { href: '/partner-ledger', label: '거래처 원장', icon: <Icon path="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /> },
    ],
  },
  {
    title: '문서',
    items: [
      { href: '/quotes', label: '견적서·발주서', icon: <Icon path="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /> },
      { href: '/returns', label: '반품 관리', icon: <Icon path="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /> },
      { href: '/tax', label: '세금계산서', icon: <Icon path="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" /> },
    ],
  },
  {
    title: '재무',
    items: [
      { href: '/cash', label: '현금출납', icon: <Icon path="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /> },
      { href: '/receivables', label: '채권·채무', icon: <Icon path="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /> },
      { href: '/notes', label: '어음·수표', icon: <Icon path="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /> },
    ],
  },
  {
    title: '분석·리포트',
    items: [
      { href: '/reports', label: '손익 리포트', icon: <Icon path="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /> },
      { href: '/quarterly', label: '분기 집계', icon: <Icon path="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /> },
      { href: '/customers', label: '단골고객', icon: <Icon path="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /> },
    ],
  },
  {
    title: '시스템',
    items: [
      { href: '/alerts', label: '알림 센터', icon: <Icon path="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /> },
      { href: '/settings', label: '설정', icon: <Icon path="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" /> },
      { href: '/logs', label: '시스템 로그', icon: <Icon path="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /> },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  function toggleGroup(title: string) {
    setCollapsed(prev => ({ ...prev, [title]: !prev[title] }))
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  // 현재 경로가 속한 그룹 자동 펼침 여부
  function isGroupActive(group: NavGroup) {
    return group.items.some(item => isActive(item.href))
  }

  return (
    <aside className="w-[240px] min-h-screen bg-[#f5f5f5] border-r border-black/[0.06] flex flex-col">
      {/* 로고 */}
      <div className="h-14 flex items-center px-4 border-b border-black/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#007aff] flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-[#1d1d1f]">도매 관리</span>
        </div>
      </div>

      {/* 대시보드 링크 */}
      <div className="px-2 pt-2">
        <Link
          href="/dashboard"
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
            pathname === '/dashboard'
              ? 'bg-white text-[#007aff] shadow-sm'
              : 'text-[#1d1d1f] hover:bg-black/[0.04]'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          대시보드
        </Link>
      </div>

      {/* 네비게이션 그룹 */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {navGroups.map((group) => {
          const open = collapsed[group.title] === undefined
            ? (isGroupActive(group) || true)  // 기본 펼침
            : !collapsed[group.title]

          return (
            <div key={group.title}>
              <button
                onClick={() => toggleGroup(group.title)}
                className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-[#86868b] uppercase tracking-wider hover:text-[#1d1d1f] transition-colors duration-200"
              >
                {group.title}
                <svg
                  className={`w-3 h-3 transition-transform duration-200 ${open ? 'rotate-0' : '-rotate-90'}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {open && (
                <div className="mt-0.5 space-y-0.5">
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                        isActive(item.href)
                          ? 'bg-white text-[#007aff] shadow-sm font-medium'
                          : 'text-[#1d1d1f] hover:bg-black/[0.04] font-normal'
                      }`}
                    >
                      <span className={isActive(item.href) ? 'text-[#007aff]' : 'text-[#86868b]'}>
                        {item.icon}
                      </span>
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
