/**
 * Node.js 전용 서버 계측 — 클라이언트/Edge 번들에 포함되지 않습니다.
 * http.Server를 패치하여 모든 HTTP 요청/응답을 캡처합니다.
 */
import { addServerLog } from './lib/server/log-store'
import * as http from 'http'

declare global {
  // eslint-disable-next-line no-var
  var __httpPatched: boolean | undefined
}

const SKIP_PREFIXES = [
  '/_next/static',
  '/_next/image',
  '/__nextjs',
  '/favicon.ico',
  '/_next/webpack-hmr',
]

function shouldSkip(url: string): boolean {
  return SKIP_PREFIXES.some(p => url.startsWith(p))
}

if (!global.__httpPatched) {
  global.__httpPatched = true

  const _emit = http.Server.prototype.emit

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  http.Server.prototype.emit = function (event: string, ...args: any[]) {
    if (event === 'request') {
      const req = args[0] as http.IncomingMessage
      const res = args[1] as http.ServerResponse
      const url = req.url ?? '/'

      if (!shouldSkip(url)) {
        const start = Date.now()
        res.on('finish', () => {
          const ip =
            (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim() ??
            req.socket?.remoteAddress ??
            'local'
          addServerLog({
            type: 'http',
            method: req.method ?? 'GET',
            path: url,
            status: res.statusCode,
            duration: Date.now() - start,
            ip,
            ua: (req.headers['user-agent'] as string) ?? '',
          })
        })
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return _emit.apply(this, [event, ...args] as any)
  }

  process.on('uncaughtException', (err) => {
    addServerLog({ type: 'error', message: `[uncaughtException] ${err.message}`, path: 'process' })
  })

  process.on('unhandledRejection', (reason) => {
    const msg = reason instanceof Error ? reason.message : String(reason)
    addServerLog({ type: 'error', message: `[unhandledRejection] ${msg}`, path: 'process' })
  })

  addServerLog({ type: 'info', message: '✓ Server log capture initialized', path: 'instrumentation' })
}
