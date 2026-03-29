export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

/**
 * OCR 상품 인식 엔드포인트
 * POST: multipart/form-data { image: File }
 *
 * Google Vision API (GOOGLE_VISION_API_KEY 환경변수 필요)
 * → 이미지에서 텍스트/바코드를 추출하여 상품 정보 조회
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.GOOGLE_VISION_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'GOOGLE_VISION_API_KEY가 설정되지 않았습니다.' },
      { status: 501 }
    )
  }

  try {
    const formData = await req.formData()
    const file = formData.get('image') as File | null
    if (!file) return NextResponse.json({ error: 'image required' }, { status: 400 })

    // Base64 변환
    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')

    // Google Vision API 호출 (TEXT_DETECTION + BARCODE_DETECTION 복합)
    const visionRes = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [
            {
              image: { content: base64 },
              features: [
                { type: 'TEXT_DETECTION', maxResults: 10 },
                { type: 'BARCODE_DETECTION', maxResults: 5 },
              ],
            },
          ],
        }),
      }
    )

    if (!visionRes.ok) {
      const err = await visionRes.text()
      return NextResponse.json({ error: `Vision API 오류: ${err}` }, { status: 502 })
    }

    const visionData = await visionRes.json()
    const response = visionData.responses?.[0]

    // 바코드 추출
    const barcodes: string[] = (response?.barcodeAnnotations ?? []).map(
      (b: { rawValue: string }) => b.rawValue
    )

    // 전체 텍스트 추출
    const fullText: string = response?.fullTextAnnotation?.text ?? ''

    return NextResponse.json({
      barcodes,
      text: fullText.trim(),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
