import { createClient } from '@/lib/supabase/client'
import type { Product } from '@/lib/types'

export interface ProductFilter {
  businessId: string
  category?: string
  search?: string
}

export interface ProductFormData {
  business_id: string
  barcode?: string
  name: string
  category?: string
  unit: string
  buy_price: number
  sell_price: number
  min_stock: number
  is_bundle: boolean
  note?: string
}

export async function fetchProducts(filter: ProductFilter): Promise<Product[]> {
  const supabase = createClient()
  let query = supabase
    .from('products')
    .select('*, business:businesses(id,name)')
    .order('category', { ascending: true })
    .order('name', { ascending: true })

  if (filter.businessId !== 'all') {
    query = query.eq('business_id', filter.businessId)
  }
  if (filter.category) {
    query = query.eq('category', filter.category)
  }

  const { data, error } = await query
  if (error) throw error

  let result = (data ?? []) as Product[]

  if (filter.search) {
    const kw = filter.search.toLowerCase()
    result = result.filter(p =>
      p.name.toLowerCase().includes(kw) ||
      (p.barcode ?? '').toLowerCase().includes(kw) ||
      (p.category ?? '').toLowerCase().includes(kw)
    )
  }

  return result
}

export async function createProduct(data: ProductFormData): Promise<Product> {
  const supabase = createClient()
  const { data: created, error } = await supabase
    .from('products')
    .insert(data)
    .select('*, business:businesses(id,name)')
    .single()
  if (error) throw error
  return created as Product
}

export async function updateProduct(id: string, data: Partial<ProductFormData>): Promise<Product> {
  const supabase = createClient()
  const { data: updated, error } = await supabase
    .from('products')
    .update(data)
    .eq('id', id)
    .select('*, business:businesses(id,name)')
    .single()
  if (error) throw error
  return updated as Product
}

export async function deleteProduct(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) throw error
}

export async function fetchCategories(businessId: string): Promise<string[]> {
  const supabase = createClient()
  let query = supabase.from('products').select('category')
  if (businessId !== 'all') {
    query = query.eq('business_id', businessId)
  }
  const { data, error } = await query
  if (error) throw error
  const seen = new Set<string>()
  const cats: string[] = []
  for (const r of data ?? []) {
    if (r.category && !seen.has(r.category)) {
      seen.add(r.category)
      cats.push(r.category)
    }
  }
  return cats.sort()
}
