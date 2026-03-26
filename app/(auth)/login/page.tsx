'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { logActivity } from '@/lib/supabase/logs'

const SAVED_EMAIL_KEY = 'wholesale_saved_email'

const loginSchema = z.object({
  email: z.string().email('올바른 이메일을 입력해주세요'),
  password: z.string().min(6, '비밀번호는 6자 이상이어야 합니다'),
})

const signupSchema = loginSchema.extend({
  passwordConfirm: z.string().min(6, '비밀번호는 6자 이상이어야 합니다'),
}).refine((d) => d.password === d.passwordConfirm, {
  message: '비밀번호가 일치하지 않습니다',
  path: ['passwordConfirm'],
})

type LoginData = z.infer<typeof loginSchema>
type SignupData = z.infer<typeof signupSchema>

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [rememberEmail, setRememberEmail] = useState(false)
  const [autoLogin, setAutoLogin] = useState(false)

  const loginForm = useForm<LoginData>({ resolver: zodResolver(loginSchema) })
  const signupForm = useForm<SignupData>({ resolver: zodResolver(signupSchema) })

  // 저장된 이메일 불러오기 & 자동 로그인 시도
  useEffect(() => {
    const saved = localStorage.getItem(SAVED_EMAIL_KEY)
    if (saved) {
      loginForm.setValue('email', saved)
      setRememberEmail(true)
    }
    // 자동 로그인: 세션이 살아있으면 바로 대시보드로
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/dashboard')
    })
  }, [])

  const handleLogin = async (data: LoginData) => {
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })
    if (error) {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.')
      await logActivity({ action_type: 'auth.login', resource_type: 'auth', description: `로그인 실패: ${data.email}`, metadata: { email: data.email, reason: 'invalid_credentials' } })
      return
    }
    await logActivity({ action_type: 'auth.login', resource_type: 'auth', description: `로그인: ${data.email}`, metadata: { email: data.email } })
    // 아이디 저장
    if (rememberEmail) {
      localStorage.setItem(SAVED_EMAIL_KEY, data.email)
    } else {
      localStorage.removeItem(SAVED_EMAIL_KEY)
    }
    router.push('/dashboard')
    router.refresh()
  }

  const handleSignup = async (data: SignupData) => {
    setError(null)
    setSuccess(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
    })
    if (error) {
      setError(error.message)
      return
    }
    await logActivity({ action_type: 'auth.signup', resource_type: 'auth', description: `회원가입: ${data.email}`, metadata: { email: data.email } })
    setSuccess('가입 확인 이메일을 발송했습니다. 이메일을 확인해주세요.')
    signupForm.reset()
  }

  const switchMode = (next: 'login' | 'signup') => {
    setMode(next)
    setError(null)
    setSuccess(null)
    loginForm.reset()
    signupForm.reset()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <h1 className="text-2xl font-bold text-center mb-1">문구 도매 관리</h1>
        <p className="text-sm text-gray-500 text-center mb-6">통합 관리 시스템</p>

        {/* 탭 */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden mb-6">
          {(['login', 'signup'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => switchMode(tab)}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                mode === tab
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              {tab === 'login' ? '로그인' : '회원가입'}
            </button>
          ))}
        </div>

        {/* 로그인 폼 */}
        {mode === 'login' && (
          <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">이메일</label>
              <input
                {...loginForm.register('email')}
                type="email"
                placeholder="admin@example.com"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {loginForm.formState.errors.email && (
                <p className="text-xs text-red-500 mt-1">{loginForm.formState.errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">비밀번호</label>
              <input
                {...loginForm.register('password')}
                type="password"
                placeholder="••••••••"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {loginForm.formState.errors.password && (
                <p className="text-xs text-red-500 mt-1">{loginForm.formState.errors.password.message}</p>
              )}
            </div>

            {/* 아이디 저장 / 자동 로그인 */}
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={rememberEmail} onChange={e => setRememberEmail(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300" />
                아이디 저장
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={autoLogin} onChange={e => setAutoLogin(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300" />
                자동 로그인
              </label>
            </div>

            {error && (
              <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            <button
              type="submit"
              disabled={loginForm.formState.isSubmitting}
              className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loginForm.formState.isSubmitting ? '로그인 중...' : '로그인'}
            </button>
          </form>
        )}

        {/* 회원가입 폼 */}
        {mode === 'signup' && (
          <form onSubmit={signupForm.handleSubmit(handleSignup)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">이메일</label>
              <input
                {...signupForm.register('email')}
                type="email"
                placeholder="admin@example.com"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {signupForm.formState.errors.email && (
                <p className="text-xs text-red-500 mt-1">{signupForm.formState.errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">비밀번호</label>
              <input
                {...signupForm.register('password')}
                type="password"
                placeholder="6자 이상"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {signupForm.formState.errors.password && (
                <p className="text-xs text-red-500 mt-1">{signupForm.formState.errors.password.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">비밀번호 확인</label>
              <input
                {...signupForm.register('passwordConfirm')}
                type="password"
                placeholder="비밀번호 재입력"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {signupForm.formState.errors.passwordConfirm && (
                <p className="text-xs text-red-500 mt-1">{signupForm.formState.errors.passwordConfirm.message}</p>
              )}
            </div>

            {error && (
              <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}
            {success && (
              <p className="text-xs text-green-700 bg-green-50 px-3 py-2 rounded-lg">{success}</p>
            )}

            <button
              type="submit"
              disabled={signupForm.formState.isSubmitting}
              className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {signupForm.formState.isSubmitting ? '가입 중...' : '회원가입'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
