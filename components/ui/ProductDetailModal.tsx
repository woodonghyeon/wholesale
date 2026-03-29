'use client'

import { useEffect, useState } from 'react'
import Modal from './Modal'
import { formatMoney } from '@/lib/utils/format'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

type Tab = 'info' | 'sales' | 'stock'

interface StockRow    { warehouse: string; quantity: number }
interface SaleRow     { date: string; partner: string; warehouse: string; quantity: number; price: number; total: number }
interface PurchaseRow { date: string; partner: string; quantity: number; price: number; total: number }
interface MonthRow    { month: string; label: string; qty: number; revenue: number }
interface PriceRow    { partner: string; price: number }
interface ReturnRow   { date: string; partner: string; quantity: number; reason: string; status: string }

interface ProductDetail {
  product: {
    id: string; name: string; barcode: string | null; category: string | null
    unit: string; buy_price: number; sell_price: number; min_stock: number
    is_bundle: boolean; note: string | null; image_url: string | null
  }
  totalStock: number
  stockByWarehouse: StockRow[]
  recentSales: SaleRow[]
  recentPurchases: PurchaseRow[]
  monthlyTrend: MonthRow[]
  partnerPrices: PriceRow[]
  returns: ReturnRow[]
  margin: number
  summary: { totalSalesQty: number; totalRevenue: number; avgMonthlySales: number }
}

interface Props {
  open: boolean
  productId?: string | null
  productName?: string | null
  onClose: () => void
}

const REASON_LABEL: Record<string, string> = { simple: '단순변심', defect: '불량', wrong_delivery: '오배송', other: '기타' }
const STATUS_COLOR: Record<string, string> = { received: 'bg-gray-100 text-gray-600', inspecting: 'bg-blue-100 text-blue-700', done: 'bg-green-100 text-green-700' }
const STATUS_LABEL: Record<string, string> = { received: '접수', inspecting: '검수중', done: '처리완료' }

export default function ProductDetailModal({ open, productId, productName, onClose }: Props) {
  const [data, setData]       = useState<ProductDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [tab, setTab]         = useState<Tab>('info')

  useEffect(() => {
    if (!open) { setData(null); setError(null); setTab('info'); return }
    if (!productId && !productName) return

    setLoading(true)
    const params = productId
      ? `id=${encodeURIComponent(productId)}`
      : `name=${encodeURIComponent(productName!)}`

    fetch(`/api/products/detail?${params}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d) })
      .catch(() => setError('불러오기 실패'))
      .finally(() => setLoading(false))
  }, [open, productId, productName])

  const p = data?.product
  const maxRevenue = Math.max(...(data?.monthlyTrend.map(m => m.revenue) ?? [1]))

  return (
    <Modal open={open} onClose={onClose} title="상품 상세" size="xl">
      {loading && <div className="py-20 text-center text-sm text-gray-400">불러오는 중...</div>}
      {error   && <div className="py-10 text-center text-sm text-red-400">{error}</div>}
      {p && data && (
        <div className="space-y-4">

          {/* ── 헤더 ──────────────────────────────────────── */}
          <div className="flex gap-4">
            {p.image_url ? (
              <img src={p.image_url} alt={p.name}
                className="w-20 h-20 object-contain rounded-xl border border-gray-100 bg-gray-50 shrink-0" />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-200 text-3xl shrink-0">□</div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h3 className="text-base font-bold text-gray-900 leading-snug">{p.name}</h3>
                {p.is_bundle && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">묶음</span>}
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {p.category && <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{p.category}</span>}
                {p.barcode  && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-mono">{p.barcode}</span>}
                {p.min_stock > 0 && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${data.totalStock <= p.min_stock ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                    {data.totalStock <= p.min_stock ? '⚠ 재고부족' : '✓ 재고정상'}
                  </span>
                )}
              </div>
              {p.note && <p className="text-xs text-gray-400 mt-1">{p.note}</p>}
            </div>
          </div>

          {/* ── 핵심 지표 카드 ────────────────────────────── */}
          <div className="grid grid-cols-5 gap-2">
            {[
              { label: '매입가',     value: `${formatMoney(p.buy_price)}원`,               bg: 'bg-gray-50',    text: 'text-gray-700' },
              { label: '판매가',     value: `${formatMoney(p.sell_price)}원`,              bg: 'bg-blue-50',    text: 'text-blue-600' },
              { label: '이익률',     value: `${data.margin}%`,                            bg: data.margin >= 30 ? 'bg-green-50' : data.margin >= 15 ? 'bg-yellow-50' : 'bg-red-50', text: data.margin >= 30 ? 'text-green-600' : data.margin >= 15 ? 'text-yellow-600' : 'text-red-500' },
              { label: '현재 재고',  value: `${data.totalStock}${p.unit}`,                bg: data.totalStock <= p.min_stock && p.min_stock > 0 ? 'bg-red-50' : 'bg-gray-50', text: data.totalStock <= p.min_stock && p.min_stock > 0 ? 'text-red-500' : 'text-gray-700' },
              { label: '월평균 판매', value: `${data.summary.avgMonthlySales}${p.unit}`,  bg: 'bg-indigo-50',  text: 'text-indigo-600' },
            ].map(c => (
              <div key={c.label} className={`${c.bg} rounded-xl p-3 text-center`}>
                <p className="text-xs text-gray-400 mb-0.5">{c.label}</p>
                <p className={`text-sm font-bold ${c.text}`}>{c.value}</p>
              </div>
            ))}
          </div>

          {/* ── 탭 ───────────────────────────────────────── */}
          <div className="flex border-b border-gray-100 gap-1">
            {([['info', '기본 정보'], ['sales', '판매·매입 이력'], ['stock', '재고 현황']] as [Tab, string][]).map(([t, label]) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${tab === t ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                {label}
              </button>
            ))}
          </div>

          {/* ── 탭 1: 기본 정보 ──────────────────────────── */}
          {tab === 'info' && (
            <div className="space-y-4">
              {/* 거래처별 단가 */}
              {data.partnerPrices.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">거래처별 단가</p>
                  <div className="bg-gray-50 rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-100 text-gray-500">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">거래처</th>
                          <th className="px-3 py-2 text-right font-medium">단가</th>
                          <th className="px-3 py-2 text-right font-medium">표준가 대비</th>
                          <th className="px-3 py-2 text-right font-medium">이익률</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {data.partnerPrices.map((pr, i) => {
                          const diff = pr.price - p.sell_price
                          const margin = p.sell_price > 0 ? Math.round(((pr.price - p.buy_price) / pr.price) * 100) : 0
                          return (
                            <tr key={i} className="bg-white">
                              <td className="px-3 py-2 font-medium">{pr.partner}</td>
                              <td className="px-3 py-2 text-right font-medium text-blue-600">{formatMoney(pr.price)}원</td>
                              <td className={`px-3 py-2 text-right ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                                {diff === 0 ? '표준' : `${diff > 0 ? '+' : ''}${formatMoney(diff)}원`}
                              </td>
                              <td className={`px-3 py-2 text-right font-medium ${margin >= 30 ? 'text-green-600' : margin >= 15 ? 'text-yellow-600' : 'text-red-500'}`}>
                                {margin}%
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 반품 이력 */}
              {data.returns.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">최근 반품 이력</p>
                  <div className="bg-gray-50 rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-100 text-gray-500">
                        <tr>
                          {['날짜','거래처','수량','사유','상태'].map(h => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {data.returns.map((r, i) => (
                          <tr key={i} className="bg-white">
                            <td className="px-3 py-2 text-gray-500 font-mono">{r.date}</td>
                            <td className="px-3 py-2">{r.partner}</td>
                            <td className="px-3 py-2">{r.quantity}{p.unit}</td>
                            <td className="px-3 py-2 text-gray-500">{REASON_LABEL[r.reason] ?? r.reason}</td>
                            <td className="px-3 py-2">
                              <span className={`px-1.5 py-0.5 rounded-full text-xs ${STATUS_COLOR[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
                                {STATUS_LABEL[r.status] ?? r.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {data.partnerPrices.length === 0 && data.returns.length === 0 && (
                <p className="text-xs text-gray-300 text-center py-4">추가 정보가 없습니다</p>
              )}
            </div>
          )}

          {/* ── 탭 2: 판매·매입 이력 ─────────────────────── */}
          {tab === 'sales' && (
            <div className="space-y-4">
              {/* 월별 매출 차트 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500">월별 판매 추이 (최근 6개월)</p>
                  <p className="text-xs text-gray-400">6개월 합계: {formatMoney(data.summary.totalRevenue)}원 / {data.summary.totalSalesQty}{p.unit}</p>
                </div>
                <div className="h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.monthlyTrend} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip
                        formatter={(v: unknown) => [`${formatMoney(Number(v))}원`, '매출']}
                        labelFormatter={(l: unknown) => String(l)}
                        contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }}
                      />
                      <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                        {data.monthlyTrend.map((entry, i) => (
                          <Cell key={i} fill={entry.revenue === maxRevenue ? '#3b82f6' : '#bfdbfe'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {/* 월별 수량 요약 */}
                <div className="flex gap-1 mt-1">
                  {data.monthlyTrend.map((m, i) => (
                    <div key={i} className="flex-1 text-center">
                      <p className="text-xs text-gray-400">{m.qty > 0 ? m.qty : '-'}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 최근 판매 */}
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">최근 판매 내역</p>
                {data.recentSales.length === 0 ? (
                  <p className="text-xs text-gray-300 text-center py-4">판매 내역이 없습니다</p>
                ) : (
                  <div className="bg-gray-50 rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-100 text-gray-500">
                        <tr>{['날짜','거래처','창고','수량','단가','합계'].map(h => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}</tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {data.recentSales.map((s, i) => (
                          <tr key={i} className="bg-white">
                            <td className="px-3 py-2 text-gray-500 font-mono">{s.date}</td>
                            <td className="px-3 py-2 font-medium">{s.partner}</td>
                            <td className="px-3 py-2 text-gray-500">{s.warehouse}</td>
                            <td className="px-3 py-2">{s.quantity}{p.unit}</td>
                            <td className="px-3 py-2 text-gray-600">{formatMoney(s.price)}원</td>
                            <td className="px-3 py-2 font-medium text-blue-600">{formatMoney(s.total)}원</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* 최근 매입 */}
              {data.recentPurchases.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">최근 매입 내역</p>
                  <div className="bg-gray-50 rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-100 text-gray-500">
                        <tr>{['날짜','거래처','수량','매입가','합계'].map(h => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}</tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {data.recentPurchases.map((s, i) => (
                          <tr key={i} className="bg-white">
                            <td className="px-3 py-2 text-gray-500 font-mono">{s.date}</td>
                            <td className="px-3 py-2 font-medium">{s.partner}</td>
                            <td className="px-3 py-2">{s.quantity}{p.unit}</td>
                            <td className="px-3 py-2 text-gray-600">{formatMoney(s.price)}원</td>
                            <td className="px-3 py-2 font-medium text-orange-600">{formatMoney(s.total)}원</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── 탭 3: 재고 현황 ──────────────────────────── */}
          {tab === 'stock' && (
            <div className="space-y-4">
              {/* 재고 요약 */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <p className="text-xs text-gray-400 mb-1">총 재고</p>
                  <p className="text-2xl font-bold text-gray-800">{data.totalStock}</p>
                  <p className="text-xs text-gray-400">{p.unit}</p>
                </div>
                <div className={`rounded-xl p-4 text-center ${p.min_stock > 0 ? (data.totalStock <= p.min_stock ? 'bg-red-50' : 'bg-green-50') : 'bg-gray-50'}`}>
                  <p className="text-xs text-gray-400 mb-1">안전재고</p>
                  <p className={`text-2xl font-bold ${p.min_stock > 0 ? (data.totalStock <= p.min_stock ? 'text-red-600' : 'text-green-600') : 'text-gray-300'}`}>
                    {p.min_stock > 0 ? p.min_stock : '미설정'}
                  </p>
                  {p.min_stock > 0 && <p className="text-xs text-gray-400">{p.unit}</p>}
                </div>
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <p className="text-xs text-gray-400 mb-1">재고 가치</p>
                  <p className="text-lg font-bold text-gray-700">{formatMoney(data.totalStock * p.buy_price)}</p>
                  <p className="text-xs text-gray-400">원 (매입가 기준)</p>
                </div>
              </div>

              {/* 창고별 재고 */}
              {data.stockByWarehouse.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">창고별 재고</p>
                  <div className="space-y-2">
                    {data.stockByWarehouse.map((w, i) => {
                      const pct = data.totalStock > 0 ? Math.round((w.quantity / data.totalStock) * 100) : 0
                      return (
                        <div key={i} className="bg-gray-50 rounded-lg p-3">
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="text-sm font-medium text-gray-700">{w.warehouse}</span>
                            <span className="text-sm font-bold text-gray-800">{w.quantity}{p.unit} <span className="text-xs text-gray-400 font-normal">({pct}%)</span></span>
                          </div>
                          <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-400 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-sm text-gray-300">재고 없음</div>
              )}

              {/* 재고 부족 경고 */}
              {p.min_stock > 0 && data.totalStock <= p.min_stock && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-start gap-2">
                  <span className="text-red-500 text-lg shrink-0">⚠</span>
                  <div>
                    <p className="text-sm font-medium text-red-700">재고 부족 상태입니다</p>
                    <p className="text-xs text-red-500 mt-0.5">
                      현재 {data.totalStock}{p.unit} / 안전재고 {p.min_stock}{p.unit}
                      {data.summary.avgMonthlySales > 0 && ` · 예상 소진: 약 ${Math.floor(data.totalStock / (data.summary.avgMonthlySales / 30))}일`}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
