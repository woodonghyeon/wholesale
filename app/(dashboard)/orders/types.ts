import type { fetchChannelOrders } from '@/lib/supabase/orders'

export type Order = Awaited<ReturnType<typeof fetchChannelOrders>>[number]

export const STATUS_BADGE: Record<string, string> = {
  payment_waiting: 'bg-yellow-100 text-yellow-700',
  paid:            'bg-green-100 text-green-700',
  shipping:        'bg-blue-100 text-blue-700',
  delivered:       'bg-emerald-100 text-emerald-700',
  confirmed:       'bg-purple-100 text-purple-700',
  cancel_request:  'bg-orange-100 text-orange-700',
  return_request:  'bg-orange-100 text-orange-700',
  exchange_request:'bg-indigo-100 text-indigo-700',
  cancelled:       'bg-red-100 text-red-700',
  returned:        'bg-red-100 text-red-700',
  exchanged:       'bg-indigo-100 text-indigo-700',
}

export const STATUS_LABEL: Record<string, string> = {
  payment_waiting: '입금대기',   paid: '결제완료',       shipping: '배송중',
  delivered:       '배송완료',   confirmed: '구매확정',   cancel_request: '취소요청',
  return_request:  '반품요청',   exchange_request: '교환요청',
  cancelled:       '취소완료',   returned: '반품완료',    exchanged: '교환완료',
}

export const fmt = (n: number) => new Intl.NumberFormat('ko-KR').format(n)
