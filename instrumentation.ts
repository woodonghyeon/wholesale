/**
 * Next.js Instrumentation Hook
 * Node.js 전용 코드는 instrumentation.node.ts에 분리 — webpack 번들링 오류 방지
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation.node')
  }
}
