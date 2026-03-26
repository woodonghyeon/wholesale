'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/dashboard', label: '대시보드', icon: '▣' },
  { href: '/transactions', label: '거래 입력', icon: '✎' },
  { href: '/sales', label: '매출 현황', icon: '↑' },
  { href: '/purchase', label: '매입 현황', icon: '↓' },
  { href: '/inventory', label: '재고 관리', icon: '⊟' },
  { href: '/products', label: '상품 관리', icon: '⊞' },
  { href: '/partners', label: '거래처', icon: '◎' },
  { href: '/quotes', label: '견적·발주', icon: '≡' },
  { href: '/returns', label: '반품·불량', icon: '↩' },
  { href: '/customers', label: '정기 고객', icon: '♻' },
  { href: '/cash', label: '현금 출납', icon: '₩' },
  { href: '/tax', label: '세금계산서', icon: '◉' },
  { href: '/reports', label: '보고서', icon: '⊕' },
  { href: '/alerts', label: '알림', icon: '🔔' },
  { href: '/settings', label: '설정', icon: '⚙' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-52 shrink-0 h-screen bg-white border-r border-gray-100 flex flex-col">
      <div className="px-4 py-5 border-b border-gray-100">
        <p className="text-xs text-gray-400">문구 도매</p>
        <p className="font-bold text-gray-900">통합 관리 시스템</p>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-4 py-2 text-sm transition-colors ${
                active
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <span className="text-base w-5 text-center">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
