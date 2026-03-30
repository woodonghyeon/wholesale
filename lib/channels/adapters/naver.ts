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

type OptionCombo = NonNullable<NaverOriginProduct['optionInfo']>['optionCombinations'] extends Array<infer T> ? T : never

function buildOptionLabel(combo: OptionCombo): string {
  return [(combo as any).optionValue1, (combo as any).optionValue2, (combo as any).optionValue3]
    .filter(Boolean)
    .join(' / ')
}

export class NaverChannelAdapter implements ChannelAdapter {
  /**
   * channelProductNo → originProductNo 변환
   *
   * 방법 1: GET /channel-products/{channelProductNo} — 직접 조회 (가장 빠름)
   * 방법 2: POST /search 전체 탐색 — fallback
   */
  private async resolveOriginProductNo(
    channelProductId: string,
    headers: Record<string, string>,
  ): Promise<string | null> {
    // ── 방법 1: 채널 상품 직접 조회 ──────────────────────────────
    try {
      const res = await fetch(
        `${BASE_URL}/external/v1/products/channel-products/${channelProductId}`,
        { headers },
      )
      if (res.ok) {
        const data = await res.json()
        // 응답 구조: { originProductNo } 또는 { originProduct: { ... } }
        const originNo = data.originProductNo ?? data.originProduct?.originProductNo
        if (originNo) return String(originNo)
      }
    } catch {
      // 무시 후 방법 2로 진행
    }

    // ── 방법 2: 전체 상품 검색으로 channelProductNo 매칭 ─────────
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
        const contents: Array<{
          originProductNo: number
          channelProducts?: Array<{ channelProductNo: number }>
        }> = data.contents ?? []

        for (const item of contents) {
          // originProductNo 직접 일치 확인 (실수로 originNo를 channelNo로 착각한 경우 대비)
          if (String(item.originProductNo) === channelProductId) {
            return String(item.originProductNo)
          }
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
      // 검색 실패 무시
    }

    return null
  }

  /**
   * 네이버 상품 전체 데이터 조회
   * 반환값: { data: 상품 전체 JSON, actualId: 실제 사용된 originProductNo }
   */
  private async fetchProduct(
    platformProductId: string,
    businessId?: string,
  ): Promise<{ data: NaverProductResponse; actualId: string }> {
    const headers = await getNaverAuthHeaders(businessId)

    const res = await fetch(
      `${BASE_URL}/external/v1/products/origin-products/${platformProductId}`,
      { headers },
    )

    if (res.ok) {
      return { data: await res.json(), actualId: platformProductId }
    }

    // 404 → channelProductNo로 저장됐을 수 있으므로 originProductNo 탐색
    if (res.status === 404) {
      const originId = await this.resolveOriginProductNo(platformProductId, headers)
      if (originId) {
        const res2 = await fetch(
          `${BASE_URL}/external/v1/products/origin-products/${originId}`,
          { headers },
        )
        if (res2.ok) {
          return { data: await res2.json(), actualId: originId }
        }
      }
    }

    const text = await res.text()
    throw new Error(`네이버 상품 조회 실패 (${res.status}): ${text}`)
  }

  /** 플랫폼 상품 조회 (매핑 설정 + 미리보기용) */
  async getProduct(platformProductId: string, businessId?: string): Promise<PlatformProduct> {
    const { data, actualId } = await this.fetchProduct(platformProductId, businessId)
    const origin = data.originProduct
    const combos = origin.optionInfo?.optionCombinations ?? []

    return {
      platformProductId: actualId,
      name: String((origin as any).name ?? ''),
      price: origin.salePrice ?? 0,
      options: combos.map(c => ({
        platformOptionId: String(c.id),
        label: buildOptionLabel(c as OptionCombo),
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
  ): Promise<SyncResult & { resolvedId?: string }> {
    try {
      // 1. 현재 상품 전체 데이터 조회 (actualId = 실제 originProductNo)
      const { data, actualId } = await this.fetchProduct(platformProductId, businessId)

      // 2. 수정할 필드만 교체
      if (payload.price !== undefined) {
        data.originProduct.salePrice = payload.price
        if (data.channelProducts?.length) {
          for (const cp of data.channelProducts) {
            cp.salePrice = payload.price
          }
        }
      }

      if (payload.inventory) {
        const combos = data.originProduct.optionInfo?.optionCombinations

        if (!combos || combos.length === 0) {
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
          for (const combo of combos) {
            const qty = payload.inventory.get(String(combo.id))
            if (qty !== undefined) (combo as any).stockQuantity = qty
          }
        }
      }

      // 3. PUT 요청 — actualId 사용 (resolveOriginProductNo로 보정된 ID)
      const headers = await getNaverAuthHeaders(businessId)
      const putRes = await fetch(
        `${BASE_URL}/external/v1/products/origin-products/${actualId}`,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify(data),
        },
      )

      if (!putRes.ok) {
        const text = await putRes.text()
        throw new Error(`네이버 상품 수정 실패 (${putRes.status}): ${text}`)
      }

      // actualId가 원래 ID와 다르면 호출자가 DB 업데이트할 수 있도록 반환
      return {
        success: true,
        resolvedId: actualId !== platformProductId ? actualId : undefined,
      }
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
