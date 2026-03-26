'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/ui/PageHeader'
import { getActivityLogs, subscribeToLogs, ActivityLog, ActionType } from '@/lib/supabase/logs'

// ─── 색상 매핑 ────────────────────────────────────────────
const ACTION_COLOR: Record<string, string> = {
  'auth.login':  'text-green-400',
  'auth.signup': 'text-blue-400',
  'auth.logout': 'text-gray-400',
  'create':      'text-cyan-400',
  'update':      'text-yellow-400',
  'delete':      'text-red-400',
  'adjust':      'text-orange-400',
  'export':      'text-purple-400',
  'error':       'text-red-500',
}

const ACTION_BADGE: Record<string, string> = {
  'auth.login':  'bg-green-100 text-green-700',
  'auth.signup': 'bg-blue-100 text-blue-700',
  'auth.logout': 'bg-gray-100 text-gray-600',
  'create':      'bg-cyan-100 text-cyan-700',
  'update':      'bg-yellow-100 text-yellow-700',
  'delete':      'bg-red-100 text-red-700',
  'adjust':      'bg-orange-100 text-orange-700',
  'export':      'bg-purple-100 text-purple-700',
  'error':       'bg-red-100 text-red-700',
}

const RESOURCE_LABEL: Record<string, string> = {
  slip: '거래명세표', product: '상품', partner: '거래처', inventory: '재고',
  payment: '수금/지급', note: '어음', return: '반품', quote: '견적/발주',
  customer: '정기고객', cash: '현금출납', tax: '세금계산서', stocktake: '재고실사',
  auth: '인증', settings: '설정',
}

function formatTs(ts: string) {
  const d = new Date(ts)
  return d.toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function TerminalLine({ log }: { log: ActivityLog }) {
  const color = ACTION_COLOR[log.action_type] ?? 'text-gray-300'
  const ts = new Date(log.created_at).toLocaleTimeString('ko-KR', { hour12: false })
  return (
    <div className="font-mono text-xs leading-5 hover:bg-white/5 px-2 py-0.5 rounded">
      <span className="text-gray-500 select-none">[{ts}] </span>
      <span className={`${color} font-bold`}>{log.action_type.toUpperCase().padEnd(12, ' ')}</span>
      {log.resource_type && (
        <span className="text-gray-400">[{log.resource_type}] </span>
      )}
      <span className="text-gray-200">{log.description}</span>
      {log.user_agent && (
        <span className="text-gray-600 ml-2 text-[10px]">• {log.user_agent.slice(0, 60)}</span>
      )}
    </div>
  )
}

export default function LogsPage() {
  const [tab, setTab] = useState<'auth' | 'activity' | 'terminal'>('activity')
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [termLogs, setTermLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(false)
  const [actionFilter, setActionFilter] = useState('all')
  const [resourceFilter, setResourceFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [isLive, setIsLive] = useState(false)
  const terminalRef = useRef<HTMLDivElement>(null)
  const unsubRef = useRef<(() => void) | null>(null)

  // 로그 로드
  const loadLogs = useCallback(async () => {
    setLoading(true)
    try {
      const actionType = tab === 'auth'
        ? undefined  // auth 탭은 client-side filter
        : (actionFilter !== 'all' ? actionFilter : undefined)
      const data = await getActivityLogs({
        actionType,
        resourceType: resourceFilter !== 'all' ? resourceFilter : undefined,
        from: dateFrom || undefined,
        to: dateTo || undefined,
        limit: 500,
      })
      if (tab === 'auth') {
        setLogs(data.filter(l => l.action_type.startsWith('auth.')))
      } else {
        setLogs(data)
      }
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setLoading(false) }
  }, [tab, actionFilter, resourceFilter, dateFrom, dateTo])

  useEffect(() => {
    if (tab !== 'terminal') loadLogs()
  }, [loadLogs, tab])

  // 터미널 탭: 최근 100개 로드
  useEffect(() => {
    if (tab !== 'terminal') return
    getActivityLogs({ limit: 100 }).then(data => setTermLogs([...data].reverse()))
  }, [tab])

  // 실시간 구독
  useEffect(() => {
    if (!isLive) {
      unsubRef.current?.()
      unsubRef.current = null
      return
    }
    const unsub = subscribeToLogs((log) => {
      setTermLogs(prev => [...prev, log])
    })
    unsubRef.current = unsub
    return () => unsub()
  }, [isLive])

  // 터미널 자동 스크롤
  useEffect(() => {
    if (tab === 'terminal' && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [termLogs, tab])

  // 정리
  useEffect(() => () => { unsubRef.current?.() }, [])

  const authLogs = logs.filter(l => l.action_type.startsWith('auth.'))
  const activityLogs = logs

  return (
    <div>
      <PageHeader title="시스템 로그" description="인증·활동 이벤트 및 실시간 로그 스트림" />

      {/* 탭 */}
      <div className="flex border-b border-gray-200 mb-5">
        {([
          { key: 'activity', label: '활동 로그' },
          { key: 'auth',     label: '인증 로그' },
          { key: 'terminal', label: '실시간 터미널' },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 활동 로그 탭 */}
      {tab === 'activity' && (
        <>
          {/* 필터 */}
          <div className="flex flex-wrap gap-2 mb-4">
            <select value={actionFilter} onChange={e => setActionFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="all">전체 액션</option>
              {['create','update','delete','adjust','export','error'].map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <select value={resourceFilter} onChange={e => setResourceFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="all">전체 리소스</option>
              {Object.entries(RESOURCE_LABEL).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <span className="self-center text-gray-400 text-sm">~</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button onClick={loadLogs}
              className="px-3 py-1.5 text-sm bg-gray-800 text-white rounded-lg hover:bg-gray-700">
              새로고침
            </button>
          </div>

          <LogTable logs={activityLogs} loading={loading} />
        </>
      )}

      {/* 인증 로그 탭 */}
      {tab === 'auth' && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-5">
            {[
              { label: '전체 로그인', count: logs.filter(l => l.action_type === 'auth.login').length, color: 'text-green-600' },
              { label: '회원가입', count: logs.filter(l => l.action_type === 'auth.signup').length, color: 'text-blue-600' },
              { label: '로그아웃', count: logs.filter(l => l.action_type === 'auth.logout').length, color: 'text-gray-600' },
            ].map(s => (
              <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-4">
                <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.count}<span className="text-sm font-normal ml-1">건</span></p>
              </div>
            ))}
          </div>

          <div className="flex gap-2 mb-4">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <span className="self-center text-gray-400 text-sm">~</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button onClick={loadLogs}
              className="px-3 py-1.5 text-sm bg-gray-800 text-white rounded-lg hover:bg-gray-700">
              새로고침
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {loading ? (
              <div className="py-16 text-center text-sm text-gray-400">불러오는 중...</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    {['시각', '구분', '이메일/설명', '접속 환경', '결과'].map(h => (
                      <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {authLogs.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400">인증 로그가 없습니다<br /><span className="text-xs text-gray-300">로그인/회원가입 시 자동으로 기록됩니다</span></td></tr>
                  )}
                  {authLogs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">{formatTs(log.created_at)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${ACTION_BADGE[log.action_type] ?? 'bg-gray-100 text-gray-600'}`}>
                          {log.action_type === 'auth.login' ? '로그인'
                            : log.action_type === 'auth.signup' ? '회원가입'
                            : log.action_type === 'auth.logout' ? '로그아웃'
                            : log.action_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{log.description ?? '-'}</td>
                      <td className="px-4 py-3 text-xs text-gray-400 max-w-[200px] truncate" title={log.user_agent ?? ''}>
                        {log.user_agent ? parseUA(log.user_agent) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        {(log.metadata as any)?.reason === 'invalid_credentials' ? (
                          <span className="text-xs text-red-500">실패</span>
                        ) : (
                          <span className="text-xs text-green-600">성공</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* 실시간 터미널 탭 */}
      {tab === 'terminal' && (
        <div className="rounded-xl overflow-hidden border border-gray-800">
          {/* 터미널 헤더 */}
          <div className="bg-gray-900 px-4 py-2.5 flex items-center justify-between border-b border-gray-800">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="ml-3 text-xs text-gray-400 font-mono">wholesale — activity_logs stream</span>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs font-mono ${isLive ? 'text-green-400' : 'text-gray-500'}`}>
                {isLive ? '● LIVE' : '○ PAUSED'}
              </span>
              <button
                onClick={() => setIsLive(v => !v)}
                className={`px-3 py-1 text-xs rounded font-mono transition-colors ${
                  isLive
                    ? 'bg-red-900 text-red-400 hover:bg-red-800'
                    : 'bg-green-900 text-green-400 hover:bg-green-800'
                }`}
              >
                {isLive ? 'STOP' : 'START'}
              </button>
              <button
                onClick={() => setTermLogs([])}
                className="px-3 py-1 text-xs rounded font-mono bg-gray-800 text-gray-400 hover:bg-gray-700"
              >
                CLEAR
              </button>
            </div>
          </div>

          {/* 터미널 본문 */}
          <div
            ref={terminalRef}
            className="bg-gray-950 text-gray-300 p-3 h-[calc(100vh-280px)] overflow-y-auto"
          >
            {termLogs.length === 0 ? (
              <div className="font-mono text-xs text-gray-600 p-2">
                <span className="text-green-500">$</span> Waiting for events...<span className="animate-pulse">_</span>
              </div>
            ) : (
              termLogs.map((log, i) => <TerminalLine key={log.id ?? i} log={log} />)
            )}
            {isLive && (
              <div className="font-mono text-xs text-gray-600 mt-1 px-2">
                <span className="text-green-500">$</span> <span className="animate-pulse">_</span>
              </div>
            )}
          </div>

          {/* 하단 상태바 */}
          <div className="bg-gray-900 border-t border-gray-800 px-4 py-1.5 flex items-center justify-between">
            <span className="text-xs font-mono text-gray-500">
              {termLogs.length} events
              {isLive && <span className="text-green-400 ml-2">• realtime connected</span>}
            </span>
            <span className="text-xs font-mono text-gray-600">UTF-8</span>
          </div>
        </div>
      )}
    </div>
  )
}

function LogTable({ logs, loading }: { logs: ActivityLog[]; loading: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      {loading ? (
        <div className="py-16 text-center text-sm text-gray-400">불러오는 중...</div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              {['시각', '액션', '리소스', '설명', '사용자'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {logs.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                활동 로그가 없습니다<br />
                <span className="text-xs text-gray-300">거래 입력, 재고 조정 등의 작업이 여기 기록됩니다</span>
              </td></tr>
            )}
            {logs.map(log => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 font-mono text-xs text-gray-500 whitespace-nowrap">{formatTs(log.created_at)}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${ACTION_BADGE[log.action_type] ?? 'bg-gray-100 text-gray-600'}`}>
                    {log.action_type}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-gray-500 text-xs">
                  {log.resource_type ? RESOURCE_LABEL[log.resource_type] ?? log.resource_type : '-'}
                </td>
                <td className="px-4 py-2.5 text-gray-700 max-w-[300px] truncate">{log.description ?? '-'}</td>
                <td className="px-4 py-2.5 text-xs text-gray-400 max-w-[120px] truncate" title={log.user_id ?? ''}>
                  {log.user_id ? log.user_id.slice(0, 8) + '…' : 'system'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function parseUA(ua: string): string {
  if (ua.includes('Chrome')) {
    const m = ua.match(/Chrome\/([\d.]+)/)
    const os = ua.includes('Windows') ? 'Windows'
      : ua.includes('Mac') ? 'macOS'
      : ua.includes('Android') ? 'Android'
      : ua.includes('iPhone') ? 'iPhone'
      : 'Unknown'
    return `Chrome ${m?.[1]?.split('.')[0] ?? ''} / ${os}`
  }
  if (ua.includes('Firefox')) {
    const m = ua.match(/Firefox\/([\d.]+)/)
    return `Firefox ${m?.[1]?.split('.')[0] ?? ''}`
  }
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari'
  return ua.slice(0, 40)
}
