'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { adjustInventoryDirect, fetchStockLogs } from '@/lib/supabase/inventory'
import type { InventoryWithProduct } from '@/lib/supabase/inventory'
import type { StockLog } from '@/lib/types'

function fmt(n: number) { return new Intl.NumberFormat('ko-KR').format(n) }

const LOG_TYPE_LABEL: Record<string, string> = {
  in: '입고',
  out: '출고',
  return_in: '반품입고',
  return_out: '반품출고',
  transfer_in: '이동입고',
  transfer_out: '이동출고',
  adjustment: '조정',
  bundle_out: '세트출고',
}

interface Props {
  item: InventoryWithProduct
  onClose: () => void
  onSaved: () => void
}

export default function InventoryAdjustModal({ item, onClose, onSaved }: Props) {
  const [newQty, setNewQty] = useState(item.quantity)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'adjust' | 'logs'>('adjust')
  const [logs, setLogs] = useState<StockLog[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)

  const delta = newQty - item.quantity

  async function loadLogs() {
    if (logs.length > 0) return
    setLoadingLogs(true)
    try {
      const data = await fetchStockLogs(item.product_id, item.business_id)
      setLogs(data)
    } catch {
      toast.error('이력을 불러오지 못했습니다.')
    } finally {
      setLoadingLogs(false)
    }
  }

  function switchTab(t: 'adjust' | 'logs') {
    setTab(t)
    if (t === 'logs') loadLogs()
  }

  async function handleSave() {
    if (newQty < 0) { toast.error('수량은 0 이상이어야 합니다.'); return }
    if (newQty === item.quantity) { toast.info('변경된 수량이 없습니다.'); return }
    setSaving(true)
    try {
      await adjustInventoryDirect({
        productId: item.product_id,
        businessId: item.business_id,
        warehouseId: item.warehouse_id,
        newQuantity: newQty,
        currentQuantity: item.quantity,
        note: note || '재고 직접 조정',
      })
      toast.success('재고가 조정되었습니다.')
      onSaved()
      onClose()
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : '') || '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-white/90 backdrop-blur-2xl rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-black/[0.06]">
          <div>
            <h2 className="text-base font-semibold text-[#1d1d1f]">{item.product.name}</h2>
            <p className="text-xs text-[#86868b] mt-0.5">
              {item.warehouse.name} · {item.product.category ?? '미분류'} · {item.product.unit}
            </p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-[#86868b] hover:bg-gray-200 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-5 pt-3 gap-3">
          {(['adjust', 'logs'] as const).map(t => (
            <button
              key={t}
              onClick={() => switchTab(t)}
              className={`text-sm font-medium pb-2 border-b-2 transition-all ${
                tab === t ? 'border-[#007aff] text-[#007aff]' : 'border-transparent text-[#86868b]'
              }`}
            >
              {t === 'adjust' ? '재고 조정' : '변동 이력'}
            </button>
          ))}
        </div>

        <div className="px-5 pb-5">
          {tab === 'adjust' ? (
            <div className="space-y-4 pt-4">
              {/* 현재 재고 */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <div className="text-xs text-[#86868b] mb-1">현재 재고</div>
                  <div className="text-xl font-semibold text-[#1d1d1f]">{fmt(item.quantity)}</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <div className="text-xs text-[#86868b] mb-1">안전재고</div>
                  <div className={`text-xl font-semibold ${item.quantity <= item.product.min_stock ? 'text-[#ff3b30]' : 'text-[#1d1d1f]'}`}>
                    {fmt(item.product.min_stock)}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <div className="text-xs text-[#86868b] mb-1">변경량</div>
                  <div className={`text-xl font-semibold ${delta > 0 ? 'text-[#34c759]' : delta < 0 ? 'text-[#ff3b30]' : 'text-[#86868b]'}`}>
                    {delta > 0 ? `+${fmt(delta)}` : fmt(delta)}
                  </div>
                </div>
              </div>

              {/* 조정 수량 */}
              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5">조정 후 수량</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setNewQty(q => Math.max(0, q - 1))}
                    className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-[#1d1d1f] hover:bg-gray-50 transition-colors text-lg font-medium"
                  >−</button>
                  <input
                    type="number"
                    min={0}
                    value={newQty}
                    onChange={e => setNewQty(Math.max(0, parseInt(e.target.value) || 0))}
                    className="flex-1 text-center text-lg font-semibold rounded-lg border border-gray-300/60 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <button
                    onClick={() => setNewQty(q => q + 1)}
                    className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-[#1d1d1f] hover:bg-gray-50 transition-colors text-lg font-medium"
                  >+</button>
                </div>
              </div>

              {/* 메모 */}
              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5">사유 메모</label>
                <input
                  type="text"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="재고 조정 사유 (선택)"
                  className="w-full rounded-lg border border-gray-300/60 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* 재고 가치 */}
              <div className="bg-blue-50/60 rounded-xl p-3 flex items-center justify-between">
                <span className="text-xs text-[#86868b]">조정 후 재고 가치</span>
                <span className="text-sm font-semibold text-[#007aff]">
                  ₩{fmt(newQty * item.product.buy_price)}
                </span>
              </div>

              <button
                onClick={handleSave}
                disabled={saving || newQty === item.quantity}
                className="w-full rounded-xl py-2.5 text-sm font-medium bg-[#007aff] text-white hover:bg-[#0066d6] disabled:opacity-40 transition-all duration-200"
              >
                {saving ? '저장 중...' : '재고 조정 저장'}
              </button>
            </div>
          ) : (
            <div className="pt-4">
              {loadingLogs ? (
                <div className="flex justify-center py-8">
                  <div className="w-5 h-5 border-2 border-[#007aff] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-8 text-sm text-[#86868b]">변동 이력이 없습니다.</div>
              ) : (
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {logs.map(log => (
                    <div key={log.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          log.quantity > 0
                            ? 'bg-green-50 text-[#34c759]'
                            : 'bg-red-50 text-[#ff3b30]'
                        }`}>
                          {LOG_TYPE_LABEL[log.log_type] ?? log.log_type}
                        </span>
                        <span className="text-xs text-[#86868b]">{log.note ?? '-'}</span>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-semibold ${log.quantity > 0 ? 'text-[#34c759]' : 'text-[#ff3b30]'}`}>
                          {log.quantity > 0 ? '+' : ''}{fmt(log.quantity)}
                        </div>
                        <div className="text-xs text-[#86868b]">
                          {new Date(log.created_at).toLocaleDateString('ko-KR')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
