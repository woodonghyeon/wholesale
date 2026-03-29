export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * GET /api/pdf/price-list?businessId=&category=&grade=0
 * 가격표 PDF 생성
 * grade: 0=기본가, 1~5=가격등급
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const businessId = searchParams.get('businessId') ?? undefined
  const category   = searchParams.get('category') ?? ''
  const grade      = Number(searchParams.get('grade') ?? '0')

  try {
    const supabase = adminClient()

    // 상품 목록 조회
    let query = supabase
      .from('products')
      .select('id, name, category, unit, sell_price, buy_price, barcode, note')
      .order('category')
      .order('name')

    if (businessId) query = query.eq('business_id', businessId)
    if (category)   query = query.eq('category', category)

    const { data: products, error } = await query
    if (error) throw error

    // 가격 등급이 있으면 partner_prices 테이블에서 조회
    let gradeMap = new Map<string, number>()
    if (grade > 0) {
      const { data: prices } = await supabase
        .from('partner_prices')
        .select('product_id, price')
        .eq('price_type', 'grade')
        .eq('grade_level', grade)
      for (const p of prices ?? []) gradeMap.set(p.product_id, p.price)
    }

    // 사업체 정보
    const { data: bizList } = await supabase
      .from('businesses')
      .select('name, phone, address')
      .eq('id', businessId ?? '')
      .maybeSingle()

    const now = new Date()
    const dateStr = now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })

    // HTML 기반 PDF 생성 (CSS print 방식)
    const rows = (products ?? []).map((p: any) => {
      const price = grade > 0 ? (gradeMap.get(p.id) ?? p.sell_price) : p.sell_price
      return { ...p, displayPrice: price }
    })

    // 카테고리별 그룹
    const grouped: Record<string, typeof rows> = {}
    for (const r of rows) {
      const cat = r.category || '기타'
      if (!grouped[cat]) grouped[cat] = []
      grouped[cat].push(r)
    }

    const html = generatePriceListHtml({
      bizName:  bizList?.name ?? '도매 통합 관리 시스템',
      bizPhone: bizList?.phone ?? '',
      bizAddr:  bizList?.address ?? '',
      dateStr,
      grade,
      grouped,
    })

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    })
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error }, { status: 500 })
  }
}

interface PriceListData {
  bizName:  string
  bizPhone: string
  bizAddr:  string
  dateStr:  string
  grade:    number
  grouped:  Record<string, { id: string; name: string; unit: string; category: string; barcode: string | null; displayPrice: number }[]>
}

function generatePriceListHtml(data: PriceListData): string {
  const gradeLabel = data.grade === 0 ? '정가' : `${data.grade}등급가`

  const categoryBlocks = Object.entries(data.grouped).map(([cat, items]) => {
    const rows = items.map(item => `
      <tr>
        <td>${item.name}</td>
        <td class="center">${item.unit}</td>
        <td class="right price">${item.displayPrice.toLocaleString()}원</td>
        <td class="center barcode">${item.barcode ?? ''}</td>
      </tr>
    `).join('')

    return `
      <div class="category-block">
        <div class="category-header">${cat}</div>
        <table>
          <thead>
            <tr>
              <th>상품명</th>
              <th class="center" style="width:60px">단위</th>
              <th class="right" style="width:120px">${gradeLabel}</th>
              <th class="center" style="width:120px">바코드</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `
  }).join('')

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>가격표 — ${data.bizName}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif; font-size: 11px; color: #1a1a1a; background: #fff; }

  .page { max-width: 800px; margin: 0 auto; padding: 24px; }

  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; border-bottom: 2px solid #1a1a1a; margin-bottom: 20px; }
  .header h1 { font-size: 22px; font-weight: 700; }
  .header .meta { text-align: right; font-size: 11px; color: #555; line-height: 1.6; }
  .header .grade-badge { display: inline-block; background: #2563eb; color: #fff; font-size: 11px; font-weight: 600; padding: 2px 10px; border-radius: 20px; margin-bottom: 6px; }

  .category-block { margin-bottom: 20px; }
  .category-header { font-size: 12px; font-weight: 700; color: #2563eb; border-left: 3px solid #2563eb; padding: 4px 10px; background: #eff6ff; margin-bottom: 4px; }

  table { width: 100%; border-collapse: collapse; }
  th { background: #f8f9fa; font-weight: 600; font-size: 10px; color: #555; padding: 6px 8px; border: 1px solid #e5e7eb; }
  td { padding: 5px 8px; border: 1px solid #e5e7eb; vertical-align: middle; }
  tr:nth-child(even) td { background: #fafafa; }
  .center { text-align: center; }
  .right { text-align: right; }
  .price { font-weight: 600; color: #059669; }
  .barcode { font-family: monospace; font-size: 10px; color: #888; }

  .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; font-size: 10px; color: #888; }

  .no-print { position: fixed; top: 16px; right: 16px; display: flex; gap: 8px; }
  .btn { padding: 8px 16px; border: none; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600; }
  .btn-primary { background: #2563eb; color: #fff; }
  .btn-secondary { background: #f3f4f6; color: #374151; }

  @media print {
    .no-print { display: none !important; }
    body { font-size: 10px; }
    .page { padding: 10px; max-width: 100%; }
    .category-block { page-break-inside: avoid; }
    @page { margin: 10mm; }
  }
</style>
</head>
<body>
<div class="no-print">
  <button class="btn btn-secondary" onclick="window.close()">닫기</button>
  <button class="btn btn-primary" onclick="window.print()">🖨️ 인쇄 / PDF 저장</button>
</div>

<div class="page">
  <div class="header">
    <div>
      <h1>📋 상품 가격표</h1>
      <p style="color:#555;margin-top:4px;font-size:12px">${data.bizName}</p>
    </div>
    <div class="meta">
      <div class="grade-badge">${gradeLabel}</div><br>
      발행일: ${data.dateStr}<br>
      ${data.bizPhone ? `Tel: ${data.bizPhone}<br>` : ''}
      ${data.bizAddr ? `주소: ${data.bizAddr}` : ''}
    </div>
  </div>

  ${categoryBlocks}

  <div class="footer">
    <span>본 가격표는 ${data.dateStr} 기준이며, 사전 예고 없이 변경될 수 있습니다.</span>
    <span>${data.bizName}</span>
  </div>
</div>
</body>
</html>`
}
