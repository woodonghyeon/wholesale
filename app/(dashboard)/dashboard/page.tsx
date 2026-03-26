import { isSupabaseConfigured } from '@/lib/supabase/client'

export default function DashboardPage() {
  const configured = isSupabaseConfigured()

  if (!configured) {
    return (
      <div className="max-w-lg mx-auto mt-16 bg-amber-50 border border-amber-200 rounded-2xl p-8">
        <h2 className="text-lg font-bold text-amber-800 mb-2">Supabase 연결 필요</h2>
        <p className="text-sm text-amber-700 mb-4">
          <code className="bg-amber-100 px-1 rounded">.env.local</code> 파일에 아래 값을 입력해주세요.
        </p>
        <pre className="bg-white border border-amber-200 rounded-lg p-4 text-xs text-gray-700 leading-relaxed">
{`NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...`}
        </pre>
        <p className="text-xs text-amber-600 mt-3">
          Supabase 대시보드 → Settings → API에서 확인하세요.
        </p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">대시보드</h1>
      <p className="text-gray-500 text-sm">준비 중입니다.</p>
    </div>
  )
}
