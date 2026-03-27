/**
 * 네이버 스마트스토어 상품 조회
 * - 상품 API (/external/v1/products/search) 페이지네이션으로 전체 조회
 * - API 권한이 없을 경우 주문 내역에서 추출(fallback)
 */
import { getNaverAuthHeaders, BASE_URL } from './auth'
import { getNaverOrders } from './orders'

export interface NaverProduct {
  originProductNo: string
  name: string
  salePrice: number
  stockQuantity: number
  statusType: string
  categoryName: string
  orderCount?: number
}

/** 상품 API로 전체 상품 목록 페이지네이션 조회 (POST 방식) */
async function fetchAllProductsFromAPI(): Promise<NaverProduct[]> {
  const headers = await getNaverAuthHeaders()
  const all: NaverProduct[] = []
  const PAGE_SIZE = 100
  let page = 1

  while (true) {
    const res = await fetch(
      `${BASE_URL}/external/v1/products/search`,
      {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productStatusType: 'SALE',
          page,
          size: PAGE_SIZE,
        }),
      }
    )

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`상품 API 오류 (${res.status}): ${text}`)
    }

    const data = await res.json()

    // 응답 구조: { contents: [{ originProductNo, channelProducts: [...] }], totalElements }
    const rawItems: Array<{
      originProductNo: number
      channelProducts: Array<{
        name: string
        salePrice: number
        stockQuantity: number
        statusType: string
        wholeCategoryName?: string
      }>
    }> = data.contents ?? []

    const mapped: NaverProduct[] = rawItems.map(item => {
      const ch = item.channelProducts?.[0]
      return {
        originProductNo: String(item.originProductNo),
        name: ch?.name ?? '',
        salePrice: ch?.salePrice ?? 0,
        stockQuantity: ch?.stockQuantity ?? 0,
        statusType: ch?.statusType ?? 'SALE',
        categoryName: ch?.wholeCategoryName?.split('>')?.[2]?.trim() ?? '',
      }
    })

    all.push(...mapped)

    const total: number = data.totalElements ?? 0
    if (all.length >= total || rawItems.length < PAGE_SIZE) break
    page++
  }

  return all
}

/** 주문 내역에서 상품 추출 (API 권한 없을 때 fallback) */
async function fetchProductsFromOrders(): Promise<NaverProduct[]> {
  const orders = await getNaverOrders(90)
  const map = new Map<string, { name: string; price: number; count: number }>()

  for (const o of orders) {
    const existing = map.get(o.productName)
    if (existing) {
      existing.count += o.quantity
    } else {
      map.set(o.productName, { name: o.productName, price: o.unitPrice, count: o.quantity })
    }
  }

  return Array.from(map.entries()).map(([, v], i) => ({
    originProductNo: String(i + 1),
    name: v.name,
    salePrice: v.price,
    stockQuantity: 0,
    statusType: 'SALE',
    categoryName: '',
    orderCount: v.count,
  }))
}

/**
 * 전체 상품 목록 조회
 * 1) 상품 API 시도 → 2) 실패 시 주문 내역 fallback
 */
export async function getNaverProducts(): Promise<NaverProduct[]> {
  try {
    const products = await fetchAllProductsFromAPI()
    console.log(`[Naver Products] 상품 API로 ${products.length}개 조회`)
    return products
  } catch (err) {
    console.warn('[Naver Products] 상품 API 실패, 주문 내역에서 추출:', (err as Error).message)
    const fallback = await fetchProductsFromOrders()
    console.log(`[Naver Products] 주문 내역 fallback: ${fallback.length}개 추출`)
    return fallback
  }
}
