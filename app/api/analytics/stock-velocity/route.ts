import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getNaverOrders, getNaverOrdersLastHours } from '@/lib/naver/orders'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * GET /api/analytics/stock-velocity
 * 상품별 판매 속도 + 재고 소진 예측 + 발주 추천
 * Returns: items[] { productId, name, currentStock, minStock, dailySales, daysLeft, reorderQty, urgent }
 */
export async function GET(req: NextRequest) {
  const days = Number(req.nextUrl.searchParams.get('days') ?? '30')

  try {
    const supabase = adminClient()

    // 현재 재고 조회
    const { data: inventory } = await supabase
      .from('inventory')
      .select('id, quantity, business_id, products(id, name, barcode, min_stock, buy_price, sell_price)')

    if (!inventory?.length) {
      return NextResponse.json({ success: true, items: [] })
    }

    // 네이버 주문에서 판매 수량 집계 (최근 N일)
    const [recent, older] = await Promise.all([
      getNaverOrdersLastHours(24),
      getNaverOrders(days),
    ])
    const orderMap = new Map(older.map(o => [o.productOrderId, o]))
    recent.forEach(o => orderMap.set(o.productOrderId, o))
    const orders = Array.from(orderMap.values())

    const CANCEL = new Set(['CANCELED', 'CANCEL_REQUEST', 'RETURNED', 'RETURN_REQUEST'])
    const activeOrders = orders.filter(o => !CANCEL.has(o.productOrderStatus))

    // 상품명 기준으로 판매 수량 집계 (barcode naver_XXXX 매칭 우선, 없으면 이름 매칭)
    const nameToQty = new Map<string, number>()
    for (const o of activeOrders) {
      // 상품명 정규화 (앞 10자 기준 매칭)
      const key = o.productName.slice(0, 15).toLowerCase().trim()
      nameToQty.set(key, (nameToQty.get(key) ?? 0) + o.quantity)
    }

    // barcode: naver_PRODUCTNO 매칭도 시도
    const barcodeToQty = new Map<string, number>()
    for (const o of activeOrders) {
      if (o.productNo) {
        barcodeToQty.set(`naver_${o.productNo}`, (barcodeToQty.get(`naver_${o.productNo}`) ?? 0) + o.quantity)
      }
    }

    const result = inventory.map((inv: any) => {
      const p = inv.products
      if (!p) return null

      // 판매 수량: barcode 우선, 없으면 이름 매칭
      const barcodeQty = p.barcode ? (barcodeToQty.get(p.barcode) ?? 0) : 0
      const nameKey = p.name.slice(0, 15).toLowerCase().trim()
      const nameQty = nameToQty.get(nameKey) ?? 0
      const totalSoldQty = barcodeQty > 0 ? barcodeQty : nameQty

      const dailySales = totalSoldQty / days        // 일 평균 판매수
      const daysLeft   = dailySales > 0 ? Math.floor(inv.quantity / dailySales) : 9999
      const urgent     = daysLeft <= 7 || (p.min_stock > 0 && inv.quantity <= p.min_stock)

      // 발주 추천 수량: 30일치 판매량 - 현재 재고 (최소 0)
      const reorderQty = Math.max(0, Math.ceil(dailySales * 30) - inv.quantity)

      return {
        inventoryId:  inv.id,
        productId:    p.id,
        name:         p.name,
        barcode:      p.barcode,
        currentStock: inv.quantity,
        minStock:     p.min_stock ?? 0,
        soldQty:      totalSoldQty,
        dailySales:   Math.round(dailySales * 10) / 10,
        daysLeft:     daysLeft === 9999 ? null : daysLeft,
        reorderQty,
        urgent,
        buyPrice:     p.buy_price ?? 0,
        sellPrice:    p.sell_price ?? 0,
      }
    }).filter(Boolean)

    // urgent 먼저, 그 다음 daysLeft 오름차순
    result.sort((a: any, b: any) => {
      if (a.urgent && !b.urgent) return -1
      if (!a.urgent && b.urgent) return 1
      const da = a.daysLeft ?? 9999
      const db = b.daysLeft ?? 9999
      return da - db
    })

    const urgentCount = result.filter((r: any) => r.urgent).length

    return NextResponse.json({
      success: true,
      days,
      totalItems:  result.length,
      urgentCount,
      items: result,
    })
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error }, { status: 500 })
  }
}
