import { createClient } from './client'
import { Product } from '@/lib/types'
import { logActivity } from './logs'

export async function getProducts(businessId?: string): Promise<Product[]> {
  const supabase = createClient()
  let query = supabase.from('products').select('*').order('name')
  if (businessId && businessId !== 'all') query = query.eq('business_id', businessId)
  const { data, error } = await query
  if (error) throw new Error('상품 목록 조회 실패: ' + error.message)
  return data ?? []
}

export async function upsertProduct(product: Partial<Product> & { name: string }): Promise<Product> {
  const supabase = createClient()
  const isNew = !product.id

  // 신규 저장 시: 같은 이름+사업자 상품이 이미 있으면 그 상품을 업데이트 (바코드 병합)
  if (isNew) {
    let dupQuery = supabase
      .from('products')
      .select('id')
      .eq('name', product.name)
    if (product.business_id) {
      dupQuery = dupQuery.eq('business_id', product.business_id)
    } else {
      dupQuery = dupQuery.is('business_id', null)
    }
    const { data: dup } = await dupQuery.maybeSingle()
    if (dup) {
      product = { ...product, id: dup.id }
    }
  }

  const actionType = !product.id ? 'create' : 'update'

  const { data, error } = await supabase
    .from('products')
    .upsert(product)
    .select()
    .single()
  if (error) throw new Error('상품 저장 실패: ' + error.message)
  logActivity({
    action_type: actionType,
    resource_type: 'product',
    resource_id: data.id,
    description: `상품 ${actionType === 'create' ? '등록' : '수정'}: ${product.name}`,
    metadata: { name: product.name, barcode: product.barcode, sell_price: product.sell_price },
  })
  return data
}

// 같은 이름+사업자 조합의 중복 상품을 병합: 바코드 있는 것을 기준으로 나머지 삭제
export async function mergeDuplicateProducts(): Promise<number> {
  const supabase = createClient()
  const { data: all, error } = await supabase.from('products').select('*').order('name')
  if (error) throw new Error('상품 목록 조회 실패: ' + error.message)
  if (!all) return 0

  // 이름+사업자 기준 그룹핑
  const groups = new Map<string, Product[]>()
  for (const p of all) {
    const key = `${p.name}__${p.business_id ?? ''}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(p)
  }

  let merged = 0
  for (const group of Array.from(groups.values())) {
    if (group.length <= 1) continue

    // 바코드 있는 것 우선, 없으면 먼저 생성된 것 기준
    const keeper = group.find(p => p.barcode) ?? group[0]
    const toDelete = group.filter(p => p.id !== keeper.id)

    // keeper에 없는 정보 병합 (바코드, 가격 등)
    const merged_barcode = keeper.barcode ?? group.find(p => p.barcode)?.barcode ?? null
    const merged_buy = keeper.buy_price || group.find(p => p.buy_price)?.buy_price || 0
    const merged_sell = keeper.sell_price || group.find(p => p.sell_price)?.sell_price || 0
    const merged_min = keeper.min_stock || group.find(p => p.min_stock)?.min_stock || 0

    await supabase.from('products').update({
      barcode: merged_barcode,
      buy_price: merged_buy,
      sell_price: merged_sell,
      min_stock: merged_min,
    }).eq('id', keeper.id)

    for (const dup of toDelete) {
      await supabase.from('products').delete().eq('id', dup.id)
      merged++
    }
  }

  return merged
}

export async function deleteProduct(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) throw new Error('상품 삭제 실패: ' + error.message)
  logActivity({ action_type: 'delete', resource_type: 'product', resource_id: id, description: `상품 삭제: ${id.slice(0, 8)}` })
}
