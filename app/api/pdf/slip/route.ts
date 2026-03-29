export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const TYPE_LABEL: Record<string, string> = {
  sale: '거래명세서',
  purchase: '발주서',
  quote: '견적서',
}

export async function GET(req: NextRequest) {
  const slipId = req.nextUrl.searchParams.get('id')
  if (!slipId) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const supabase = adminClient()
  const { data: slip, error } = await supabase
    .from('slips')
    .select(`
      *,
      partners ( name, address, phone, business_no ),
      channels ( name ),
      warehouses ( name ),
      businesses ( name, address, phone, business_no, owner_name ),
      slip_items ( * )
    `)
    .eq('id', slipId)
    .single()

  if (error || !slip) {
    return new NextResponse('전표를 찾을 수 없습니다', { status: 404 })
  }

  const items: any[] = slip.slip_items ?? []
  const docType = TYPE_LABEL[slip.slip_type] ?? '전표'
  const biz = (slip as any).businesses
  const partner = (slip as any).partners

  const rowsHtml = items.map((item: any, i: number) => `
    <tr>
      <td>${i + 1}</td>
      <td class="left">${item.product_name ?? '-'}</td>
      <td>${item.quantity?.toLocaleString() ?? 0}</td>
      <td>${item.unit_price?.toLocaleString() ?? 0}</td>
      <td>${(item.supply_amount ?? item.unit_price * item.quantity)?.toLocaleString() ?? 0}</td>
      <td>${item.tax_amount?.toLocaleString() ?? 0}</td>
      <td>${((item.supply_amount ?? item.unit_price * item.quantity) + (item.tax_amount ?? 0))?.toLocaleString() ?? 0}</td>
      <td class="left">${item.note ?? ''}</td>
    </tr>
  `).join('')

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>${docType} — ${slip.slip_no ?? ''}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Malgun Gothic', sans-serif; font-size: 12px; color: #111; padding: 20px; }
    @page { margin: 10mm; size: A4; }

    .doc-title { font-size: 22px; font-weight: bold; text-align: center; margin-bottom: 16px; letter-spacing: 4px; }
    .meta { display: flex; justify-content: space-between; margin-bottom: 12px; gap: 12px; }
    .meta-box { border: 1px solid #ccc; flex: 1; padding: 8px 10px; }
    .meta-box table { width: 100%; border-collapse: collapse; }
    .meta-box td { padding: 2px 4px; font-size: 11px; }
    .meta-box td:first-child { color: #555; width: 60px; }
    .meta-box td:last-child { font-weight: 500; }

    .items { width: 100%; border-collapse: collapse; margin-top: 12px; }
    .items th { background: #f0f0f0; border: 1px solid #bbb; padding: 5px 6px; font-size: 11px; text-align: center; }
    .items td { border: 1px solid #ddd; padding: 5px 6px; text-align: right; font-size: 11px; }
    .items td.left { text-align: left; }

    .totals { margin-top: 10px; text-align: right; }
    .totals table { margin-left: auto; border-collapse: collapse; }
    .totals td { padding: 3px 10px; font-size: 12px; }
    .totals td:first-child { color: #555; }
    .totals .grand { font-size: 14px; font-weight: bold; background: #f8f8f8; }

    .memo-box { margin-top: 12px; border: 1px solid #ddd; padding: 8px 10px; min-height: 40px; font-size: 11px; color: #444; }

    .sign-area { display: flex; justify-content: flex-end; gap: 16px; margin-top: 20px; }
    .sign-box { text-align: center; }
    .sign-box .label { font-size: 10px; color: #555; margin-bottom: 4px; }
    .sign-box .box { width: 80px; height: 50px; border: 1px solid #aaa; }

    .print-btn { position: fixed; bottom: 20px; right: 20px; padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; }
    .no-print { }
    @media print { .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="doc-title">${docType}</div>

  <div class="meta">
    <!-- 공급받는자 / 수신처 -->
    <div class="meta-box">
      <table>
        <tr><td>${slip.slip_type === 'purchase' ? '공급자' : '공급받는자'}</td><td><strong>${partner?.name ?? '-'}</strong></td></tr>
        <tr><td>사업자번호</td><td>${partner?.business_no ?? '-'}</td></tr>
        <tr><td>주소</td><td>${partner?.address ?? '-'}</td></tr>
        <tr><td>전화</td><td>${partner?.phone ?? '-'}</td></tr>
      </table>
    </div>
    <!-- 발행처 정보 -->
    <div class="meta-box">
      <table>
        <tr><td>상호</td><td><strong>${biz?.name ?? '-'}</strong></td></tr>
        <tr><td>대표자</td><td>${biz?.owner_name ?? '-'}</td></tr>
        <tr><td>사업자번호</td><td>${biz?.business_no ?? '-'}</td></tr>
        <tr><td>주소</td><td>${biz?.address ?? '-'}</td></tr>
        <tr><td>전화</td><td>${biz?.phone ?? '-'}</td></tr>
      </table>
    </div>
    <!-- 전표 정보 -->
    <div class="meta-box">
      <table>
        <tr><td>문서번호</td><td>${slip.slip_no ?? '-'}</td></tr>
        <tr><td>작성일</td><td>${slip.slip_date}</td></tr>
        ${slip.due_date ? `<tr><td>납기일</td><td>${slip.due_date}</td></tr>` : ''}
        ${(slip as any).channels?.name ? `<tr><td>채널</td><td>${(slip as any).channels.name}</td></tr>` : ''}
      </table>
    </div>
  </div>

  <table class="items">
    <thead>
      <tr>
        <th>No</th><th>품목명</th><th>수량</th><th>단가</th><th>공급가액</th><th>세액</th><th>합계</th><th>비고</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || '<tr><td colspan="8" style="text-align:center;padding:16px;color:#999">품목 없음</td></tr>'}
    </tbody>
  </table>

  <div class="totals">
    <table>
      <tr><td>공급가액 합계</td><td><strong>${slip.supply_amount?.toLocaleString() ?? 0}원</strong></td></tr>
      <tr><td>세액 합계</td><td>${slip.tax_amount?.toLocaleString() ?? 0}원</td></tr>
      <tr class="grand"><td>총 합계금액</td><td><strong>${slip.total_amount?.toLocaleString() ?? 0}원</strong></td></tr>
    </table>
  </div>

  ${slip.memo ? `<div class="memo-box"><strong>메모:</strong> ${slip.memo}</div>` : ''}

  <div class="sign-area no-print">
    <div class="sign-box"><div class="label">담당자</div><div class="box"></div></div>
    <div class="sign-box"><div class="label">확인자</div><div class="box"></div></div>
  </div>

  <button class="print-btn no-print" onclick="window.print()">🖨️ 인쇄 / PDF 저장</button>
</body>
</html>`

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
