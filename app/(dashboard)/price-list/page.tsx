'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getPartnerPrices, upsertPartnerPrice, deletePartnerPrice, PartnerPrice } from '@/lib/supabase/price-list'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

type Partner = { id: string; name: string; partner_type: string }
type Product = { id: string; name: string; sale_price: number | null }
type Channel = { id: string; name: string }

const thCls = 'px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200'
const tdCls = 'px-3 py-2 text-sm border-b border-gray-100'

export default function PriceListPage() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [rows, setRows] = useState<PartnerPrice[]>([])
  const [loading, setLoading] = useState(false)

  // 필터
  const [filterPartner, setFilterPartner] = useState('')
  const [filterProduct, setFilterProduct] = useState('')
  const [filterChannel, setFilterChannel] = useState('')

  // 모달
  const [modalOpen, setModalOpen] = useState(false)
  const [editRow, setEditRow] = useState<PartnerPrice | null>(null)
  const [form, setForm] = useState({
    partner_id: '',
    product_id: '',
    channel_id: '',
    unit_price: '',
    note: '',
  })
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => {
    const sb = createClient()
    Promise.all([
      sb.from('partners').select('id, name, partner_type').order('name'),
      sb.from('products').select('id, name, sale_price').order('name'),
      sb.from('channels').select('id, name').order('name'),
    ]).then(([p, pr, c]) => {
      setPartners(p.data ?? [])
      setProducts(pr.data ?? [])
      setChannels(c.data ?? [])
    })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getPartnerPrices({
        partnerId: filterPartner || undefined,
        productId: filterProduct || undefined,
        channelId: filterChannel || undefined,
      })
      setRows(data)
    } finally {
      setLoading(false)
    }
  }, [filterPartner, filterProduct, filterChannel])

  useEffect(() => { load() }, [load])

  function openNew() {
    setEditRow(null)
    setForm({ partner_id: '', product_id: '', channel_id: '', unit_price: '', note: '' })
    setModalOpen(true)
  }
  function openEdit(r: PartnerPrice) {
    setEditRow(r)
    setForm({
      partner_id: r.partner_id,
      product_id: r.product_id,
      channel_id: r.channel_id ?? '',
      unit_price: String(r.unit_price),
      note: r.note ?? '',
    })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.partner_id || !form.product_id || !form.unit_price) return
    await upsertPartnerPrice({
      id: editRow?.id,
      partner_id: form.partner_id,
      product_id: form.product_id,
      channel_id: form.channel_id || null,
      unit_price: Number(form.unit_price),
      note: form.note || null,
    })
    setModalOpen(false)
    load()
  }

  async function handleDelete() {
    if (!deleteId) return
    await deletePartnerPrice(deleteId)
    setDeleteId(null)
    load()
  }

  // 표준 단가 대비 차이 계산
  function priceDiff(r: PartnerPrice) {
    const prod = products.find(p => p.id === r.product_id)
    if (!prod?.sale_price) return null
    const diff = r.unit_price - prod.sale_price
    const pct = ((diff / prod.sale_price) * 100).toFixed(1)
    return { diff, pct, base: prod.sale_price }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">다단가 관리</h1>
          <p className="text-sm text-gray-500 mt-1">거래처·채널별 개별 단가 설정 (표준 단가 대비 자동 비교)</p>
        </div>
        <button onClick={openNew}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
          + 단가 등록
        </button>
      </div>

      {/* 필터 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">거래처</label>
          <select value={filterPartner} onChange={e => setFilterPartner(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[160px]">
            <option value="">전체</option>
            {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">상품</label>
          <select value={filterProduct} onChange={e => setFilterProduct(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[160px]">
            <option value="">전체</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">채널</label>
          <select value={filterChannel} onChange={e => setFilterChannel(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[140px]">
            <option value="">전체</option>
            {channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="font-semibold text-gray-800">단가 목록</span>
          <span className="text-sm text-gray-500">{rows.length}건</span>
        </div>
        {loading ? (
          <div className="p-12 text-center text-gray-400">로딩 중...</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p className="text-3xl mb-2">💰</p>
            <p>등록된 단가가 없습니다</p>
            <p className="text-xs mt-1">거래처·채널별 개별 단가를 등록하면 거래 입력 시 자동 적용됩니다</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {['거래처', '상품', '채널', '적용 단가', '표준 단가', '차이', '비고', ''].map(h => (
                    <th key={h} className={thCls}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const diff = priceDiff(r)
                  return (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className={tdCls + ' font-medium'}>{r.partner_name ?? '-'}</td>
                      <td className={tdCls}>{r.product_name ?? '-'}</td>
                      <td className={tdCls + ' text-gray-400'}>{r.channel_name ?? '전체'}</td>
                      <td className={tdCls + ' text-right font-semibold text-blue-700'}>{r.unit_price.toLocaleString()}원</td>
                      <td className={tdCls + ' text-right text-gray-400'}>
                        {diff ? diff.base.toLocaleString() + '원' : '-'}
                      </td>
                      <td className={tdCls + ' text-right text-xs'}>
                        {diff ? (
                          <span className={diff.diff > 0 ? 'text-red-500' : diff.diff < 0 ? 'text-green-600' : 'text-gray-400'}>
                            {diff.diff > 0 ? '+' : ''}{diff.diff.toLocaleString()}원 ({diff.pct}%)
                          </span>
                        ) : '-'}
                      </td>
                      <td className={tdCls + ' text-gray-400 text-xs'}>{r.note ?? ''}</td>
                      <td className={tdCls}>
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(r)}
                            className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded">수정</button>
                          <button onClick={() => setDeleteId(r.id)}
                            className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded">삭제</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 등록/수정 모달 */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editRow ? '단가 수정' : '단가 등록'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">거래처 *</label>
            <select value={form.partner_id} onChange={e => setForm(f => ({ ...f, partner_id: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">선택</option>
              {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">상품 *</label>
            <select value={form.product_id} onChange={e => {
              const prod = products.find(p => p.id === e.target.value)
              setForm(f => ({ ...f, product_id: e.target.value, unit_price: prod?.sale_price ? String(prod.sale_price) : f.unit_price }))
            }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">선택</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.sale_price ? ` (표준: ${p.sale_price.toLocaleString()}원)` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">채널 (선택)</label>
            <select value={form.channel_id} onChange={e => setForm(f => ({ ...f, channel_id: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">전체 채널 (채널 무관)</option>
              {channels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <p className="text-xs text-gray-400 mt-1">채널 지정 시 해당 채널로 거래 입력 시 우선 적용됩니다</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">적용 단가 (원) *</label>
            <input type="number" value={form.unit_price} onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))}
              placeholder="0" min={0}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">비고</label>
            <input type="text" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              placeholder="계약 조건, 기간 등"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">취소</button>
            <button onClick={handleSave}
              disabled={!form.partner_id || !form.product_id || !form.unit_price}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              저장
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        message="이 단가를 삭제하시겠습니까?"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
