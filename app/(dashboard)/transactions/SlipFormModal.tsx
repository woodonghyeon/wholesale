'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Business, Partner, Channel, Warehouse, Product, SlipType, PaymentType } from '@/lib/types'
import type { SlipFormData, SlipItemFormData } from '@/lib/supabase/slips'
import { createSlip } from '@/lib/supabase/slips'
import { toast } from 'sonner'

interface Props {
  businessId: string
  defaultType?: SlipType
  onClose: () => void
  onSaved: () => void
}

function fmt(n: number) {
  return new Intl.NumberFormat('ko-KR').format(n)
}

export default function SlipFormModal({ businessId, defaultType = 'sale', onClose, onSaved }: Props) {
  const supabase = createClient()

  const [slipType, setSlipType] = useState<SlipType>(defaultType)
  const [slipDate, setSlipDate] = useState(new Date().toISOString().slice(0, 10))
  const [partnerId, setPartnerId] = useState('')
  const [channelId, setChannelId] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [paymentType, setPaymentType] = useState<PaymentType>('cash')
  const [memo, setMemo] = useState('')
  const [items, setItems] = useState<SlipItemFormData[]>([{ product_id: '', quantity: 1, unit_price: 0 }])
  const [saving, setSaving] = useState(false)

  const [businesses, setBusinesses] = useState<Business[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [products, setProducts] = useState<Product[]>([])

  const [selectedBizId, setSelectedBizId] = useState(businessId === 'all' ? '' : businessId)

  useEffect(() => {
    async function load() {
      const [b, p, c, w, pr] = await Promise.all([
        supabase.from('businesses').select('*').order('sort_order'),
        supabase.from('partners').select('*').order('name'),
        supabase.from('channels').select('*').order('sort_order'),
        supabase.from('warehouses').select('*').order('name'),
        supabase.from('products').select('*').order('name'),
      ])
      setBusinesses(b.data ?? [])
      setPartners(p.data ?? [])
      setChannels(c.data ?? [])
      setWarehouses(w.data ?? [])
      setProducts(pr.data ?? [])
      if (businessId !== 'all') {
        setSelectedBizId(businessId)
      } else if (b.data && b.data.length > 0) {
        setSelectedBizId(b.data[0].id)
      }
    }
    load()
  }, [])

  const filteredWarehouses = warehouses.filter(w => !selectedBizId || w.business_id === selectedBizId)
  const filteredProducts = products.filter(p => !selectedBizId || p.business_id === selectedBizId)
  const filteredChannels = channels.filter(c => !selectedBizId || (c as any).business_id === selectedBizId)
  const filteredPartners = partners.filter(p => {
    if (slipType === 'sale') return p.partner_type === 'customer' || p.partner_type === 'both'
    return p.partner_type === 'supplier' || p.partner_type === 'both'
  })

  const supplyTotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0)
  const taxTotal = Math.round(supplyTotal * 0.1)
  const grandTotal = supplyTotal + taxTotal

  function updateItem(idx: number, field: keyof SlipItemFormData, value: string | number) {
    setItems(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], [field]: value }
      return next
    })
  }

  function addItem() {
    setItems(prev => [...prev, { product_id: '', quantity: 1, unit_price: 0 }])
  }

  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  function onProductSelect(idx: number, productId: string) {
    const product = filteredProducts.find(p => p.id === productId)
    setItems(prev => {
      const next = [...prev]
      next[idx] = {
        ...next[idx],
        product_id: productId,
        unit_price: slipType === 'sale' ? (product?.sell_price ?? 0) : (product?.buy_price ?? 0),
      }
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedBizId) { toast.error('사업자를 선택하세요.'); return }
    if (items.some(i => !i.product_id)) { toast.error('상품을 모두 선택하세요.'); return }
    if (items.some(i => i.quantity <= 0)) { toast.error('수량은 1 이상이어야 합니다.'); return }

    setSaving(true)
    try {
      const form: SlipFormData = {
        slip_type: slipType,
        business_id: selectedBizId,
        partner_id: partnerId || undefined,
        channel_id: channelId || undefined,
        warehouse_id: warehouseId || undefined,
        slip_date: slipDate,
        payment_type: paymentType,
        memo: memo || undefined,
        items,
      }
      await createSlip(form)
      toast.success('전표가 저장되었습니다.')
      onSaved()
    } catch (err: any) {
      toast.error(err?.message ?? '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-white/90 backdrop-blur-2xl rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06]">
          <h2 className="text-base font-semibold text-[#1d1d1f]">새 거래전표</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition text-[#86868b]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-5">
            {/* 타입 + 사업자 + 날짜 */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#86868b] mb-1">구분</label>
                <div className="inline-flex bg-gray-100 rounded-lg p-0.5 w-full">
                  {(['sale', 'purchase'] as SlipType[]).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSlipType(t)}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-md transition ${
                        slipType === t ? 'bg-white shadow-sm text-[#1d1d1f]' : 'text-[#86868b]'
                      }`}
                    >
                      {t === 'sale' ? '매출' : '매입'}
                    </button>
                  ))}
                </div>
              </div>

              {businessId === 'all' && (
                <div>
                  <label className="block text-xs font-medium text-[#86868b] mb-1">사업자</label>
                  <select
                    value={selectedBizId}
                    onChange={e => setSelectedBizId(e.target.value)}
                    className="w-full rounded-lg border border-gray-300/60 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="">선택</option>
                    {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[#86868b] mb-1">전표일자</label>
                <input
                  type="date"
                  value={slipDate}
                  onChange={e => setSlipDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300/60 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#86868b] mb-1">결제방식</label>
                <select
                  value={paymentType}
                  onChange={e => setPaymentType(e.target.value as PaymentType)}
                  className="w-full rounded-lg border border-gray-300/60 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="cash">현금</option>
                  <option value="credit">외상</option>
                  <option value="mixed">혼합</option>
                </select>
              </div>
            </div>

            {/* 거래처 + 채널 + 창고 */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#86868b] mb-1">
                  {slipType === 'sale' ? '고객사' : '공급처'}
                </label>
                <select
                  value={partnerId}
                  onChange={e => setPartnerId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300/60 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">선택 안함</option>
                  {filteredPartners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              {slipType === 'sale' && (
                <div>
                  <label className="block text-xs font-medium text-[#86868b] mb-1">판매채널</label>
                  <select
                    value={channelId}
                    onChange={e => setChannelId(e.target.value)}
                    className="w-full rounded-lg border border-gray-300/60 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="">선택 안함</option>
                    {filteredChannels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[#86868b] mb-1">창고</label>
                <select
                  value={warehouseId}
                  onChange={e => setWarehouseId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300/60 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">선택 안함</option>
                  {filteredWarehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
            </div>

            {/* 품목 테이블 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-[#86868b]">품목</label>
                <button
                  type="button"
                  onClick={addItem}
                  className="text-xs text-[#007aff] font-medium hover:underline"
                >
                  + 품목 추가
                </button>
              </div>
              <div className="rounded-xl border border-black/[0.06] overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50/80">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-medium text-[#86868b] w-[40%]">상품</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-[#86868b] w-[15%]">수량</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-[#86868b] w-[20%]">단가</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-[#86868b] w-[20%]">공급가</th>
                      <th className="w-[5%]" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2">
                          <select
                            value={item.product_id}
                            onChange={e => onProductSelect(idx, e.target.value)}
                            className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          >
                            <option value="">상품 선택</option>
                            {filteredProducts.map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={e => updateItem(idx, 'quantity', Number(e.target.value))}
                            className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={0}
                            value={item.unit_price}
                            onChange={e => updateItem(idx, 'unit_price', Number(e.target.value))}
                            className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          />
                        </td>
                        <td className="px-3 py-2 text-right text-sm font-medium text-[#1d1d1f]">
                          {fmt(item.quantity * item.unit_price)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeItem(idx)}
                              className="p-1 rounded hover:bg-red-50 text-[#86868b] hover:text-[#ff3b30] transition"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 합계 */}
              <div className="mt-3 flex justify-end">
                <div className="space-y-1 text-right">
                  <div className="flex gap-8 text-xs text-[#86868b]">
                    <span>공급가액</span>
                    <span className="font-medium text-[#1d1d1f] w-28 text-right">₩{fmt(supplyTotal)}</span>
                  </div>
                  <div className="flex gap-8 text-xs text-[#86868b]">
                    <span>부가세(10%)</span>
                    <span className="font-medium text-[#1d1d1f] w-28 text-right">₩{fmt(taxTotal)}</span>
                  </div>
                  <div className="flex gap-8 text-sm border-t border-gray-100 pt-1">
                    <span className="font-semibold text-[#1d1d1f]">합계</span>
                    <span className="font-bold text-[#007aff] w-28 text-right">₩{fmt(grandTotal)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 메모 */}
            <div>
              <label className="block text-xs font-medium text-[#86868b] mb-1">메모</label>
              <textarea
                value={memo}
                onChange={e => setMemo(e.target.value)}
                rows={2}
                placeholder="특이사항 입력..."
                className="w-full rounded-lg border border-gray-300/60 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
              />
            </div>
          </div>

          {/* 푸터 */}
          <div className="px-6 py-4 border-t border-black/[0.06] flex justify-end gap-2 bg-gray-50/50">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium border border-gray-200 hover:bg-gray-50 transition"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg px-4 py-2 text-sm font-medium bg-[#007aff] text-white hover:bg-[#0066d6] transition disabled:opacity-50"
            >
              {saving ? '저장 중...' : '전표 저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
