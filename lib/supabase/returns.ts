import { createClient } from './client'
import { Return, ReturnReason, ReturnDisposition, ReturnStatus } from '@/lib/types'
import { logActivity } from './logs'

export interface ReturnRow extends Return {
  partner_name?: string
  product_name?: string
}

export async function getReturns(businessId?: string): Promise<ReturnRow[]> {
  const supabase = createClient()
  let query = supabase
    .from('returns')
    .select(`
      *,
      partners(name),
      products(name)
    `)
    .order('created_at', { ascending: false })
  if (businessId && businessId !== 'all') query = query.eq('business_id', businessId)
  const { data, error } = await query
  if (error) throw new Error('반품 조회 실패: ' + error.message)
  return (data ?? []).map((r: any) => ({
    ...r,
    // 신규 컬럼 기본값 처리 (컬럼 추가 전 구버전 데이터 대비)
    orderer_name:   r.orderer_name   ?? null,
    orderer_tel:    r.orderer_tel    ?? null,
    product_option: r.product_option ?? null,
    unit_price:     r.unit_price     ?? null,
    payment_method: r.payment_method ?? null,
    payment_amount: r.payment_amount ?? null,
    naver_order_id: r.naver_order_id ?? null,
    refund_bank:    r.refund_bank    ?? null,
    refund_account: r.refund_account ?? null,
    refund_holder:  r.refund_holder  ?? null,
    refund_amount:  r.refund_amount  ?? null,
    refund_done:    r.refund_done    ?? false,
    partner_name:   r.partners?.name ?? null,
    product_name:   r.products?.name ?? null,
  }))
}

export async function upsertReturn(entry: Partial<Return> & { business_id: string }): Promise<Return> {
  const supabase = createClient()
  const isNew = !entry.id
  const { data, error } = await supabase.from('returns').upsert(entry).select().single()
  if (error) throw new Error('저장 실패: ' + error.message)
  logActivity({
    action_type: isNew ? 'create' : 'update',
    resource_type: 'return',
    resource_id: data.id,
    description: `반품 ${isNew ? '등록' : '수정'}: ${entry.quantity}개 (${entry.reason ?? '사유미입력'})`,
    metadata: { quantity: entry.quantity, reason: entry.reason, status: entry.status },
  })
  return data
}

export async function deleteReturn(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('returns').delete().eq('id', id)
  if (error) throw new Error('삭제 실패: ' + error.message)
  logActivity({ action_type: 'delete', resource_type: 'return', resource_id: id, description: `반품 삭제: ${id.slice(0, 8)}` })
}
