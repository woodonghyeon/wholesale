'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/ui/PageHeader'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { getReturns, upsertReturn, deleteReturn, ReturnRow } from '@/lib/supabase/returns'
import { getBusinesses } from '@/lib/supabase/businesses'
import { getPartners } from '@/lib/supabase/partners'
import { getProducts } from '@/lib/supabase/products'
import { Return, Business, Partner, Product, ReturnReason, ReturnDisposition, ReturnStatus } from '@/lib/types'
import { getWarehouses } from '@/lib/supabase/warehouses'
import { adjustInventory } from '@/lib/supabase/inventory'
import { Warehouse } from '@/lib/types'
import { SortableHeader, useSortable } from '@/components/ui/SortableHeader'

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const labelCls = 'block text-sm font-medium text-gray-700 mb-1'

const REASON_LABEL: Record<ReturnReason, string> = {
  simple: '단순변심', defect: '불량', wrong_delivery: '오배송', other: '기타',
}
const DISPOSITION_LABEL: Record<ReturnDisposition, string> = {
  restock: '재입고', dispose: '폐기', return_to_supplier: '공급사반품',
}
const STATUS_LABEL: Record<ReturnStatus, { label: string; color: string }> = {
  received:   { label: '접수',    color: 'bg-gray-100 text-gray-600' },
  inspecting: { label: '검수중',  color: 'bg-blue-100 text-blue-700' },
  done:       { label: '처리완료', color: 'bg-green-100 text-green-700' },
}

const PAYMENT_METHODS = ['네이버페이', '신용카드', '체크카드', '계좌이체', '무통장입금', '현금', '기타']
const BANKS = ['국민', '신한', '하나', '우리', '기업', '농협', '카카오뱅크', '토스뱅크', 'SC제일', '씨티', '우체국', '기타']

export default function ReturnsPage() {
  const [returns, setReturns] = useState<ReturnRow[]>([])
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)
  const [bizFilter, setBizFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<Partial<Return>>({})
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [restockTarget, setRestockTarget] = useState<ReturnRow | null>(null)
  const [restockWarehouseId, setRestockWarehouseId] = useState('')
  const [restockLoading, setRestockLoading] = useState(false)
  const [detailRow, setDetailRow] = useState<ReturnRow | null>(null)

  useEffect(() => {
    Promise.all([getBusinesses(), getPartners(), getProducts(), getWarehouses()])
      .then(([b, p, pr, w]) => {
        setBusinesses(b); setPartners(p); setProducts(pr); setWarehouses(w)
      })
  }, [])
  useEffect(() => { load() }, [bizFilter])

  async function load() {
    setLoading(true)
    try { setReturns(await getReturns(bizFilter !== 'all' ? bizFilter : undefined)) }
    catch (e: unknown) { toast.error((e as Error).message) }
    finally { setLoading(false) }
  }

  async function save() {
    if (!editItem.business_id) return toast.error('사업자를 선택해주세요')
    if (!editItem.quantity || editItem.quantity <= 0) return toast.error('수량을 입력해주세요')
    try {
      await upsertReturn({
        status: 'received',
        restock_done: false,
        refund_done: false,
        quantity: 1,
        ...editItem,
      } as Return & { business_id: string })
      toast.success('저장되었습니다')
      setModalOpen(false); setEditItem({})
      await load()
    } catch (e: unknown) { toast.error((e as Error).message) }
  }

  async function handleRestock() {
    if (!restockTarget?.product_id) return toast.error('상품이 지정되지 않은 반품입니다')
    if (!restockWarehouseId) return toast.error('입고 창고를 선택해주세요')
    setRestockLoading(true)
    try {
      await adjustInventory({
        product_id:   restockTarget.product_id,
        business_id:  restockTarget.business_id,
        warehouse_id: restockWarehouseId,
        quantity:     restockTarget.quantity,
        note:         `반품 재입고: ${restockTarget.product_name ?? ''}`,
        allowNegative: false,
      })
      await upsertReturn({ ...restockTarget, status: 'done', restock_done: true })
      toast.success(`${restockTarget.quantity}개 재입고 완료, 상태를 처리완료로 변경했습니다`)
      setRestockTarget(null); setRestockWarehouseId('')
      await load()
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setRestockLoading(false) }
  }

  async function handleDelete() {
    if (!confirmId) return
    try { await deleteReturn(confirmId); toast.success('삭제되었습니다'); await load() }
    catch (e: unknown) { toast.error((e as Error).message) }
    finally { setConfirmId(null) }
  }

  function openNew() {
    setEditItem({
      business_id: businesses[0]?.id,
      quantity: 1,
      status: 'received',
      restock_done: false,
      refund_done: false,
    })
    setModalOpen(true)
  }

  const { sorted: sortedReturns, criteria, toggle } = useSortable(returns)

  // 집계
  const totalPending  = returns.filter(r => r.status !== 'done').length
  const totalRefund   = returns.reduce((s, r) => s + (r.refund_amount ?? 0), 0)
  const pendingRefund = returns.filter(r => !r.refund_done && (r.refund_amount ?? 0) > 0).length

  return (
    <div>
      <PageHeader
        title="반품·불량 관리"
        description={`총 ${returns.length}건 · 처리대기 ${totalPending}건`}
        action={
          <button onClick={openNew}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
            + 반품 등록
          </button>
        }
      />

      {/* 요약 카드 */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">전체 반품</p>
          <p className="text-2xl font-bold text-gray-900">{returns.length}<span className="text-sm font-normal text-gray-400 ml-1">건</span></p>
        </div>
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
          <p className="text-xs text-orange-600 mb-1">처리 대기</p>
          <p className="text-2xl font-bold text-orange-700">{totalPending}<span className="text-sm font-normal text-gray-400 ml-1">건</span></p>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-xl p-4">
          <p className="text-xs text-red-500 mb-1">환불 대기</p>
          <p className="text-2xl font-bold text-red-600">{pendingRefund}<span className="text-sm font-normal text-gray-400 ml-1">건</span></p>
        </div>
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
          <p className="text-xs text-indigo-500 mb-1">총 환불금액</p>
          <p className="text-2xl font-bold text-indigo-700">{totalRefund.toLocaleString()}<span className="text-sm font-normal text-gray-400 ml-1">원</span></p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <select value={bizFilter} onChange={e => setBizFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">전체 사업자</option>
          {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">불러오는 중...</div>
        ) : (
          <table className="w-full text-sm min-w-[1000px]">
            <thead className="bg-gray-50 text-xs">
              <tr>
                <SortableHeader field="created_at"      criteria={criteria} onSort={toggle}>접수일</SortableHeader>
                <SortableHeader field="orderer_name"    criteria={criteria} onSort={toggle}>주문자</SortableHeader>
                <SortableHeader field="partner_name"    criteria={criteria} onSort={toggle}>거래처</SortableHeader>
                <SortableHeader field="product_name"    criteria={criteria} onSort={toggle}>상품/옵션</SortableHeader>
                <SortableHeader field="quantity"        criteria={criteria} onSort={toggle} align="center">수량</SortableHeader>
                <SortableHeader field="payment_amount"  criteria={criteria} onSort={toggle}>결제</SortableHeader>
                <SortableHeader field="reason"          criteria={criteria} onSort={toggle}>반품사유</SortableHeader>
                <SortableHeader field="disposition"     criteria={criteria} onSort={toggle}>처리방법</SortableHeader>
                <SortableHeader field="refund_amount"   criteria={criteria} onSort={toggle}>환불</SortableHeader>
                <SortableHeader field="status"          criteria={criteria} onSort={toggle}>상태</SortableHeader>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sortedReturns.length === 0 && (
                <tr><td colSpan={11} className="px-4 py-12 text-center text-gray-400">반품 내역이 없습니다</td></tr>
              )}
              {sortedReturns.map(r => (
                <tr key={r.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setDetailRow(r)}>
                  <td className="px-3 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">{r.created_at.slice(0, 10)}</td>
                  <td className="px-3 py-3">
                    {r.orderer_name
                      ? <div>
                          <p className="font-medium text-gray-800">{r.orderer_name}</p>
                          {r.orderer_tel && <p className="text-xs text-gray-400">{r.orderer_tel}</p>}
                        </div>
                      : <span className="text-gray-300">-</span>
                    }
                  </td>
                  <td className="px-3 py-3 text-gray-600">{r.partner_name ?? '-'}</td>
                  <td className="px-3 py-3 max-w-[160px]">
                    <p className="font-medium text-gray-800 truncate">{r.product_name ?? '-'}</p>
                    {r.product_option && <p className="text-xs text-gray-400 truncate">{r.product_option}</p>}
                  </td>
                  <td className="px-3 py-3 text-center text-gray-700">{r.quantity}</td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {r.payment_method
                      ? <div>
                          <p className="text-xs font-medium text-gray-700">{r.payment_method}</p>
                          {r.payment_amount && <p className="text-xs text-gray-400">{r.payment_amount.toLocaleString()}원</p>}
                        </div>
                      : <span className="text-gray-300">-</span>
                    }
                  </td>
                  <td className="px-3 py-3 text-gray-500 text-xs">{r.reason ? REASON_LABEL[r.reason] : '-'}</td>
                  <td className="px-3 py-3 text-gray-500 text-xs">{r.disposition ? DISPOSITION_LABEL[r.disposition] : '-'}</td>
                  <td className="px-3 py-3">
                    {r.refund_amount
                      ? <div>
                          <p className={`text-xs font-semibold ${r.refund_done ? 'text-green-600' : 'text-red-500'}`}>
                            {r.refund_amount.toLocaleString()}원
                          </p>
                          <p className="text-xs text-gray-400">
                            {r.refund_done ? '✓ 환불완료' : '미완료'}
                          </p>
                        </div>
                      : <span className="text-gray-300">-</span>
                    }
                  </td>
                  <td className="px-3 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_LABEL[r.status].color}`}>
                      {STATUS_LABEL[r.status].label}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                    {!r.restock_done && r.product_id && r.disposition === 'restock' && (
                      <button
                        onClick={() => { setRestockTarget(r); setRestockWarehouseId('') }}
                        className="text-xs mr-2 px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100"
                      >재고 환입</button>
                    )}
                    <button
                      onClick={() => { setEditItem(r); setModalOpen(true) }}
                      className="text-blue-600 hover:underline mr-2 text-xs">수정</button>
                    <button onClick={() => setConfirmId(r.id)} className="text-red-500 hover:underline text-xs">삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── 상세 모달 ─────────────────────────── */}
      <Modal open={!!detailRow} onClose={() => setDetailRow(null)} title="반품 상세 정보" size="lg">
        {detailRow && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              {/* 주문자 정보 */}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">주문자 정보</p>
                <dl className="space-y-1.5">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">이름</dt>
                    <dd className="font-medium text-gray-800">{detailRow.orderer_name ?? '-'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">연락처</dt>
                    <dd className="font-medium text-gray-800">{detailRow.orderer_tel ?? '-'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">거래처</dt>
                    <dd className="font-medium text-gray-800">{detailRow.partner_name ?? '-'}</dd>
                  </div>
                  {detailRow.naver_order_id && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">네이버 주문번호</dt>
                      <dd className="font-mono text-xs text-green-700">{detailRow.naver_order_id}</dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* 상품 정보 */}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">상품 정보</p>
                <dl className="space-y-1.5">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">상품명</dt>
                    <dd className="font-medium text-gray-800 text-right max-w-[160px]">{detailRow.product_name ?? '-'}</dd>
                  </div>
                  {detailRow.product_option && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">옵션</dt>
                      <dd className="text-gray-700">{detailRow.product_option}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-gray-500">반품 수량</dt>
                    <dd className="font-bold text-gray-900">{detailRow.quantity}개</dd>
                  </div>
                  {detailRow.unit_price && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">단가</dt>
                      <dd className="text-gray-700">{detailRow.unit_price.toLocaleString()}원</dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* 결제 정보 */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <p className="text-xs font-semibold text-blue-500 mb-2 uppercase tracking-wide">결제 정보</p>
                <dl className="space-y-1.5">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">결제수단</dt>
                    <dd className="font-medium text-gray-800">{detailRow.payment_method ?? '-'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">결제금액</dt>
                    <dd className="font-bold text-blue-700">
                      {detailRow.payment_amount ? `${detailRow.payment_amount.toLocaleString()}원` : '-'}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* 환불 정보 */}
              <div className={`rounded-xl p-4 border ${detailRow.refund_done ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                <p className={`text-xs font-semibold mb-2 uppercase tracking-wide ${detailRow.refund_done ? 'text-green-600' : 'text-red-500'}`}>
                  환불 정보 {detailRow.refund_done ? '✓ 완료' : '· 미완료'}
                </p>
                <dl className="space-y-1.5">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">환불금액</dt>
                    <dd className={`font-bold ${detailRow.refund_done ? 'text-green-700' : 'text-red-600'}`}>
                      {detailRow.refund_amount ? `${detailRow.refund_amount.toLocaleString()}원` : '-'}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">은행</dt>
                    <dd className="font-medium text-gray-800">{detailRow.refund_bank ?? '-'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">계좌번호</dt>
                    <dd className="font-mono text-xs text-gray-800">{detailRow.refund_account ?? '-'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">예금주</dt>
                    <dd className="font-medium text-gray-800">{detailRow.refund_holder ?? '-'}</dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* 처리 정보 */}
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">처리 정보</p>
              <div className="flex flex-wrap gap-4">
                <div><span className="text-gray-500 text-xs">접수일</span> <span className="ml-1 font-medium">{detailRow.created_at.slice(0, 10)}</span></div>
                <div><span className="text-gray-500 text-xs">반품사유</span> <span className="ml-1 font-medium">{detailRow.reason ? REASON_LABEL[detailRow.reason] : '-'}</span></div>
                <div><span className="text-gray-500 text-xs">처리방법</span> <span className="ml-1 font-medium">{detailRow.disposition ? DISPOSITION_LABEL[detailRow.disposition] : '-'}</span></div>
                <div><span className="text-gray-500 text-xs">처리상태</span> <span className={`ml-1 text-xs px-2 py-0.5 rounded-full ${STATUS_LABEL[detailRow.status].color}`}>{STATUS_LABEL[detailRow.status].label}</span></div>
              </div>
              {detailRow.note && <p className="text-gray-600 text-xs mt-2 border-t border-gray-200 pt-2">메모: {detailRow.note}</p>}
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <button onClick={() => setDetailRow(null)}
                className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">닫기</button>
              <button onClick={() => { setEditItem(detailRow); setDetailRow(null); setModalOpen(true) }}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">수정</button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── 등록/수정 모달 ────────────────────── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem.id ? '반품 수정' : '반품 등록'} size="xl">
        <div className="space-y-4">
          {/* 기본 정보 */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">기본 정보</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>사업자 *</label>
                <select className={inputCls} value={editItem.business_id ?? ''} onChange={e => setEditItem(p => ({ ...p, business_id: e.target.value }))}>
                  <option value="">선택</option>
                  {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div><label className={labelCls}>거래처</label>
                <select className={inputCls} value={editItem.partner_id ?? ''} onChange={e => setEditItem(p => ({ ...p, partner_id: e.target.value || null }))}>
                  <option value="">선택 안 함</option>
                  {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* 주문자 정보 */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">주문자 정보</p>
            <div className="grid grid-cols-3 gap-3">
              <div><label className={labelCls}>주문자 이름</label>
                <input className={inputCls} value={editItem.orderer_name ?? ''} onChange={e => setEditItem(p => ({ ...p, orderer_name: e.target.value || null }))} placeholder="홍길동" />
              </div>
              <div><label className={labelCls}>연락처</label>
                <input className={inputCls} value={editItem.orderer_tel ?? ''} onChange={e => setEditItem(p => ({ ...p, orderer_tel: e.target.value || null }))} placeholder="010-0000-0000" />
              </div>
              <div><label className={labelCls}>네이버 주문번호</label>
                <input className={inputCls} value={editItem.naver_order_id ?? ''} onChange={e => setEditItem(p => ({ ...p, naver_order_id: e.target.value || null }))} placeholder="2024XXXXXXXXXX" />
              </div>
            </div>
          </div>

          {/* 상품 정보 */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">상품 정보</p>
            <div className="grid grid-cols-3 gap-3">
              <div><label className={labelCls}>상품</label>
                <select className={inputCls} value={editItem.product_id ?? ''} onChange={e => setEditItem(p => ({ ...p, product_id: e.target.value || null }))}>
                  <option value="">선택 안 함</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div><label className={labelCls}>옵션 (색상/사이즈 등)</label>
                <input className={inputCls} value={editItem.product_option ?? ''} onChange={e => setEditItem(p => ({ ...p, product_option: e.target.value || null }))} placeholder="블랙 / L" />
              </div>
              <div><label className={labelCls}>수량 *</label>
                <input type="number" className={inputCls} value={editItem.quantity ?? 1} onChange={e => setEditItem(p => ({ ...p, quantity: parseInt(e.target.value) || 1 }))} />
              </div>
            </div>
          </div>

          {/* 결제 정보 */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">결제 정보</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>결제수단</label>
                <select className={inputCls} value={editItem.payment_method ?? ''} onChange={e => setEditItem(p => ({ ...p, payment_method: e.target.value || null }))}>
                  <option value="">선택</option>
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div><label className={labelCls}>결제금액</label>
                <input type="number" className={inputCls} value={editItem.payment_amount ?? ''} onChange={e => setEditItem(p => ({ ...p, payment_amount: parseInt(e.target.value) || null }))} placeholder="0" />
              </div>
            </div>
          </div>

          {/* 환불 정보 */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">환불 정보</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>환불금액</label>
                <input type="number" className={inputCls} value={editItem.refund_amount ?? ''} onChange={e => setEditItem(p => ({ ...p, refund_amount: parseInt(e.target.value) || null }))} placeholder="0" />
              </div>
              <div><label className={labelCls}>환불 완료</label>
                <select className={inputCls} value={editItem.refund_done ? 'true' : 'false'} onChange={e => setEditItem(p => ({ ...p, refund_done: e.target.value === 'true' }))}>
                  <option value="false">미완료</option>
                  <option value="true">완료</option>
                </select>
              </div>
              <div><label className={labelCls}>환불 은행</label>
                <select className={inputCls} value={editItem.refund_bank ?? ''} onChange={e => setEditItem(p => ({ ...p, refund_bank: e.target.value || null }))}>
                  <option value="">선택</option>
                  {BANKS.map(b => <option key={b} value={b}>{b}은행</option>)}
                </select>
              </div>
              <div><label className={labelCls}>환불 계좌번호</label>
                <input className={inputCls} value={editItem.refund_account ?? ''} onChange={e => setEditItem(p => ({ ...p, refund_account: e.target.value || null }))} placeholder="000-0000-0000-00" />
              </div>
              <div><label className={labelCls}>예금주</label>
                <input className={inputCls} value={editItem.refund_holder ?? ''} onChange={e => setEditItem(p => ({ ...p, refund_holder: e.target.value || null }))} placeholder="홍길동" />
              </div>
            </div>
          </div>

          {/* 처리 정보 */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">처리 정보</p>
            <div className="grid grid-cols-3 gap-3">
              <div><label className={labelCls}>반품사유</label>
                <select className={inputCls} value={editItem.reason ?? ''} onChange={e => setEditItem(p => ({ ...p, reason: (e.target.value || null) as ReturnReason | null }))}>
                  <option value="">선택</option>
                  {Object.entries(REASON_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div><label className={labelCls}>처리방법</label>
                <select className={inputCls} value={editItem.disposition ?? ''} onChange={e => setEditItem(p => ({ ...p, disposition: (e.target.value || null) as ReturnDisposition | null }))}>
                  <option value="">선택</option>
                  {Object.entries(DISPOSITION_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div><label className={labelCls}>상태</label>
                <select className={inputCls} value={editItem.status ?? 'received'} onChange={e => setEditItem(p => ({ ...p, status: e.target.value as ReturnStatus }))}>
                  {Object.entries(STATUS_LABEL).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div><label className={labelCls}>메모</label>
            <textarea className={inputCls} rows={2} value={editItem.note ?? ''} onChange={e => setEditItem(p => ({ ...p, note: e.target.value }))} />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">취소</button>
            <button onClick={save} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">저장</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!confirmId} message="반품 내역을 삭제하시겠습니까?" onConfirm={handleDelete} onCancel={() => setConfirmId(null)} />

      {/* 재고 환입 모달 */}
      <Modal open={!!restockTarget} onClose={() => setRestockTarget(null)} title="재고 환입" size="sm">
        {restockTarget && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-3 text-sm">
              <p className="font-medium text-gray-800">{restockTarget.product_name ?? '-'}</p>
              <p className="text-gray-500 mt-0.5">수량: <b>{restockTarget.quantity}</b>개 · 거래처: {restockTarget.partner_name ?? '-'}</p>
            </div>
            <div>
              <label className={labelCls}>입고 창고 *</label>
              <select className={inputCls} value={restockWarehouseId} onChange={e => setRestockWarehouseId(e.target.value)}>
                <option value="">선택</option>
                {warehouses
                  .filter(w => !w.business_id || w.business_id === restockTarget.business_id)
                  .map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div className="bg-blue-50 text-blue-700 text-xs rounded-lg p-2.5">
              재고 환입 시 재고가 +{restockTarget.quantity}개 증가하고, 반품 상태가 <b>처리완료</b>로 변경됩니다.
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <button onClick={() => setRestockTarget(null)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">취소</button>
              <button onClick={handleRestock} disabled={restockLoading || !restockWarehouseId}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                {restockLoading ? '처리 중...' : '재고 환입 확정'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
