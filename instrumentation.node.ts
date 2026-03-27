/**
 * Node.js 전용 서버 계측 — 클라이언트/Edge 번들에 포함되지 않습니다.
 * http.Server를 패치하여 모든 HTTP 요청/응답을 캡처합니다.
 * 네이버 주문 자동 동기화 (2분 간격) 도 여기서 실행합니다.
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

// ── 네이버 주문 자동 동기화 (2분 간격) ──────────────────────────────────
declare global {
  // eslint-disable-next-line no-var
  var __naverCronStarted: boolean | undefined
}

if (!global.__naverCronStarted && process.env.NAVER_COMMERCE_CLIENT_ID) {
  global.__naverCronStarted = true

  import('node-cron').then(({ default: cron }) => {
    // */2 * * * * = 매 2분
    cron.schedule('*/2 * * * *', async () => {
      try {
        const { runNaverAutoSync } = await import('./lib/naver/auto-sync')
        const result = await runNaverAutoSync()
        const msg =
          result.newOrders === 0 && result.newClaims === 0
            ? `✓ 네이버 동기화 완료 — 신규 없음 (${new Date(result.syncedAt).toLocaleTimeString('ko-KR')})`
            : `✓ 네이버 동기화 완료 — 신규 주문 ${result.newOrders}건 / 반품 ${result.newClaims}건`
        console.log(`[Naver Cron] ${msg}`)
        addServerLog({ type: 'info', message: msg, path: '/api/naver/auto-sync' })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[Naver Cron] ✗ 실패: ${msg}`)
        addServerLog({ type: 'error', message: `✗ 네이버 자동 동기화 실패: ${msg}`, path: '/api/naver/auto-sync' })
      }
    })

    addServerLog({ type: 'info', message: '✓ 네이버 자동 동기화 스케줄러 시작 (2분 간격)', path: 'instrumentation' })
  }).catch(() => {
    addServerLog({ type: 'error', message: 'node-cron 로드 실패 — npm install node-cron 필요', path: 'instrumentation' })
  })
}
