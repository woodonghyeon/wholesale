'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/ui/PageHeader'
import {
  getActivityLogs, getStockLogs, subscribeToLogs,
  ActivityLog, StockLogRow,
} from '@/lib/supabase/logs'
import type { ServerLogEntry } from '@/lib/server/log-store'

// ─── 터미널 통합 엔트리 타입 ─────────────────────────────────
type TermEntry =
  | { kind: 'server'; log: ServerLogEntry }
  | { kind: 'activity'; log: ActivityLog }

// ─── 상수 ────────────────────────────────────────────────
const ACTION_BADGE: Record<string, string> = {
  'auth.login':  'bg-green-100 text-green-700',
  'auth.signup': 'bg-blue-100 text-blue-700',
  'auth.logout': 'bg-gray-100 text-gray-600',
  'create':      'bg-cyan-100 text-cyan-700',
  'update':      'bg-yellow-100 text-yellow-700',
  'delete':      'bg-red-100 text-red-700',
  'adjust':      'bg-orange-100 text-orange-700',
  'export':      'bg-purple-100 text-purple-700',
  'error':       'bg-red-200 text-red-800',
}
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
const RESOURCE_LABEL: Record<string, string> = {
  slip: '거래명세표', product: '상품', partner: '거래처', inventory: '재고',
  payment: '수금/지급', note: '어음', return: '반품', quote: '견적/발주',
  customer: '정기고객', cash: '현금출납', tax: '세금계산서', stocktake: '재고실사',
  auth: '인증', settings: '설정',
}
const STOCK_LOG_TYPE: Record<string, { label: string; color: string }> = {
  in:           { label: '입고', color: 'text-green-600' },
  out:          { label: '출고', color: 'text-red-500' },
  adjustment:   { label: '조정', color: 'text-orange-500' },
  return_in:    { label: '반품입고', color: 'text-blue-500' },
  return_out:   { label: '반품출고', color: 'text-purple-500' },
  transfer_in:  { label: '이동입고', color: 'text-teal-600' },
  transfer_out: { label: '이동출고', color: 'text-teal-500' },
  bundle_out:   { label: '묶음출고', color: 'text-gray-600' },
}

function formatTs(ts: string) {
  return new Date(ts).toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}
function parseUA(ua: string): string {
  const os = ua.includes('Windows') ? 'Windows'
    : ua.includes('Mac') ? 'macOS'
    : ua.includes('Android') ? 'Android'
    : ua.includes('iPhone') ? 'iPhone' : ''
  if (ua.includes('Chrome')) {
    const m = ua.match(/Chrome\/([\d]+)/)
    return `Chrome ${m?.[1] ?? ''} ${os ? '/ ' + os : ''}`
  }
  if (ua.includes('Firefox')) {
    const m = ua.match(/Firefox\/([\d]+)/)
    return `Firefox ${m?.[1] ?? ''}`
  }
  if (ua.includes('Safari') && !ua.includes('Chrome')) return `Safari${os ? ' / ' + os : ''}`
  return ua.slice(0, 40)
}

// ─── 터미널 행 ───────────────────────────────────────────
function statusColor(s?: number) {
  if (!s) return 'text-gray-500'
  if (s < 300) return 'text-green-400'
  if (s < 400) return 'text-cyan-400'
  if (s < 500) return 'text-yellow-400'
  return 'text-red-400'
}
const METHOD_COLOR: Record<string, string> = {
  GET: 'text-blue-400', POST: 'text-green-400', PUT: 'text-yellow-400',
  PATCH: 'text-yellow-400', DELETE: 'text-red-400', OPTIONS: 'text-gray-500',
}

function ServerLine({ log }: { log: ServerLogEntry }) {
  const ts = new Date(log.ts).toLocaleTimeString('ko-KR', { hour12: false })
  if (log.type === 'http') {
    const sc = statusColor(log.status)
    const mc = METHOD_COLOR[log.method ?? ''] ?? 'text-gray-300'
    return (
      <div className="font-mono text-xs leading-5 hover:bg-white/5 px-2 py-0.5 rounded">
        <span className="text-gray-600 select-none">[{ts}] </span>
        <span className="text-gray-500 text-[10px] mr-1">HTTP</span>
        <span className={`${mc} font-bold w-8 inline-block`}>{log.method}</span>
        <span className="text-gray-300 ml-1">{log.path}</span>
        <span className="mx-1 text-gray-600">→</span>
        <span className={`${sc} font-bold`}>{log.status}</span>
        {log.duration !== undefined && (
          <span className="text-gray-600 ml-1 text-[10px]">{log.duration}ms</span>
        )}
        {log.ip && log.ip !== 'local' && (
          <span className="text-gray-700 ml-2 text-[10px]">• {log.ip}</span>
        )}
      </div>
    )
  }
  if (log.type === 'error') {
    return (
      <div className="font-mono text-xs leading-5 hover:bg-white/5 px-2 py-0.5 rounded">
        <span className="text-gray-600 select-none">[{ts}] </span>
        <span className="text-red-500 font-bold">ERROR{'        '}</span>
        <span className="text-red-300">{log.message}</span>
      </div>
    )
  }
  if (log.type === 'warn') {
    return (
      <div className="font-mono text-xs leading-5 hover:bg-white/5 px-2 py-0.5 rounded">
        <span className="text-gray-600 select-none">[{ts}] </span>
        <span className="text-yellow-400 font-bold">WARN{'         '}</span>
        <span className="text-yellow-200">{log.message}</span>
      </div>
    )
  }
  return (
    <div className="font-mono text-xs leading-5 hover:bg-white/5 px-2 py-0.5 rounded">
      <span className="text-gray-600 select-none">[{ts}] </span>
      <span className="text-gray-400 font-bold">INFO{'         '}</span>
      <span className="text-gray-400">{log.message}</span>
    </div>
  )
}

function ActivityLine({ log }: { log: ActivityLog }) {
  const color = ACTION_COLOR[log.action_type] ?? 'text-gray-300'
  const ts = new Date(log.created_at).toLocaleTimeString('ko-KR', { hour12: false })
  const email = (log.metadata as any)?._email as string | null
  return (
    <div className="font-mono text-xs leading-5 hover:bg-white/5 px-2 py-0.5 rounded">
      <span className="text-gray-600 select-none">[{ts}] </span>
      <span className="text-gray-500 text-[10px] mr-1">APP </span>
      <span className={`${color} font-bold`}>{log.action_type.toUpperCase().slice(0, 8).padEnd(9)}</span>
      {log.resource_type && <span className="text-gray-500">[{log.resource_type}] </span>}
      <span className="text-gray-200">{log.description}</span>
      {email && <span className="text-cyan-700 ml-2">@{email.split('@')[0]}</span>}
    </div>
  )
}

function TerminalLine({ entry }: { entry: TermEntry }) {
  if (entry.kind === 'server') return <ServerLine log={entry.log} />
  return <ActivityLine log={entry.log} />
}

// ─── 메인 컴포넌트 ───────────────────────────────────────
type TabKey = 'activity' | 'auth' | 'stock' | 'error' | 'terminal'

export default function LogsPage() {
  const [tab, setTab] = useState<TabKey>('activity')

  // 필터
  const [actionFilter, setActionFilter] = useState('all')
  const [resourceFilter, setResourceFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [stockTypeFilter, setStockTypeFilter] = useState('all')

  // 데이터
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [stockLogs, setStockLogs] = useState<StockLogRow[]>([])
  const [errorLogs, setErrorLogs] = useState<ActivityLog[]>([])
  const [termEntries, setTermEntries] = useState<TermEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [isLive, setIsLive] = useState(false)
  const [termFilter, setTermFilter] = useState<'all' | 'server' | 'activity'>('all')
  const terminalRef = useRef<HTMLDivElement>(null)
  const unsubRef = useRef<(() => void) | null>(null)
  const sseRef = useRef<EventSource | null>(null)

  // ── 로그 로드 ──────────────────────────────────────────
  const loadLogs = useCallback(async () => {
    setLoading(true)
    try {
      if (tab === 'activity') {
        const data = await getActivityLogs({
          actionType: actionFilter !== 'all' ? actionFilter : undefined,
          resourceType: resourceFilter !== 'all' ? resourceFilter : undefined,
          from: dateFrom || undefined,
          to: dateTo || undefined,
          limit: 500,
        })
        setLogs(data.filter(l => !l.action_type.startsWith('auth.')))
      } else if (tab === 'auth') {
        const data = await getActivityLogs({
          from: dateFrom || undefined,
          to: dateTo || undefined,
          limit: 500,
        })
        setLogs(data.filter(l => l.action_type.startsWith('auth.')))
      } else if (tab === 'stock') {
        setStockLogs(await getStockLogs({
          logType: stockTypeFilter !== 'all' ? stockTypeFilter : undefined,
          from: dateFrom || undefined,
          to: dateTo || undefined,
          limit: 500,
        }))
      } else if (tab === 'error') {
        setErrorLogs(await getActivityLogs({ actionType: 'error', limit: 500 }))
      }
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setLoading(false) }
  }, [tab, actionFilter, resourceFilter, dateFrom, dateTo, stockTypeFilter])

  useEffect(() => { if (tab !== 'terminal') loadLogs() }, [loadLogs, tab])

  // 터미널 초기 로드 (활동 로그 최근 100건)
  useEffect(() => {
    if (tab !== 'terminal') return
    getActivityLogs({ limit: 100 }).then(d => {
      const entries: TermEntry[] = [...d].reverse().map(log => ({ kind: 'activity', log }))
      setTermEntries(prev => {
        // 서버 로그가 이미 있으면 병합 후 시간순 정렬
        const merged = [...prev.filter(e => e.kind === 'server'), ...entries]
        return merged.sort((a, b) => {
          const ta = a.kind === 'server' ? a.log.ts : new Date(a.log.created_at).getTime()
          const tb = b.kind === 'server' ? b.log.ts : new Date(b.log.created_at).getTime()
          return ta - tb
        })
      })
    })
  }, [tab])

  // LIVE 전환 시 SSE + Supabase Realtime 동시 구독
  useEffect(() => {
    if (!isLive) {
      unsubRef.current?.(); unsubRef.current = null
      sseRef.current?.close(); sseRef.current = null
      return
    }

    // 1) Supabase Realtime (활동 로그)
    const unsub = subscribeToLogs(log => {
      setTermEntries(prev => [...prev, { kind: 'activity', log }])
    })
    unsubRef.current = unsub

    // 2) SSE (서버 HTTP 로그)
    const es = new EventSource('/api/server-logs/stream')
    es.onmessage = (e) => {
      try {
        const log: ServerLogEntry = JSON.parse(e.data)
        setTermEntries(prev => [...prev, { kind: 'server', log }])
      } catch { /* ignore */ }
    }
    es.onerror = () => { es.close(); sseRef.current = null }
    sseRef.current = es

    return () => { unsub(); es.close() }
  }, [isLive])

  // 터미널 자동 스크롤
  useEffect(() => {
    if (tab === 'terminal' && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [termEntries, tab])

  useEffect(() => () => {
    unsubRef.current?.()
    sseRef.current?.close()
  }, [])

  // ── 탭별 요약 수치 ────────────────────────────────────
  const tabs = [
    { key: 'activity' as TabKey, label: '활동 로그' },
    { key: 'auth'     as TabKey, label: '인증 로그' },
    { key: 'stock'    as TabKey, label: '재고 수불' },
    { key: 'error'    as TabKey, label: '에러 로그' },
    { key: 'terminal' as TabKey, label: '실시간 터미널' },
  ]

  return (
    <div>
      <PageHeader title="시스템 로그" description="인증·활동·재고 수불·에러 이벤트 및 실시간 터미널" />

      {/* 탭 */}
      <div className="flex border-b border-gray-200 mb-5">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
            {t.key === 'error' && errorLogs.length > 0 && tab !== 'error' && (
              <span className="ml-1.5 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">{errorLogs.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── 활동 로그 ── */}
      {tab === 'activity' && (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            <select value={actionFilter} onChange={e => setActionFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="all">전체 액션</option>
              {['create','update','delete','adjust','export'].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <select value={resourceFilter} onChange={e => setResourceFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="all">전체 리소스</option>
              {Object.entries(RESOURCE_LABEL).filter(([v]) => v !== 'auth').map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <DateFilters from={dateFrom} to={dateTo} onFrom={setDateFrom} onTo={setDateTo} onRefresh={loadLogs} />
          </div>
          <ActivityTable logs={logs} loading={loading} />
        </>
      )}

      {/* ── 인증 로그 ── */}
      {tab === 'auth' && (
        <>
          {/* 요약 */}
          <div className="grid grid-cols-4 gap-4 mb-5">
            {[
              { label: '로그인 성공', count: logs.filter(l => l.action_type === 'auth.login' && (l.metadata as any)?.reason !== 'invalid_credentials').length, color: 'text-green-600' },
              { label: '로그인 실패', count: logs.filter(l => l.action_type === 'auth.login' && (l.metadata as any)?.reason === 'invalid_credentials').length, color: 'text-red-500' },
              { label: '회원가입', count: logs.filter(l => l.action_type === 'auth.signup').length, color: 'text-blue-600' },
              { label: '로그아웃', count: logs.filter(l => l.action_type === 'auth.logout').length, color: 'text-gray-600' },
            ].map(s => (
              <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-4">
                <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.count}<span className="text-sm font-normal ml-1">건</span></p>
              </div>
            ))}
          </div>

          {/* 실패 패턴 */}
          {(() => {
            const failures = logs.filter(l => l.action_type === 'auth.login' && (l.metadata as any)?.reason === 'invalid_credentials')
            const byEmail: Record<string, number> = {}
            failures.forEach(l => {
              const email = (l.metadata as any)?.email ?? 'unknown'
              byEmail[email] = (byEmail[email] ?? 0) + 1
            })
            const top = Object.entries(byEmail).sort((a, b) => b[1] - a[1]).slice(0, 5)
            if (top.length === 0) return null
            return (
              <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-4">
                <p className="text-sm font-semibold text-red-700 mb-2">⚠ 로그인 실패 패턴</p>
                <div className="space-y-1">
                  {top.map(([email, count]) => (
                    <div key={email} className="flex items-center gap-3">
                      <span className="text-sm text-gray-700 flex-1">{email}</span>
                      <div className="w-32 bg-red-100 rounded-full h-2 overflow-hidden">
                        <div className="bg-red-500 h-2 rounded-full" style={{ width: `${Math.min(100, count * 20)}%` }} />
                      </div>
                      <span className="text-xs text-red-600 font-bold w-8 text-right">{count}회</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          <div className="flex gap-2 mb-4">
            <DateFilters from={dateFrom} to={dateTo} onFrom={setDateFrom} onTo={setDateTo} onRefresh={loadLogs} />
          </div>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>{['시각','구분','이메일/설명','접속 환경','결과'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading && <tr><td colSpan={5} className="py-12 text-center text-sm text-gray-400">불러오는 중...</td></tr>}
                {!loading && logs.length === 0 && (
                  <tr><td colSpan={5} className="py-12 text-center text-sm text-gray-400">
                    인증 로그가 없습니다<br />
                    <span className="text-xs text-gray-300">로그인/회원가입 시 자동으로 기록됩니다</span>
                  </td></tr>
                )}
                {logs.map(log => {
                  const fail = (log.metadata as any)?.reason === 'invalid_credentials'
                  return (
                    <tr key={log.id} className={`hover:bg-gray-50 ${fail ? 'bg-red-50' : ''}`}>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">{formatTs(log.created_at)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${ACTION_BADGE[log.action_type] ?? 'bg-gray-100 text-gray-600'}`}>
                          {log.action_type === 'auth.login' ? '로그인' : log.action_type === 'auth.signup' ? '회원가입' : '로그아웃'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{log.description ?? '-'}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{log.user_agent ? parseUA(log.user_agent) : '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${fail ? 'text-red-500' : 'text-green-600'}`}>
                          {fail ? '✗ 실패' : '✓ 성공'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── 재고 수불 로그 ── */}
      {tab === 'stock' && (
        <>
          {/* 요약 바 */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            {(['in','out','adjustment','return_in'] as const).map(t => {
              const info = STOCK_LOG_TYPE[t]
              const sum = stockLogs.filter(l => l.log_type === t).reduce((s, l) => s + Math.abs(l.quantity), 0)
              return (
                <div key={t} className="bg-white border border-gray-100 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-1">{info.label}</p>
                  <p className={`text-lg font-bold ${info.color}`}>{sum.toLocaleString()}<span className="text-xs font-normal ml-1">개</span></p>
                </div>
              )
            })}
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <select value={stockTypeFilter} onChange={e => setStockTypeFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="all">전체 유형</option>
              {Object.entries(STOCK_LOG_TYPE).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
            </select>
            <DateFilters from={dateFrom} to={dateTo} onFrom={setDateFrom} onTo={setDateTo} onRefresh={loadLogs} />
          </div>

          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>{['시각','유형','상품','창고','수량','메모'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading && <tr><td colSpan={6} className="py-12 text-center text-sm text-gray-400">불러오는 중...</td></tr>}
                {!loading && stockLogs.length === 0 && (
                  <tr><td colSpan={6} className="py-12 text-center text-sm text-gray-400">
                    재고 수불 이력이 없습니다<br />
                    <span className="text-xs text-gray-300">재고 조정, 거래 입력 시 자동 기록됩니다</span>
                  </td></tr>
                )}
                {stockLogs.map(log => {
                  const info = STOCK_LOG_TYPE[log.log_type] ?? { label: log.log_type, color: 'text-gray-600' }
                  return (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-500 whitespace-nowrap">{formatTs(log.created_at)}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs font-semibold ${info.color}`}>{info.label}</span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-700">{log.product_name ?? '-'}</td>
                      <td className="px-4 py-2.5 text-gray-500">{log.warehouse_name ?? '-'}</td>
                      <td className={`px-4 py-2.5 font-bold ${log.quantity >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {log.quantity > 0 ? '+' : ''}{log.quantity}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-400 max-w-[160px] truncate">{log.note ?? '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── 에러 로그 ── */}
      {tab === 'error' && (
        <>
          {errorLogs.length > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-4 flex items-center gap-3">
              <span className="text-2xl">⚠</span>
              <div>
                <p className="text-sm font-semibold text-red-700">{errorLogs.length}개의 에러가 기록되었습니다</p>
                <p className="text-xs text-red-500">가장 최근: {formatTs(errorLogs[0]?.created_at ?? '')}</p>
              </div>
            </div>
          )}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>{['시각','리소스','설명','세부 정보'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading && <tr><td colSpan={4} className="py-12 text-center text-sm text-gray-400">불러오는 중...</td></tr>}
                {!loading && errorLogs.length === 0 && (
                  <tr><td colSpan={4} className="py-12 text-center text-sm text-gray-400">에러 로그가 없습니다 ✓</td></tr>
                )}
                {errorLogs.map(log => (
                  <tr key={log.id} className="hover:bg-red-50 bg-red-50/30">
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-500 whitespace-nowrap">{formatTs(log.created_at)}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{log.resource_type ? RESOURCE_LABEL[log.resource_type] ?? log.resource_type : '-'}</td>
                    <td className="px-4 py-2.5 text-red-700">{log.description}</td>
                    <td className="px-4 py-2.5">
                      {Object.keys(log.metadata ?? {}).length > 0 && (
                        <details className="text-xs text-gray-400 cursor-pointer">
                          <summary>자세히</summary>
                          <pre className="mt-1 bg-gray-50 rounded p-2 text-[10px] overflow-auto max-w-[300px]">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── 실시간 터미널 ── */}
      {tab === 'terminal' && (
        <div className="rounded-xl overflow-hidden border border-gray-800">
          {/* 타이틀바 */}
          <div className="bg-gray-900 px-4 py-2.5 flex items-center justify-between border-b border-gray-800">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="ml-3 text-xs text-gray-400 font-mono">
                wholesale — server + app stream
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* 필터 토글 */}
              <div className="flex rounded overflow-hidden border border-gray-700 text-[10px] font-mono">
                {(['all', 'server', 'activity'] as const).map(f => (
                  <button key={f} onClick={() => setTermFilter(f)}
                    className={`px-2 py-1 transition-colors ${termFilter === f ? 'bg-gray-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                    {f === 'all' ? 'ALL' : f === 'server' ? 'HTTP' : 'APP'}
                  </button>
                ))}
              </div>
              <span className={`text-xs font-mono ${isLive ? 'text-green-400' : 'text-gray-500'}`}>
                {isLive ? '● LIVE' : '○ PAUSED'}
              </span>
              <button onClick={() => setIsLive(v => !v)}
                className={`px-3 py-1 text-xs rounded font-mono transition-colors ${
                  isLive ? 'bg-red-900 text-red-400 hover:bg-red-800' : 'bg-green-900 text-green-400 hover:bg-green-800'
                }`}>
                {isLive ? 'STOP' : 'START'}
              </button>
              <button onClick={() => setTermEntries([])}
                className="px-3 py-1 text-xs rounded font-mono bg-gray-800 text-gray-400 hover:bg-gray-700">
                CLEAR
              </button>
            </div>
          </div>

          {/* 로그 본문 */}
          <div ref={terminalRef}
            className="bg-gray-950 text-gray-300 p-3 h-[calc(100vh-300px)] overflow-y-auto">
            {termEntries.length === 0 ? (
              <div className="font-mono text-xs text-gray-600 p-2">
                <span className="text-green-500">$</span>{' '}
                START 버튼을 누르면 HTTP 요청과 앱 이벤트가 실시간으로 표시됩니다
                <span className="animate-pulse">_</span>
              </div>
            ) : (
              termEntries
                .filter(e => termFilter === 'all' || e.kind === (termFilter === 'server' ? 'server' : 'activity'))
                .map((entry, i) => (
                  <TerminalLine key={entry.kind === 'server' ? entry.log.id : (entry.log as ActivityLog).id ?? i} entry={entry} />
                ))
            )}
            {isLive && (
              <div className="font-mono text-xs text-gray-600 mt-1 px-2">
                <span className="text-green-500">$</span> <span className="animate-pulse">_</span>
              </div>
            )}
          </div>

          {/* 상태바 */}
          <div className="bg-gray-900 border-t border-gray-800 px-4 py-1.5 flex items-center justify-between">
            <span className="text-xs font-mono text-gray-500 flex items-center gap-3">
              <span>{termEntries.filter(e => e.kind === 'server').length} HTTP</span>
              <span className="text-gray-700">|</span>
              <span>{termEntries.filter(e => e.kind === 'activity').length} APP</span>
              {isLive && (
                <>
                  <span className="text-gray-700">|</span>
                  <span className="text-green-400">● SSE connected</span>
                  <span className="text-cyan-600">● Realtime connected</span>
                </>
              )}
            </span>
            <div className="flex items-center gap-3 text-[10px] font-mono text-gray-700">
              <span className="text-blue-600">GET</span>
              <span className="text-green-600">POST</span>
              <span className="text-yellow-600">PUT/PATCH</span>
              <span className="text-red-600">DELETE</span>
              <span className="text-gray-600">UTF-8</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 공통 컴포넌트 ────────────────────────────────────────
function DateFilters({ from, to, onFrom, onTo, onRefresh }: {
  from: string; to: string
  onFrom: (v: string) => void; onTo: (v: string) => void
  onRefresh: () => void
}) {
  return (
    <>
      <input type="date" value={from} onChange={e => onFrom(e.target.value)}
        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
      <span className="self-center text-gray-400 text-sm">~</span>
      <input type="date" value={to} onChange={e => onTo(e.target.value)}
        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
      <button onClick={onRefresh}
        className="px-3 py-1.5 text-sm bg-gray-800 text-white rounded-lg hover:bg-gray-700">
        새로고침
      </button>
    </>
  )
}

function ActivityTable({ logs, loading }: { logs: ActivityLog[]; loading: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs text-gray-500">
          <tr>{['시각','사용자','액션','리소스','설명','변경 내용'].map(h => (
            <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
          ))}</tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {loading && <tr><td colSpan={6} className="py-12 text-center text-sm text-gray-400">불러오는 중...</td></tr>}
          {!loading && logs.length === 0 && (
            <tr><td colSpan={6} className="py-12 text-center text-sm text-gray-400">
              활동 로그가 없습니다<br />
              <span className="text-xs text-gray-300">거래 입력, 재고 조정 등의 작업이 여기 기록됩니다</span>
            </td></tr>
          )}
          {logs.map(log => {
            const email = (log.metadata as any)?._email as string | null
            const diff = (log.metadata as any)?.diff
            const hasDiff = diff && Object.keys(diff).length > 0
            return (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 font-mono text-xs text-gray-500 whitespace-nowrap">{formatTs(log.created_at)}</td>
                <td className="px-4 py-2.5 text-xs text-gray-600 max-w-[140px] truncate" title={email ?? ''}>
                  {email ?? <span className="text-gray-300">-</span>}
                </td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${ACTION_BADGE[log.action_type] ?? 'bg-gray-100 text-gray-600'}`}>
                    {log.action_type}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-xs text-gray-500">
                  {log.resource_type ? RESOURCE_LABEL[log.resource_type] ?? log.resource_type : '-'}
                </td>
                <td className="px-4 py-2.5 text-gray-700 max-w-[200px] truncate">{log.description ?? '-'}</td>
                <td className="px-4 py-2.5">
                  {hasDiff && (
                    <details className="text-xs text-gray-400 cursor-pointer">
                      <summary className="text-blue-500 hover:text-blue-700">diff 보기</summary>
                      <div className="mt-1 space-y-0.5 bg-gray-50 rounded p-2 text-[10px]">
                        {Object.entries(diff).map(([key, val]: [string, any]) => (
                          <div key={key}>
                            <span className="font-mono text-gray-500">{key}:</span>{' '}
                            <span className="text-red-400 line-through">{String(val.before)}</span>{' → '}
                            <span className="text-green-500">{String(val.after)}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
