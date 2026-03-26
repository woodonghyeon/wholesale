'use client'

import { useState, useRef, useCallback } from 'react'
import {
  exportToExcel,
  EXPORT_OPTIONS,
  ExportOption,
  ExportEntity,
} from '@/lib/excel/export'
import {
  parseExcelFile,
  downloadTemplate,
  SheetPreview,
  TemplateType,
} from '@/lib/excel/import'

const today = new Date().toISOString().slice(0, 10)
const yearStart = today.slice(0, 4) + '-01-01'

// ─── Export 탭 ────────────────────────────────────────────────

function ExportTab() {
  const [options, setOptions] = useState<ExportOption[]>(EXPORT_OPTIONS.map(o => ({ ...o })))
  const [from, setFrom] = useState(yearStart)
  const [to, setTo] = useState(today)
  const [filename, setFilename] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const selected = options.filter(o => o.selected)
  const hasDateFilter = selected.some(o => o.dateFilter)

  function toggle(key: ExportEntity) {
    setOptions(prev => prev.map(o => o.key === key ? { ...o, selected: !o.selected } : o))
    setDone(false)
  }

  function toggleAll(val: boolean) {
    setOptions(prev => prev.map(o => ({ ...o, selected: val })))
    setDone(false)
  }

  async function handleExport() {
    if (selected.length === 0) return
    setLoading(true)
    setDone(false)
    try {
      await exportToExcel({
        entities: selected.map(o => o.key),
        from: hasDateFilter ? from : undefined,
        to: hasDateFilter ? to : undefined,
        filename: filename.trim() ? filename.trim() + '.xlsx' : undefined,
      })
      setDone(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 데이터 선택 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800">내보낼 데이터 선택</h3>
          <div className="flex gap-2">
            <button onClick={() => toggleAll(true)} className="text-xs text-blue-600 hover:underline">전체 선택</button>
            <span className="text-gray-300">|</span>
            <button onClick={() => toggleAll(false)} className="text-xs text-gray-400 hover:underline">전체 해제</button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {options.map(opt => (
            <label key={opt.key}
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                opt.selected
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}>
              <input type="checkbox" checked={opt.selected} onChange={() => toggle(opt.key)}
                className="mt-0.5 accent-blue-600" />
              <div>
                <p className={`text-sm font-medium ${opt.selected ? 'text-blue-700' : 'text-gray-700'}`}>
                  {opt.label}
                  {opt.dateFilter && <span className="ml-1 text-xs text-gray-400">(기간 필터)</span>}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{opt.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* 기간 필터 (기간 필터 지원 항목 선택 시) */}
      {hasDateFilter && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-gray-800 mb-3">기간 설정</h3>
          <p className="text-xs text-gray-400 mb-3">거래전표, 현금출납 등 기간 필터를 지원하는 데이터에 적용됩니다</p>
          <div className="flex items-center gap-3 flex-wrap">
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <span className="text-gray-400">~</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <div className="flex gap-2 ml-auto">
              {[
                { label: '이번 달', from: today.slice(0, 7) + '-01', to: today },
                { label: '올해', from: today.slice(0, 4) + '-01-01', to: today },
                { label: '전체', from: '2020-01-01', to: today },
              ].map(btn => (
                <button key={btn.label}
                  onClick={() => { setFrom(btn.from); setTo(btn.to) }}
                  className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50">
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 파일명 및 다운로드 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-semibold text-gray-800 mb-3">파일 설정</h3>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-gray-500 mb-1">파일명 (선택)</label>
            <div className="flex items-center gap-1">
              <input type="text" value={filename} onChange={e => setFilename(e.target.value)}
                placeholder={`wholesale_export_${today}`}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <span className="text-sm text-gray-400">.xlsx</span>
            </div>
          </div>
          <div className="pt-5">
            <button onClick={handleExport}
              disabled={selected.length === 0 || loading}
              className="px-6 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
              {loading ? (
                <>
                  <span className="animate-spin">⟳</span>
                  처리 중...
                </>
              ) : (
                <>
                  ↓ Excel 다운로드
                </>
              )}
            </button>
          </div>
        </div>
        {selected.length === 0 && (
          <p className="text-xs text-red-500 mt-2">내보낼 데이터를 1개 이상 선택하세요</p>
        )}
        {done && (
          <p className="text-xs text-green-600 mt-2 font-medium">✓ 다운로드가 완료되었습니다</p>
        )}
      </div>

      {/* 선택 요약 */}
      {selected.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm text-blue-700 font-medium mb-1">다운로드 예정 시트 ({selected.length}개)</p>
          <div className="flex flex-wrap gap-2 mt-1">
            {selected.map(o => (
              <span key={o.key} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                {o.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Import 탭 ────────────────────────────────────────────────

const TEMPLATE_OPTIONS: { key: TemplateType; label: string; description: string }[] = [
  { key: 'partners',  label: '거래처 양식',  description: '거래처 일괄 등록용 템플릿' },
  { key: 'products',  label: '상품 양식',    description: '상품 일괄 등록용 템플릿' },
  { key: 'slips',     label: '거래전표 양식', description: '거래 전표 일괄 등록용 템플릿' },
  { key: 'inventory', label: '재고현황 양식', description: '초기 재고 설정용 템플릿' },
]

function ImportTab() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [previews, setPreviews] = useState<SheetPreview[]>([])
  const [selectedSheet, setSelectedSheet] = useState<string>('')
  const [fileName, setFileName] = useState('')
  const [loading, setLoading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const processFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      alert('Excel 파일(.xlsx, .xls)만 업로드 가능합니다')
      return
    }
    setLoading(true)
    try {
      const result = await parseExcelFile(file)
      setPreviews(result)
      setFileName(file.name)
      setSelectedSheet(result[0]?.name ?? '')
    } finally {
      setLoading(false)
    }
  }, [])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  const currentSheet = previews.find(p => p.name === selectedSheet)

  return (
    <div className="space-y-6">
      {/* 템플릿 다운로드 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-semibold text-gray-800 mb-1">양식 템플릿 다운로드</h3>
        <p className="text-xs text-gray-400 mb-4">데이터 가져오기 전에 양식에 맞게 데이터를 입력하세요. 양식 외 컬럼은 무시됩니다.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {TEMPLATE_OPTIONS.map(t => (
            <button key={t.key}
              onClick={() => downloadTemplate(t.key)}
              className="flex flex-col items-start p-3 border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 text-left transition">
              <span className="text-2xl mb-1">📄</span>
              <p className="text-sm font-medium text-gray-700">{t.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{t.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* 파일 업로드 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-semibold text-gray-800 mb-3">Excel 파일 업로드</h3>
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition ${
            dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-300 hover:bg-gray-50'
          }`}>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" />
          {loading ? (
            <p className="text-gray-400">파일 분석 중...</p>
          ) : fileName ? (
            <div>
              <p className="text-2xl mb-2">📊</p>
              <p className="font-medium text-gray-700">{fileName}</p>
              <p className="text-xs text-gray-400 mt-1">클릭하여 다른 파일 선택</p>
            </div>
          ) : (
            <div>
              <p className="text-3xl mb-2">☁</p>
              <p className="text-gray-500">Excel 파일을 드래그하거나 클릭하여 업로드</p>
              <p className="text-xs text-gray-400 mt-1">.xlsx, .xls 파일 지원</p>
            </div>
          )}
        </div>
      </div>

      {/* 미리보기 */}
      {previews.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {/* 시트 탭 */}
          <div className="border-b border-gray-100 flex gap-1 px-4 pt-3 overflow-x-auto">
            {previews.map(p => (
              <button key={p.name}
                onClick={() => setSelectedSheet(p.name)}
                className={`px-3 py-1.5 text-sm rounded-t-lg whitespace-nowrap transition ${
                  selectedSheet === p.name
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}>
                {p.name}
                <span className="ml-1 text-xs opacity-70">({p.totalRows}행)</span>
              </button>
            ))}
          </div>

          {currentSheet && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-500">
                  <span className="font-medium text-gray-800">{currentSheet.totalRows}개</span> 행 감지됨
                  {currentSheet.totalRows > 5 && <span className="text-gray-400"> (아래는 처음 5행 미리보기)</span>}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">컬럼 {currentSheet.headers.length}개</span>
                </div>
              </div>

              {/* 헤더 */}
              <div className="mb-2 flex flex-wrap gap-1">
                {currentSheet.headers.map(h => (
                  <span key={h} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">{h}</span>
                ))}
              </div>

              {/* 미리보기 테이블 */}
              <div className="overflow-x-auto border border-gray-100 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-gray-400 font-normal">#</th>
                      {currentSheet.headers.map(h => (
                        <th key={h} className="px-3 py-2 text-left text-gray-600 font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {currentSheet.rows.map((row, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                        {currentSheet.headers.map(h => (
                          <td key={h} className="px-3 py-2 text-gray-700 whitespace-nowrap">
                            {String(row[h] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 안내 */}
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-700 font-medium mb-1">⚠ 가져오기 전 확인사항</p>
                <ul className="text-xs text-amber-600 space-y-0.5 list-disc list-inside">
                  <li>컬럼명이 양식 템플릿과 일치하는지 확인하세요</li>
                  <li>거래처명, 상품명은 시스템에 등록된 이름과 정확히 일치해야 합니다</li>
                  <li>중복 데이터가 있는 경우 덮어쓸 수 있으니 주의하세요</li>
                  <li>가져오기 기능은 엑셀 양식 확정 후 활성화될 예정입니다</li>
                </ul>
              </div>

              <div className="mt-3 flex justify-end">
                <button
                  disabled
                  className="px-5 py-2 bg-gray-200 text-gray-400 text-sm rounded-lg cursor-not-allowed">
                  가져오기 (양식 확정 후 활성화)
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── 메인 페이지 ─────────────────────────────────────────────

export default function DataMigrationPage() {
  const [tab, setTab] = useState<'export' | 'import'>('export')

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">데이터 관리</h1>
        <p className="text-sm text-gray-500 mt-1">Excel로 데이터를 내보내거나 가져올 수 있습니다</p>
      </div>

      {/* 탭 */}
      <div className="flex gap-2">
        <button onClick={() => setTab('export')}
          className={`px-5 py-2 text-sm font-medium rounded-lg transition ${
            tab === 'export' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}>
          ↓ Excel 내보내기
        </button>
        <button onClick={() => setTab('import')}
          className={`px-5 py-2 text-sm font-medium rounded-lg transition ${
            tab === 'import' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}>
          ↑ Excel 가져오기
        </button>
      </div>

      {tab === 'export' ? <ExportTab /> : <ImportTab />}
    </div>
  )
}
