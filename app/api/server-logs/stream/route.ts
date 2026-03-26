export const dynamic = 'force-dynamic'

import { getServerLogs, subscribeServerLogs } from '@/lib/server/log-store'

export async function GET() {
  const encoder = new TextEncoder()
  let cleanup: (() => void) | null = null

  const body = new ReadableStream({
    start(controller) {
      let closed = false

      const enqueue = (text: string) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(text))
        } catch {
          close()
        }
      }

      const close = () => {
        if (closed) return
        closed = true
        cleanup?.()
        try { controller.close() } catch { /* already closed */ }
      }

      // 기존 버퍼 (최근 300건) 즉시 전송
      for (const log of getServerLogs(300)) {
        enqueue(`data: ${JSON.stringify(log)}\n\n`)
      }

      // 신규 로그 구독
      const unsub = subscribeServerLogs(log => {
        enqueue(`data: ${JSON.stringify(log)}\n\n`)
      })

      // 30초 keepalive
      const timer = setInterval(() => {
        enqueue(': keepalive\n\n')
      }, 30_000)

      cleanup = () => {
        unsub()
        clearInterval(timer)
      }
    },

    cancel() {
      cleanup?.()
    },
  })

  return new Response(body, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
