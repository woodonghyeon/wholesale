'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  getDailyStockLedger,
  getMonthlyStockLedger,
  calcStockSummary,
  StockLedgerRow,
  MonthlyStockRow,
} from '@/lib/supabase/stock-ledger'

const today = new Date().toISOString().slice(0, 10)
const monthStart = today.slice(0, 7) + '-01'

function fmt(n: number) {
  if (n === 0) return '-'
  return (n > 0 ? '+' : '') + n.toLocaleString()
}
function fmtAbs(n: number) {
  if (n === 0) return '-'
  return n.toLocaleString()
}

export default function StockLedgerPage() {
  const [tab, setTab] = useState<'daily' | 'monthly'>('daily')
  const [products, setProducts] = useState<{ id: string; name: string }[]>([])
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([])
  const [productId, setProductId] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [from, setFrom] = useState(monthStart)
  const [to, setTo] = useState(today)
  const [dailyRows, setDailyRows] = useState<StockLedgerRow[]>([])
  const [monthlyRows, setMonthlyRows] = useState<MonthlyStockRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const sb = createClient()
    sb.from('products').select('id, name').order('name').then(({ data }) => setProducts(data ?? []))
    sb.from('warehouses').select('id, name').order('name').then(({ data }) => setWarehouses(data ?? []))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const filter = {
        productId: productId || undefined,
        warehouseId: warehouseId || undefined,
        from: from || undefined,
        to: to || undefined,
      }
      const [d, m] = await Promise.all([
        getDailyStockLedger(filter),
        getMonthlyStockLedger(filter),
      ])
      setDailyRows(d)
      setMonthlyRows(m)
    } finally {
      setLoading(false)
    }
  }, [productId, warehouseId, from, to])

  useEffect(() => { load() }, [load])

  const summary = calcStockSummary(dailyRows)

  const thCls = 'px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200'
  const tdCls = 'px-3 py-2 text-sm border-b border-gray-100'

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">수불 현황</h1>
        <p className="text-sm text-gray-500 mt-1">상품별 입출고 이력 및 재고 증감 현황</p>
      </div>

      {/* 필터 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">상품</label>
          <select value={productId} onChange={e => setProductId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[180px]">
            <option value="">전체 상품</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">창고</label>
          <select value={warehouseId} onChange={e => setWarehouseId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[150px]">
            <option value="">전체 창고</option>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">기간</label>
          <div className="flex items-center gap-2">
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <span className="text-gray-400">~</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        <button onClick={load}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
          조회
        </button>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: '총 입고', value: summary.total_in, color: 'text-blue-600' },
          { label: '총 반품입고', value: summary.total_return, color: 'text-indigo-600' },
          { label: '총 출고', value: summary.total_out, color: 'text-red-600' },
          { label: '조정 증가', value: summary.total_adjust, color: 'text-orange-600' },
          { label: '순 증감', value: summary.net, color: summary.net >= 0 ? 'text-green-600' : 'text-red-600' },
        ].map(c => (
          <div key={c.label} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">{c.label}</p>
            <p className={`text-xl font-bold ${c.color}`}>{fmtAbs(Math.abs(c.value))}</p>
          </div>
        ))}
      </div>

      {/* 탭 */}
      <div className="flex gap-2">
        {(['daily', 'monthly'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm rounded-lg font-medium transition ${tab === t ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {t === 'daily' ? '일별 수불' : '월별 집계'}
          </button>
        ))}
      </div>

      {/* 테이블 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">로딩 중...</div>
        ) : tab === 'daily' ? (
          dailyRows.length === 0 ? (
            <div className="p-12 text-center text-gray-400">수불 이력이 없습니다</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    {['날짜', '상품명', '창고', '입고', '반품입고', '출고', '조정', '순증감'].map(h => (
                      <th key={h} className={thCls}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dailyRows.map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className={tdCls + ' text-gray-500'}>{r.date}</td>
                      <td className={tdCls + ' font-medium'}>{r.product_name}</td>
                      <td className={tdCls + ' text-gray-500'}>{r.warehouse_name}</td>
                      <td className={tdCls + ' text-blue-600 text-right'}>{fmtAbs(r.in_qty)}</td>
                      <td className={tdCls + ' text-indigo-600 text-right'}>{fmtAbs(r.return_qty)}</td>
                      <td className={tdCls + ' text-red-600 text-right'}>{fmtAbs(r.out_qty)}</td>
                      <td className={tdCls + ' text-orange-600 text-right'}>{fmtAbs(r.adjust_qty)}</td>
                      <td className={`${tdCls} text-right font-semibold ${r.net_qty >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {fmt(r.net_qty)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          monthlyRows.length === 0 ? (
            <div className="p-12 text-center text-gray-400">수불 이력이 없습니다</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    {['월', '상품명', '입고', '반품입고', '출고', '조정', '순증감'].map(h => (
                      <th key={h} className={thCls}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {monthlyRows.map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className={tdCls + ' text-gray-500'}>{r.month}</td>
                      <td className={tdCls + ' font-medium'}>{r.product_name}</td>
                      <td className={tdCls + ' text-blue-600 text-right'}>{fmtAbs(r.in_qty)}</td>
                      <td className={tdCls + ' text-indigo-600 text-right'}>{fmtAbs(r.return_qty)}</td>
                      <td className={tdCls + ' text-red-600 text-right'}>{fmtAbs(r.out_qty)}</td>
                      <td className={tdCls + ' text-orange-600 text-right'}>{fmtAbs(r.adjust_qty)}</td>
                      <td className={`${tdCls} text-right font-semibold ${r.net_qty >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {fmt(r.net_qty)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={2} className={tdCls + ' font-semibold'}>합계</td>
                    <td className={tdCls + ' text-blue-600 text-right font-semibold'}>{fmtAbs(summary.total_in)}</td>
                    <td className={tdCls + ' text-indigo-600 text-right font-semibold'}>{fmtAbs(summary.total_return)}</td>
                    <td className={tdCls + ' text-red-600 text-right font-semibold'}>{fmtAbs(summary.total_out)}</td>
                    <td className={tdCls + ' text-orange-600 text-right font-semibold'}>{fmtAbs(summary.total_adjust)}</td>
                    <td className={`${tdCls} text-right font-bold ${summary.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {fmt(summary.net)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  )
}
