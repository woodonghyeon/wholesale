'use client'

import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/ui/PageHeader'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { getBusinesses } from '@/lib/supabase/businesses'
import { getWarehouses } from '@/lib/supabase/warehouses'
import {
  getStocktakeSessions, createStocktakeSession, getStocktakeItems,
  updateStocktakeItem, applyStocktakeAdjustments, updateSessionStatus,
  SessionRow, ItemRow,
} from '@/lib/supabase/stocktake'
import { Business, Warehouse } from '@/lib/types'
import { formatDate } from '@/lib/utils/format'

const STATUS_LABEL = { open: '진행중', reviewing: '검토중', done: '완료' }
const STATUS_COLOR = {
  open: 'bg-blue-100 text-blue-700',
  reviewing: 'bg-orange-100 text-orange-700',
  done: 'bg-gray-100 text-gray-600',
}

export default function StocktakePage() {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [selectedSession, setSelectedSession] = useState<SessionRow | null>(null)
  const [items, setItems] = useState<ItemRow[]>([])
  const [loading, setLoading] = useState(true)
  const [itemLoading, setItemLoading] = useState(false)
  const [bizFilter, setBizFilter] = useState('all')
  const [newModal, setNewModal] = useState(false)
  const [newForm, setNewForm] = useState({ business_id: '', warehouse_id: '', name: '' })
  const [confirmApply, setConfirmApply] = useState(false)
  const [editQty, setEditQty] = useState<Record<string, string>>({})
  const inputRef = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    Promise.all([getBusinesses(), getWarehouses()]).then(([b, w]) => {
      setBusinesses(b)
      setWarehouses(w)
      if (b[0]) setNewForm(f => ({ ...f, business_id: b[0].id }))
    })
  }, [])

  useEffect(() => { loadSessions() }, [bizFilter])

  useEffect(() => {
    if (selectedSession) loadItems(selectedSession.id)
  }, [selectedSession])

  async function loadSessions() {
    setLoading(true)
    try {
      const biz = bizFilter !== 'all' ? bizFilter : undefined
      setSessions(await getStocktakeSessions(biz))
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setLoading(false) }
  }

  async function loadItems(sessionId: string) {
    setItemLoading(true)
    try {
      const data = await getStocktakeItems(sessionId)
      setItems(data)
      const qtyMap: Record<string, string> = {}
      data.forEach(d => { if (d.actual_quantity !== null) qtyMap[d.id] = String(d.actual_quantity) })
      setEditQty(qtyMap)
    } catch (e: unknown) { toast.error((e as Error).message) }
    finally { setItemLoading(false) }
  }

  async function handleCreate() {
    if (!newForm.business_id || !newForm.warehouse_id || !newForm.name) return toast.error('모든 항목을 입력해주세요')
    try {
      const session = await createStocktakeSession(newForm)
      toast.success('실사 세션이 생성되었습니다')
      setNewModal(false)
      await loadSessions()
      setSelectedSession(session)
    } catch (e: unknown) { toast.error((e as Error).message) }
  }

  async function saveQty(item: ItemRow) {
    const val = editQty[item.id]
    if (val === undefined || val === '') return
    const actual = parseInt(val)
    if (isNaN(actual) || actual < 0) return
    try {
      await updateStocktakeItem(item.id, actual, item.system_quantity)
      setItems(prev => prev.map(it =>
        it.id === item.id
          ? { ...it, actual_quantity: actual, difference: actual - it.system_quantity }
          : it
      ))
    } catch (e: unknown) { toast.error((e as Error).message) }
  }

  async function handleApply() {
    if (!selectedSession) return
    try {
      await applyStocktakeAdjustments(selectedSession.id)
      toast.success('재고 조정이 완료되었습니다')
      setConfirmApply(false)
      await loadSessions()
      const updated = sessions.find(s => s.id === selectedSession.id)
      if (updated) setSelectedSession({ ...updated, status: 'done' })
    } catch (e: unknown) { toast.error((e as Error).message) }
  }

  const countedCount = items.filter(i => i.actual_quantity !== null).length
  const diffItems = items.filter(i => i.actual_quantity !== null && i.difference !== 0)
  const filteredWarehouses = newForm.business_id
    ? warehouses.filter(w => w.business_id === newForm.business_id)
    : warehouses

  return (
    <div>
      <PageHeader
        title="재고 실사"
        description="창고별 재고를 직접 확인하고 차이를 조정합니다"
        action={
          <button
            onClick={() => setNewModal(true)}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            + 실사 세션 생성
          </button>
        }
      />

      <div className="flex gap-2 mb-5">
        <select value={bizFilter} onChange={e => setBizFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">전체 사업자</option>
          {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-5 gap-5">
        {/* 세션 목록 */}
        <div className="col-span-2 bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50 text-sm font-semibold text-gray-700">실사 세션</div>
          {loading ? (
            <div className="py-12 text-center text-sm text-gray-400">불러오는 중...</div>
          ) : sessions.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">세션이 없습니다</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {sessions.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSession(s)}
                  className={`w-full flex items-start justify-between px-4 py-3 text-left transition-colors ${
                    selectedSession?.id === s.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">{s.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{s.warehouse_name} · {s.started_at.slice(0, 10)}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full mt-0.5 ${STATUS_COLOR[s.status]}`}>
                    {STATUS_LABEL[s.status]}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 실사 내역 */}
        <div className="col-span-3 bg-white rounded-xl border border-gray-100 overflow-hidden">
          {selectedSession ? (
            <>
              <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{selectedSession.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {selectedSession.warehouse_name} · 입력 {countedCount}/{items.length}개
                    {diffItems.length > 0 && (
                      <span className="text-orange-500 ml-1">· 차이 {diffItems.length}건</span>
                    )}
                  </p>
                </div>
                {selectedSession.status !== 'done' && (
                  <button
                    onClick={() => setConfirmApply(true)}
                    disabled={countedCount === 0}
                    className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40"
                  >
                    조정 적용
                  </button>
                )}
              </div>

              {itemLoading ? (
                <div className="py-12 text-center text-sm text-gray-400">불러오는 중...</div>
              ) : items.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-400">이 창고에 재고가 없습니다</div>
              ) : (
                <div className="overflow-auto max-h-[calc(100vh-280px)]">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-xs sticky top-0">
                      <tr>
                        {['상품명', '바코드', '시스템 재고', '실사 재고', '차이'].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {items.map(item => {
                        const diff = item.actual_quantity !== null ? item.difference : null
                        const isDone = selectedSession.status === 'done'
                        return (
                          <tr key={item.id} className={`hover:bg-gray-50 ${diff !== null && diff !== 0 ? 'bg-orange-50' : ''}`}>
                            <td className="px-4 py-2.5 font-medium text-gray-800">{item.product_name ?? '-'}</td>
                            <td className="px-4 py-2.5 font-mono text-xs text-gray-400">{item.barcode ?? '-'}</td>
                            <td className="px-4 py-2.5 text-gray-600">{item.system_quantity}</td>
                            <td className="px-4 py-2.5">
                              {isDone ? (
                                <span>{item.actual_quantity ?? '-'}</span>
                              ) : (
                                <input
                                  ref={el => { inputRef.current[item.id] = el }}
                                  type="number"
                                  min="0"
                                  value={editQty[item.id] ?? ''}
                                  onChange={e => setEditQty(p => ({ ...p, [item.id]: e.target.value }))}
                                  onBlur={() => saveQty(item)}
                                  onKeyDown={e => { if (e.key === 'Enter') saveQty(item) }}
                                  placeholder="입력"
                                  className="w-20 border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              )}
                            </td>
                            <td className="px-4 py-2.5">
                              {diff === null ? (
                                <span className="text-gray-300">-</span>
                              ) : diff === 0 ? (
                                <span className="text-green-600 text-xs">일치</span>
                              ) : (
                                <span className={`font-bold text-xs ${diff > 0 ? 'text-blue-600' : 'text-red-500'}`}>
                                  {diff > 0 ? '+' : ''}{diff}
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <div className="py-20 text-center text-sm text-gray-400">왼쪽에서 실사 세션을 선택하세요</div>
          )}
        </div>
      </div>

      {/* 새 세션 모달 */}
      <Modal open={newModal} onClose={() => setNewModal(false)} title="실사 세션 생성" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">사업자 *</label>
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={newForm.business_id}
              onChange={e => setNewForm(f => ({ ...f, business_id: e.target.value, warehouse_id: '' }))}>
              <option value="">선택</option>
              {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">창고 *</label>
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={newForm.warehouse_id}
              onChange={e => setNewForm(f => ({ ...f, warehouse_id: e.target.value }))}>
              <option value="">선택</option>
              {filteredWarehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">세션 이름 *</label>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={`${new Date().toLocaleDateString('ko-KR')} 재고 실사`}
              value={newForm.name}
              onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => setNewModal(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">취소</button>
            <button onClick={handleCreate} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">생성</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmApply}
        message={`입력된 ${countedCount}개 품목의 재고를 조정하시겠습니까? 차이가 있는 ${diffItems.length}건이 즉시 반영됩니다.`}
        onConfirm={handleApply}
        onCancel={() => setConfirmApply(false)}
      />
    </div>
  )
}
