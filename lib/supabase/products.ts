import { createClient } from './client'
import { Product } from '@/lib/types'

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
  const { data, error } = await supabase
    .from('products')
    .upsert(product)
    .select()
    .single()
  if (error) throw new Error('상품 저장 실패: ' + error.message)
  return data
}

export async function deleteProduct(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) throw new Error('상품 삭제 실패: ' + error.message)
}
