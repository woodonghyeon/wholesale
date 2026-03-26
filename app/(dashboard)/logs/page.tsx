'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/ui/PageHeader'
import {
  getActivityLogs, getStockLogs, subscribeToLogs,
  ActivityLog, StockLogRow, ActionType,
} from '@/lib/supabase/logs'

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
function TerminalLine({ log }: { log: ActivityLog }) {
  const color = ACTION_COLOR[log.action_type] ?? 'text-gray-300'
  const ts = new Date(log.created_at).toLocaleTimeString('ko-KR', { hour12: false })
  return (
    <div className="font-mono text-xs leading-5 hover:bg-white/5 px-2 py-0.5 rounded">
      <span className="text-gray-500 select-none">[{ts}] </span>
      <span className={`${color} font-bold`}>{log.action_type.toUpperCase().padEnd(13, ' ')}</span>
      {log.resource_type && <span className="text-gray-400">[{log.resource_type}] </span>}
      <span className="text-gray-200">{log.description}</span>
      {log.user_agent && (
        <span className="text-gray-600 ml-2 text-[10px]">• {parseUA(log.user_agent)}</span>
      )}
    </div>
  )
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
  const [termLogs, setTermLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(false)
  const [isLive, setIsLive] = useState(false)
  const terminalRef = useRef<HTMLDivElement>(null)
  const unsubRef = useRef<(() => void) | null>(null)

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

  // 터미널 초기 로드
  useEffect(() => {
    if (tab !== 'terminal') return
    getActivityLogs({ limit: 100 }).then(d => setTermLogs([...d].reverse()))
  }, [tab])

  // 실시간 구독
  useEffect(() => {
    if (!isLive) { unsubRef.current?.(); unsubRef.current = null; return }
    const unsub = subscribeToLogs(log => setTermLogs(prev => [...prev, log]))
    unsubRef.current = unsub
    return () => unsub()
  }, [isLive])

  // 터미널 자동 스크롤
  useEffect(() => {
    if (tab === 'terminal' && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [termLogs, tab])

  useEffect(() => () => { unsubRef.current?.() }, [])

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
              <button onClick={() => setIsLive(v => !v)}
                className={`px-3 py-1 text-xs rounded font-mono transition-colors ${
                  isLive ? 'bg-red-900 text-red-400 hover:bg-red-800' : 'bg-green-900 text-green-400 hover:bg-green-800'
                }`}>
                {isLive ? 'STOP' : 'START'}
              </button>
              <button onClick={() => setTermLogs([])}
                className="px-3 py-1 text-xs rounded font-mono bg-gray-800 text-gray-400 hover:bg-gray-700">
                CLEAR
              </button>
            </div>
          </div>
          <div ref={terminalRef}
            className="bg-gray-950 text-gray-300 p-3 h-[calc(100vh-280px)] overflow-y-auto">
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
          <tr>{['시각','액션','리소스','설명','변경 내용'].map(h => (
            <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
          ))}</tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {loading && <tr><td colSpan={5} className="py-12 text-center text-sm text-gray-400">불러오는 중...</td></tr>}
          {!loading && logs.length === 0 && (
            <tr><td colSpan={5} className="py-12 text-center text-sm text-gray-400">
              활동 로그가 없습니다<br />
              <span className="text-xs text-gray-300">거래 입력, 재고 조정 등의 작업이 여기 기록됩니다</span>
            </td></tr>
          )}
          {logs.map(log => {
            const diff = (log.metadata as any)?.diff
            const hasDiff = diff && Object.keys(diff).length > 0
            return (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 font-mono text-xs text-gray-500 whitespace-nowrap">{formatTs(log.created_at)}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${ACTION_BADGE[log.action_type] ?? 'bg-gray-100 text-gray-600'}`}>
                    {log.action_type}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-xs text-gray-500">
                  {log.resource_type ? RESOURCE_LABEL[log.resource_type] ?? log.resource_type : '-'}
                </td>
                <td className="px-4 py-2.5 text-gray-700 max-w-[240px] truncate">{log.description ?? '-'}</td>
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
