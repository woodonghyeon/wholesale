import { createClient } from './client'
import { ProductOptionGroup, ProductOptionValue, ProductOptionCombination } from '@/lib/types'

export interface ProductOptionsData {
  groups: (ProductOptionGroup & { values: ProductOptionValue[] })[]
  combinations: ProductOptionCombination[]
}

/** 상품의 옵션 그룹+값+조합 전체 조회 */
export async function getProductOptions(productId: string): Promise<ProductOptionsData> {
  const supabase = createClient()

  const [groupsRes, combosRes] = await Promise.all([
    supabase
      .from('product_option_groups')
      .select('*, values:product_option_values(*)')
      .eq('product_id', productId)
      .order('display_order'),
    supabase
      .from('product_option_combinations')
      .select('*')
      .eq('product_id', productId)
      .order('created_at'),
  ])

  if (groupsRes.error) throw new Error('옵션 그룹 조회 실패: ' + groupsRes.error.message)
  if (combosRes.error) throw new Error('옵션 조합 조회 실패: ' + combosRes.error.message)

  const groups = (groupsRes.data ?? []).map((g: any) => ({
    ...g,
    values: (g.values ?? []).sort((a: ProductOptionValue, b: ProductOptionValue) => a.display_order - b.display_order),
  }))

  return { groups, combinations: combosRes.data ?? [] }
}

/**
 * 상품 옵션 저장 (전체 교체 방식)
 * groups: 옵션 그룹+값 구조
 * combinationDrafts: label, valueRefs([groupIdx, valueIdx][]), add_price, sku, is_active
 */
export interface OptionGroupInput {
  name: string
  values: string[]  // 옵션값 텍스트 배열
}

export interface CombinationInput {
  label: string
  valueRefs: [number, number][]  // [groupIndex, valueIndex] 배열
  add_price: number
  sku: string
  is_active: boolean
}

export async function saveProductOptions(
  productId: string,
  groups: OptionGroupInput[],
  combinations: CombinationInput[],
): Promise<void> {
  const supabase = createClient()

  // 1. 기존 옵션 전체 삭제 (CASCADE로 values, combinations도 삭제됨)
  const { error: delErr } = await supabase
    .from('product_option_groups')
    .delete()
    .eq('product_id', productId)
  if (delErr) throw new Error('기존 옵션 삭제 실패: ' + delErr.message)

  if (groups.length === 0) return

  // 2. 옵션 그룹 저장
  const { data: savedGroups, error: groupErr } = await supabase
    .from('product_option_groups')
    .insert(
      groups.map((g, i) => ({
        product_id: productId,
        name: g.name,
        display_order: i,
      }))
    )
    .select()
  if (groupErr || !savedGroups) throw new Error('옵션 그룹 저장 실패: ' + groupErr?.message)

  // 3. 옵션값 저장 (그룹별)
  const valueInserts: { option_group_id: string; value: string; display_order: number }[] = []
  for (let gi = 0; gi < savedGroups.length; gi++) {
    for (let vi = 0; vi < groups[gi].values.length; vi++) {
      const val = groups[gi].values[vi].trim()
      if (!val) continue
      valueInserts.push({
        option_group_id: savedGroups[gi].id,
        value: val,
        display_order: vi,
      })
    }
  }

  const { data: savedValues, error: valErr } = await supabase
    .from('product_option_values')
    .insert(valueInserts)
    .select()
  if (valErr || !savedValues) throw new Error('옵션값 저장 실패: ' + valErr?.message)

  // valueRef → saved value ID 매핑 구성
  // savedValues는 insert 순서대로 반환되므로 valueInserts 인덱스와 대응
  const valueIdMap: string[][] = savedGroups.map(() => [])
  let insertIdx = 0
  for (let gi = 0; gi < savedGroups.length; gi++) {
    for (let vi = 0; vi < groups[gi].values.length; vi++) {
      const val = groups[gi].values[vi].trim()
      if (!val) continue
      valueIdMap[gi][vi] = savedValues[insertIdx].id
      insertIdx++
    }
  }

  // 4. 조합 저장
  if (combinations.length === 0) return

  const comboInserts = combinations
    .filter(c => c.label.trim())
    .map(c => ({
      product_id: productId,
      option_value_ids: c.valueRefs.map(([gi, vi]) => valueIdMap[gi]?.[vi]).filter(Boolean),
      label: c.label,
      sku: c.sku || null,
      add_price: c.add_price,
      is_active: c.is_active,
    }))

  const { error: comboErr } = await supabase
    .from('product_option_combinations')
    .insert(comboInserts)
  if (comboErr) throw new Error('옵션 조합 저장 실패: ' + comboErr.message)
}

/** 상품 옵션 전체 삭제 */
export async function deleteProductOptions(productId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('product_option_groups')
    .delete()
    .eq('product_id', productId)
  if (error) throw new Error('옵션 삭제 실패: ' + error.message)
}
