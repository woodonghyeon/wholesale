export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  const type = req.nextUrl.searchParams.get('type') ?? 'quote' // 'quote' | 'order'
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const supabase = adminClient()

  let docData: any = null
  let items: any[] = []
  let docType = '견적서'

  if (type === 'quote') {
    const { data } = await supabase
      .from('quotes')
      .select('*, partners(name, address, phone, business_no), businesses(name, address, phone, business_no, owner_name), quote_items(*)')
      .eq('id', id).single()
    docData = data
    items = data?.quote_items ?? []
    docType = '견적서'
  } else {
    const { data } = await supabase
      .from('purchase_orders')
      .select('*, partners(name, address, phone, business_no), businesses(name, address, phone, business_no, owner_name), purchase_order_items(*, products(name))')
      .eq('id', id).single()
    docData = data
    items = (data?.purchase_order_items ?? []).map((i: any) => ({
      ...i,
      product_name: i.product_name ?? i.products?.name ?? '-',
    }))
    docType = '발주서'
  }

  if (!docData) return new NextResponse('문서를 찾을 수 없습니다', { status: 404 })

  const biz = docData.businesses
  const partner = docData.partners
  const dateField = type === 'quote' ? docData.quote_date : docData.order_date
  const docNo = type === 'quote' ? docData.quote_no : docData.order_no

  const rowsHtml = items.map((item: any, i: number) => {
    const qty = item.quantity ?? 0
    const price = item.unit_price ?? 0
    const amount = item.amount ?? price * qty
    const tax = item.tax_amount ?? 0
    return `
      <tr>
        <td>${i + 1}</td>
        <td class="left">${item.product_name ?? '-'}</td>
        <td>${qty.toLocaleString()}</td>
        <td>${price.toLocaleString()}</td>
        <td>${amount.toLocaleString()}</td>
        <td>${tax.toLocaleString()}</td>
        <td>${(amount + tax).toLocaleString()}</td>
        <td class="left">${item.note ?? ''}</td>
      </tr>`
  }).join('')

  const totalAmount = items.reduce((s: number, i: any) => {
    const qty = i.quantity ?? 0
    const price = i.unit_price ?? 0
    return s + (i.amount ?? price * qty) + (i.tax_amount ?? 0)
  }, 0)
  const supplyAmount = items.reduce((s: number, i: any) => {
    const qty = i.quantity ?? 0
    const price = i.unit_price ?? 0
    return s + (i.amount ?? price * qty)
  }, 0)
  const taxAmount = totalAmount - supplyAmount

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>${docType} — ${docNo ?? ''}</title>
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
    .print-btn { position: fixed; bottom: 20px; right: 20px; padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; }
    @media print { .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="doc-title">${docType}</div>
  <div class="meta">
    <div class="meta-box">
      <table>
        <tr><td>받는분</td><td><strong>${partner?.name ?? '-'}</strong></td></tr>
        <tr><td>사업자번호</td><td>${partner?.business_no ?? '-'}</td></tr>
        <tr><td>주소</td><td>${partner?.address ?? '-'}</td></tr>
        <tr><td>전화</td><td>${partner?.phone ?? '-'}</td></tr>
      </table>
    </div>
    <div class="meta-box">
      <table>
        <tr><td>상호</td><td><strong>${biz?.name ?? '-'}</strong></td></tr>
        <tr><td>대표자</td><td>${biz?.owner_name ?? '-'}</td></tr>
        <tr><td>사업자번호</td><td>${biz?.business_no ?? '-'}</td></tr>
        <tr><td>주소</td><td>${biz?.address ?? '-'}</td></tr>
        <tr><td>전화</td><td>${biz?.phone ?? '-'}</td></tr>
      </table>
    </div>
    <div class="meta-box">
      <table>
        <tr><td>문서번호</td><td>${docNo ?? '-'}</td></tr>
        <tr><td>작성일</td><td>${dateField ?? '-'}</td></tr>
        ${type === 'quote' && docData.valid_until ? `<tr><td>유효기간</td><td>${docData.valid_until}</td></tr>` : ''}
        ${type === 'order' && docData.expected_date ? `<tr><td>입고예정일</td><td>${docData.expected_date}</td></tr>` : ''}
      </table>
    </div>
  </div>

  <table class="items">
    <thead>
      <tr><th>No</th><th>품목명</th><th>수량</th><th>단가</th><th>공급가액</th><th>세액</th><th>합계</th><th>비고</th></tr>
    </thead>
    <tbody>${rowsHtml || '<tr><td colspan="8" style="text-align:center;padding:16px;color:#999">품목 없음</td></tr>'}</tbody>
  </table>

  <div class="totals">
    <table>
      <tr><td>공급가액 합계</td><td><strong>${supplyAmount.toLocaleString()}원</strong></td></tr>
      <tr><td>세액 합계</td><td>${taxAmount.toLocaleString()}원</td></tr>
      <tr class="grand"><td>합계금액</td><td><strong>${totalAmount.toLocaleString()}원</strong></td></tr>
    </table>
  </div>

  ${docData.note ? `<div class="memo-box"><strong>비고:</strong> ${docData.note}</div>` : ''}

  <button class="print-btn no-print" onclick="window.print()">🖨️ 인쇄 / PDF 저장</button>
</body>
</html>`

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
