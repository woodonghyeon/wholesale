'use client'

import { useEffect, useState } from 'react'
import { useBusinessStore } from '@/store/businessStore'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { Business } from '@/lib/types'
import { useRouter } from 'next/navigation'

export default function Header() {
  const router = useRouter()
  const { selectedBusinessId, setSelectedBusiness } = useBusinessStore()
  const [businesses, setBusinesses] = useState<Business[]>([])

  useEffect(() => {
    if (!isSupabaseConfigured()) return
    const supabase = createClient()
    supabase
      .from('businesses')
      .select('*')
      .order('sort_order')
      .then(({ data }) => {
        if (data) setBusinesses(data)
      })
  }, [])

  const handleLogout = async () => {
    if (!isSupabaseConfigured()) return
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const selectedName =
    selectedBusinessId === 'all'
      ? '전체 사업자'
      : businesses.find((b) => b.id === selectedBusinessId)?.name ?? '전체 사업자'

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-2">
        <select
          value={selectedBusinessId}
          onChange={(e) => setSelectedBusiness(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="all">전체 사업자</option>
          {businesses.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <span className="text-xs text-gray-400 hidden sm:block">{selectedName}</span>
      </div>

      <button
        onClick={handleLogout}
        className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        로그아웃
      </button>
    </header>
  )
}
