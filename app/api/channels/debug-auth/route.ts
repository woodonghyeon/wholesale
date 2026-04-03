import { NextResponse } from 'next/server'
import { getNaverAccessToken } from '@/lib/channels/naver/auth'

export async function GET() {
  let accessToken = ''
  let tokenError = ''
  let channelsStatus = 0
  let channelsBody = ''
  let orderStatus = 0
  let orderBody = ''

  try {
    accessToken = await getNaverAccessToken()
  } catch (e) {
    tokenError = e instanceof Error ? e.message : String(e)
  }

  if (accessToken) {
    const headers = { Authorization: `Bearer ${accessToken}` }

    try {
      const r = await fetch('https://api.commerce.naver.com/external/v1/seller/channels', { headers })
      channelsStatus = r.status
      channelsBody = await r.text()
    } catch (e) {
      channelsBody = e instanceof Error ? e.message : String(e)
    }

    try {
      const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const to = new Date().toISOString()
      const qs = `lastChangedFrom=${encodeURIComponent(from)}&lastChangedTo=${encodeURIComponent(to)}&limitCount=3`
      const r = await fetch(
        `https://api.commerce.naver.com/external/v1/pay-order/seller/product-orders/last-changed-statuses?${qs}`,
        { headers }
      )
      orderStatus = r.status
      orderBody = await r.text()
    } catch (e) {
      orderBody = e instanceof Error ? e.message : String(e)
    }
  }

  return NextResponse.json({
    tokenOk: !!accessToken,
    tokenError,
    accessTokenPreview: accessToken ? accessToken.slice(0, 10) + '...' : '',
    channelsStatus,
    channelsBody: channelsBody.slice(0, 300),
    orderStatus,
    orderBody: orderBody.slice(0, 300),
  })
}
