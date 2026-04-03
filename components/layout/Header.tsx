'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useBusinessStore } from '@/store/businessStore'
import type { Business, Channel } from '@/lib/types'
import { toast } from 'sonner'

export default function Header() {
  const router = useRouter()
  const supabase = createClient()
  const { selectedBusinessId, selectedChannelId, setSelectedBusiness, setSelectedChannel } = useBusinessStore()
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [userEmail, setUserEmail] = useState<string>('')

  // 사업자 목록 + 유저 로드
  useEffect(() => {
    async function load() {
      const [{ data: bizData }, { data: { user } }] = await Promise.all([
        supabase.from('businesses').select('*').order('sort_order'),
        supabase.auth.getUser(),
      ])
      if (bizData) setBusinesses(bizData)
      if (user?.email) setUserEmail(user.email)
    }
    load()
  }, [])

  // 선택된 사업자의 채널 로드
  useEffect(() => {
    if (selectedBusinessId === 'all') {
      setChannels([])
      return
    }
    supabase
      .from('channels')
      .select('*')
      .eq('business_id', selectedBusinessId)
      .order('sort_order')
      .then(({ data }) => setChannels(data ?? []))
  }, [selectedBusinessId])

  async function handleLogout() {
    await supabase.auth.signOut()
    toast.success('로그아웃 되었습니다.')
    router.push('/login')
    router.refresh()
  }

  const showChannelRow = selectedBusinessId !== 'all' && channels.length > 0

  return (
    <header className="bg-white/72 backdrop-blur-xl border-b border-black/[0.06] sticky top-0 z-10">
      {/* 1행: 사업자 선택 + 유저/로그아웃 */}
      <div className="h-14 flex items-center justify-between px-6">
        <div className="inline-flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5">
          <button
            onClick={() => setSelectedBusiness('all')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
              selectedBusinessId === 'all'
                ? 'bg-white shadow-sm text-[#1d1d1f]'
                : 'text-[#86868b] hover:text-[#1d1d1f]'
            }`}
          >
            전체
          </button>
          {businesses.map(biz => (
            <button
              key={biz.id}
              onClick={() => setSelectedBusiness(biz.id)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
                selectedBusinessId === biz.id
                  ? 'bg-white shadow-sm text-[#1d1d1f]'
                  : 'text-[#86868b] hover:text-[#1d1d1f]'
              }`}
            >
              {biz.name}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {userEmail && (
            <span className="text-xs text-[#86868b]">{userEmail}</span>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[#86868b] hover:text-[#1d1d1f] hover:bg-gray-100 transition-all duration-200"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            로그아웃
          </button>
        </div>
      </div>

      {/* 2행: 채널 선택 (사업자 선택 시에만 표시) */}
      {showChannelRow && (
        <div className="h-10 flex items-center px-6 border-t border-black/[0.04] bg-[#f5f5f5]/60">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[#86868b] mr-1">채널</span>
            <div className="inline-flex items-center bg-white/70 rounded-lg p-0.5 gap-0.5 border border-black/[0.06]">
              <button
                onClick={() => setSelectedChannel('all')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-200 ${
                  selectedChannelId === 'all'
                    ? 'bg-white shadow-sm text-[#1d1d1f]'
                    : 'text-[#86868b] hover:text-[#1d1d1f]'
                }`}
              >
                전체
              </button>
              {channels.map(ch => (
                <button
                  key={ch.id}
                  onClick={() => setSelectedChannel(ch.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-200 ${
                    selectedChannelId === ch.id
                      ? 'bg-white shadow-sm text-[#007aff]'
                      : 'text-[#86868b] hover:text-[#1d1d1f]'
                  }`}
                >
                  {ch.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
