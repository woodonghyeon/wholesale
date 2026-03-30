import { getNaverAuthHeaders, BASE_URL } from '@/lib/naver/auth'
import { ChannelAdapter, PlatformProduct, SyncPayload, SyncResult } from '../types'

/** 네이버 Commerce API 원본 상품 응답 타입 (필요한 필드만) */
interface NaverOriginProduct {
  statusType: string
  salePrice: number
  stockQuantity: number
  optionInfo?: {
    optionCombinations?: Array<{
      id: number
      optionName1?: string
      optionValue1?: string
      optionName2?: string
      optionValue2?: string
      optionName3?: string
      optionValue3?: string
      stockQuantity: number
      price: number
      usable?: boolean
    }>
  }
  [key: string]: unknown
}

interface NaverProductResponse {
  originProduct: NaverOriginProduct
  channelProducts?: Array<{
    channelProductNo?: number
    salePrice?: number
    stockQuantity?: number
    [key: string]: unknown
  }>
}

function buildOptionLabel(combo: NonNullable<NaverOriginProduct['optionInfo']>['optionCombinations'] extends Array<infer T> ? T : never): string {
  return [combo.optionValue1, combo.optionValue2, combo.optionValue3]
    .filter(Boolean)
    .join(' / ')
}

export class NaverChannelAdapter implements ChannelAdapter {
  /**
   * channelProductNo → originProductNo 변환 (404 fallback용)
   * POST /search로 전체 상품 조회 후 channelProductNo 매칭
   */
  private async resolveOriginProductNo(
    channelProductId: string,
    headers: Record<string, string>,
  ): Promise<string | null> {
    try {
      let page = 1
      while (true) {
        const res = await fetch(`${BASE_URL}/external/v1/products/search`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ page, size: 100 }),
        })
        if (!res.ok) return null
        const data = await res.json()
        const contents: Array<{ originProductNo: number; channelProducts?: Array<{ channelProductNo: number }> }> =
          data.contents ?? []
        for (const item of contents) {
          for (const ch of item.channelProducts ?? []) {
            if (String(ch.channelProductNo) === channelProductId) {
              return String(item.originProductNo)
            }
          }
        }
        const total: number = data.totalElements ?? 0
        if (contents.length === 0 || page * 100 >= total) break
        page++
      }
    } catch {
      // 검색 실패는 무시하고 null 반환
    }
    return null
  }

  /** 네이버 상품 전체 데이터 조회 */
  private async fetchProduct(platformProductId: string, businessId?: string): Promise<NaverProductResponse> {
    const headers = await getNaverAuthHeaders(businessId)
    const res = await fetch(
      `${BASE_URL}/external/v1/products/origin-products/${platformProductId}`,
      { headers }
    )
    if (!res.ok) {
      // 404인 경우 channelProductNo로 저장됐을 수 있으므로 originProductNo 탐색
      if (res.status === 404) {
        const originId = await this.resolveOriginProductNo(platformProductId, headers)
        if (originId && originId !== platformProductId) {
          const res2 = await fetch(
            `${BASE_URL}/external/v1/products/origin-products/${originId}`,
            { headers }
          )
          if (res2.ok) return res2.json()
        }
      }
      const text = await res.text()
      throw new Error(`네이버 상품 조회 실패 (${res.status}): ${text}`)
    }
    return res.json()
  }

  /** 플랫폼 상품 조회 (매핑 설정 + 미리보기용) */
  async getProduct(platformProductId: string, businessId?: string): Promise<PlatformProduct> {
    const data = await this.fetchProduct(platformProductId, businessId)
    const origin = data.originProduct
    const combos = origin.optionInfo?.optionCombinations ?? []

    return {
      platformProductId,
      name: String(origin.name ?? ''),
      price: origin.salePrice ?? 0,
      options: combos.map(c => ({
        platformOptionId: String(c.id),
        label: buildOptionLabel(c as any),
        inventory: c.stockQuantity ?? 0,
        addPrice: c.price ?? 0,
      })),
      rawData: data,
    }
  }

  /** 가격/재고 동기화 (Read-Modify-Write) */
  async syncProduct(
    platformProductId: string,
    payload: SyncPayload,
    businessId?: string,
  ): Promise<SyncResult> {
    try {
      // 1. 현재 상품 전체 데이터 조회
      const data = await this.fetchProduct(platformProductId, businessId) as NaverProductResponse

      // 2. 수정할 필드만 교체
      if (payload.price !== undefined) {
        data.originProduct.salePrice = payload.price
        // 채널 상품 가격도 동기화
        if (data.channelProducts?.length) {
          for (const cp of data.channelProducts) {
            cp.salePrice = payload.price
          }
        }
      }

      if (payload.inventory) {
        const combos = data.originProduct.optionInfo?.optionCombinations

        if (!combos || combos.length === 0) {
          // 옵션 없는 상품: null 키로 수량 조회
          const qty = payload.inventory.get(null)
          if (qty !== undefined) {
            data.originProduct.stockQuantity = qty
            if (data.channelProducts?.length) {
              for (const cp of data.channelProducts) {
                cp.stockQuantity = qty
              }
            }
          }
        } else {
          // 옵션 있는 상품: platformOptionId로 해당 조합 찾아 수량 수정
          for (const combo of combos) {
            const qty = payload.inventory.get(String(combo.id))
            if (qty !== undefined) {
              combo.stockQuantity = qty
            }
          }
        }
      }

      // 3. 수정된 전체 데이터로 PUT
      const headers = await getNaverAuthHeaders(businessId)
      const putRes = await fetch(
        `${BASE_URL}/external/v1/products/origin-products/${platformProductId}`,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify(data),
        }
      )

      if (!putRes.ok) {
        const text = await putRes.text()
        throw new Error(`네이버 상품 수정 실패 (${putRes.status}): ${text}`)
      }

      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  }

  /** 네이버 전체 상품 목록 조회 (POST /search 페이지네이션) */
  async listProducts(businessId?: string): Promise<PlatformProduct[]> {
    const headers = await getNaverAuthHeaders(businessId)
    const all: PlatformProduct[] = []
    let page = 1

    while (true) {
      const res = await fetch(`${BASE_URL}/external/v1/products/search`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ page, size: 100 }),
      })
      if (!res.ok) break

      const data = await res.json()
      const contents: Array<{
        originProductNo: number
        name?: string
        salePrice?: number
        channelProducts?: Array<{ channelProductNo: number }>
      }> = data.contents ?? []

      for (const item of contents) {
        all.push({
          platformProductId: String(item.originProductNo),
          name: item.name ?? '',
          price: item.salePrice ?? 0,
          options: [],
        })
      }

      const total: number = data.totalElements ?? 0
      if (contents.length === 0 || page * 100 >= total) break
      page++
    }

    return all
  }
}

export const naverAdapter = new NaverChannelAdapter()

