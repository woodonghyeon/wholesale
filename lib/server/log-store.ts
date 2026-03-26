/**
 * 서버 사이드 전용 — Node.js 글로벌로 HMR 후에도 상태 유지
 * Edge 런타임에서 임포트 금지
 */

export type ServerLogType = 'http' | 'error' | 'warn' | 'info'

export interface ServerLogEntry {
  id: string
  ts: number                // Date.now()
  type: ServerLogType
  method?: string           // GET POST PUT DELETE PATCH …
  path?: string             // 요청 경로
  status?: number           // HTTP 상태 코드
  duration?: number         // ms
  ip?: string
  ua?: string               // User-Agent
  message?: string          // error / info 메시지
}

const MAX = 2000

type Subscriber = (log: ServerLogEntry) => void

/* ---- 글로벌 싱글톤 ---- */
declare global {
  // eslint-disable-next-line no-var
  var __srvLogs: ServerLogEntry[]
  // eslint-disable-next-line no-var
  var __srvSubs: Set<Subscriber>
}

if (!global.__srvLogs) global.__srvLogs = []
if (!global.__srvSubs) global.__srvSubs = new Set()

export function addServerLog(entry: Omit<ServerLogEntry, 'id' | 'ts'>): ServerLogEntry {
  const log: ServerLogEntry = {
    id: Math.random().toString(36).slice(2, 10),
    ts: Date.now(),
    ...entry,
  }
  global.__srvLogs.push(log)
  if (global.__srvLogs.length > MAX) global.__srvLogs.shift()

  // SSE 구독자에게 즉시 전달
  Array.from(global.__srvSubs).forEach(fn => {
    try { fn(log) } catch { global.__srvSubs.delete(fn) }
  })
  return log
}

export function getServerLogs(limit = 500): ServerLogEntry[] {
  return global.__srvLogs.slice(-limit)
}

export function subscribeServerLogs(fn: Subscriber): () => void {
  global.__srvSubs.add(fn)
  return () => { global.__srvSubs.delete(fn) }
}
