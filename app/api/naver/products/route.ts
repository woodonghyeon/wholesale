import { NextResponse } from 'next/server'
import { getNaverProducts } from '@/lib/naver/products'

export async function GET() {
  try {
    const products = await getNaverProducts()
    return NextResponse.json({ success: true, count: products.length, products })
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error }, { status: 500 })
  }
}
