/** 채널 어댑터 공통 인터페이스 */

export interface PlatformOption {
  platformOptionId: string
  label: string          // '빨강 / S'
  inventory: number
  addPrice: number
}

export interface PlatformProduct {
  platformProductId: string
  name: string
  price: number
  options: PlatformOption[]   // 빈 배열이면 옵션 없는 상품
  rawData?: unknown            // 원본 JSON (PUT 시 재사용)
}

export interface SyncPayload {
  price?: number                              // 변경할 가격 (undefined면 가격 동기화 안 함)
  inventory?: Map<string | null, number>      // platformOptionId → 수량 (null = 옵션 없는 상품)
}

export interface SyncResult {
  success: boolean
  error?: string
}

export interface ChannelAdapter {
  /** 플랫폼 상품 조회 (매핑 설정 시 + 미리보기용) */
  getProduct(platformProductId: string, businessId?: string): Promise<PlatformProduct>

  /** 가격/재고 동기화 (Read-Modify-Write) */
  syncProduct(platformProductId: string, payload: SyncPayload, businessId?: string): Promise<SyncResult>

  /** 플랫폼 전체 상품 목록 조회 (일괄 연동용, 선택 구현) */
  listProducts?(businessId?: string): Promise<PlatformProduct[]>
}
