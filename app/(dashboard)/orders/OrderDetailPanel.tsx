'use client'

interface Order {
  id: string
  external_order_id: string
  external_product_order_id?: string
  platform_type: string
  order_status: string
  ordered_at: string
  buyer_name?: string
  buyer_phone?: string
  receiver_name?: string
  receiver_phone?: string
  receiver_address?: string
  receiver_zipcode?: string
  product_name?: string
  option_info?: string
  quantity: number
  unit_price: number
  total_amount: number
  shipping_fee: number
  tracking_number?: string
  shipping_company?: string
  is_processed: boolean
  memo?: string
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  payment_waiting: { label: '입금대기', color: 'bg-yellow-100 text-yellow-700' },
  paid:            { label: '결제완료', color: 'bg-green-100 text-green-700' },
  shipping:        { label: '배송중',   color: 'bg-blue-100 text-blue-700' },
  delivered:       { label: '배송완료', color: 'bg-emerald-100 text-emerald-700' },
  confirmed:       { label: '구매확정', color: 'bg-purple-100 text-purple-700' },
  cancel_request:  { label: '취소요청', color: 'bg-orange-100 text-orange-700' },
  return_request:  { label: '반품요청', color: 'bg-orange-100 text-orange-700' },
  exchange_request:{ label: '교환요청', color: 'bg-indigo-100 text-indigo-700' },
  cancelled:       { label: '취소완료', color: 'bg-red-100 text-red-700' },
  returned:        { label: '반품완료', color: 'bg-red-100 text-red-700' },
  exchanged:       { label: '교환완료', color: 'bg-indigo-100 text-indigo-700' },
}

const fmt = (n: number) => new Intl.NumberFormat('ko-KR').format(n)
const fmtDate = (s: string) =>
  new Date(s).toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })

interface Props {
  order: Order
  onClose: () => void
}

export default function OrderDetailPanel({ order, onClose }: Props) {
  const status = STATUS_LABEL[order.order_status] ?? { label: order.order_status, color: 'bg-gray-100 text-gray-700' }

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      {/* 배경 오버레이 */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" onClick={onClose} />

      {/* 패널 */}
      <div className="relative z-10 w-[420px] h-full bg-white/95 backdrop-blur-2xl border-l border-black/[0.06] shadow-2xl flex flex-col overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06]">
          <div>
            <h2 className="text-sm font-semibold text-[#1d1d1f]">주문 상세</h2>
            <p className="text-xs text-[#86868b] mt-0.5">{order.external_product_order_id ?? order.external_order_id}</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 내용 */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* 상태 + 주문일 */}
          <div className="flex items-center justify-between">
            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}>
              {status.label}
            </span>
            <span className="text-xs text-[#86868b]">{fmtDate(order.ordered_at)}</span>
          </div>

          {/* 상품 정보 */}
          <section>
            <h3 className="text-xs font-semibold text-[#86868b] uppercase tracking-wider mb-2">상품</h3>
            <div className="bg-gray-50 rounded-xl p-3.5 space-y-2">
              <p className="text-sm font-medium text-[#1d1d1f]">{order.product_name || '—'}</p>
              {order.option_info && (
                <p className="text-xs text-[#86868b]">{order.option_info}</p>
              )}
              <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                <span className="text-xs text-[#86868b]">수량 {order.quantity}개 × {fmt(order.unit_price)}원</span>
                <span className="text-sm font-semibold text-[#1d1d1f]">{fmt(order.total_amount)}원</span>
              </div>
              {order.shipping_fee > 0 && (
                <p className="text-xs text-[#86868b]">배송비 {fmt(order.shipping_fee)}원 포함</p>
              )}
            </div>
          </section>

          {/* 구매자 */}
          <section>
            <h3 className="text-xs font-semibold text-[#86868b] uppercase tracking-wider mb-2">구매자</h3>
            <div className="space-y-1.5">
              <Row label="이름" value={order.buyer_name} />
              <Row label="연락처" value={order.buyer_phone} />
            </div>
          </section>

          {/* 수령인 */}
          <section>
            <h3 className="text-xs font-semibold text-[#86868b] uppercase tracking-wider mb-2">수령인</h3>
            <div className="space-y-1.5">
              <Row label="이름" value={order.receiver_name} />
              <Row label="연락처" value={order.receiver_phone} />
              <Row label="주소" value={[order.receiver_zipcode && `(${order.receiver_zipcode})`, order.receiver_address].filter(Boolean).join(' ')} />
            </div>
          </section>

          {/* 배송 */}
          {(order.tracking_number || order.shipping_company) && (
            <section>
              <h3 className="text-xs font-semibold text-[#86868b] uppercase tracking-wider mb-2">배송</h3>
              <div className="space-y-1.5">
                <Row label="택배사" value={order.shipping_company} />
                <Row label="운송장" value={order.tracking_number} />
              </div>
            </section>
          )}

          {/* 처리 상태 */}
          <section>
            <h3 className="text-xs font-semibold text-[#86868b] uppercase tracking-wider mb-2">처리 상태</h3>
            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
              order.is_processed ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
            }`}>
              {order.is_processed ? '전표 변환 완료' : '미처리'}
            </span>
          </section>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-xs text-[#86868b] w-14 shrink-0 pt-0.5">{label}</span>
      <span className="text-xs text-[#1d1d1f]">{value || '—'}</span>
    </div>
  )
}
