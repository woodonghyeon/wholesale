'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export default function SignupPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()

    if (password.length < 6) {
      toast.error('비밀번호는 6자 이상이어야 합니다.')
      return
    }
    if (password !== confirm) {
      toast.error('비밀번호가 일치하지 않습니다.')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        if (error.message.includes('already registered')) {
          toast.error('이미 등록된 이메일입니다.')
        } else {
          toast.error(error.message)
        }
        return
      }
      toast.success('회원가입 완료! 이메일을 확인해 주세요.')
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5]">
      <div className="w-full max-w-sm">
        {/* 로고 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#007aff] mb-4 shadow-lg">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-[#1d1d1f]">계정 만들기</h1>
          <p className="text-sm text-[#86868b] mt-1">도매 관리 시스템에 가입하세요</p>
        </div>

        {/* 회원가입 카드 */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.08)] border border-black/[0.06] p-8">
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#1d1d1f] mb-1.5">이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                required
                className="w-full rounded-lg border border-gray-300/60 bg-white px-3 py-2.5 text-sm text-[#1d1d1f] placeholder-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#007aff]/20 focus:border-[#007aff] transition-all duration-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1d1d1f] mb-1.5">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6자 이상"
                required
                minLength={6}
                className="w-full rounded-lg border border-gray-300/60 bg-white px-3 py-2.5 text-sm text-[#1d1d1f] placeholder-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#007aff]/20 focus:border-[#007aff] transition-all duration-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1d1d1f] mb-1.5">비밀번호 확인</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="비밀번호 재입력"
                required
                className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-[#1d1d1f] placeholder-[#86868b] focus:outline-none focus:ring-2 transition-all duration-200 ${
                  confirm && confirm !== password
                    ? 'border-[#ff3b30] focus:ring-[#ff3b30]/20'
                    : 'border-gray-300/60 focus:ring-[#007aff]/20 focus:border-[#007aff]'
                }`}
              />
              {confirm && confirm !== password && (
                <p className="mt-1 text-xs text-[#ff3b30]">비밀번호가 일치하지 않습니다.</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || (!!confirm && confirm !== password)}
              className="w-full mt-2 rounded-lg bg-[#007aff] text-white py-2.5 text-sm font-medium hover:bg-[#0066d6] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '가입 중...' : '회원가입'}
            </button>
          </form>

          <div className="mt-5 pt-5 border-t border-gray-100 text-center">
            <p className="text-sm text-[#86868b]">
              이미 계정이 있으신가요?{' '}
              <Link href="/login" className="text-[#007aff] font-medium hover:underline">
                로그인
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-[#86868b] mt-6">
          문구 도매 통합 관리 시스템 v1.0
        </p>
      </div>
    </div>
  )
}
