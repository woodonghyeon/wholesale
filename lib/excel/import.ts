import * as XLSX from 'xlsx'

export interface SheetPreview {
  name: string
  headers: string[]
  rows: Record<string, unknown>[]  // 최대 5행 미리보기
  totalRows: number
}

/** xlsx 파일을 파싱해서 시트별 미리보기 반환 */
export function parseExcelFile(file: File): Promise<SheetPreview[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const wb = XLSX.read(data, { type: 'array' })
        const previews: SheetPreview[] = wb.SheetNames.map(name => {
          const ws = wb.Sheets[name]
          const all: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: '' })
          const headers = all.length > 0 ? Object.keys(all[0]) : []
          return {
            name,
            headers,
            rows: all.slice(0, 5),
            totalRows: all.length,
          }
        })
        resolve(previews)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

/** xlsx 파일의 특정 시트 전체 데이터를 반환 */
export function readSheetData(file: File, sheetName: string): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[sheetName]
        if (!ws) { resolve([]); return }
        const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: '' })
        resolve(rows)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

// ─── 템플릿 다운로드 ────────────────────────────────────────
export type TemplateType = 'partners' | 'products' | 'slips' | 'inventory'

const TEMPLATES: Record<TemplateType, { sheetName: string; headers: string[]; sample: Record<string, unknown>[] }> = {
  partners: {
    sheetName: '거래처',
    headers: ['이름', '유형', '대표자', '사업자번호', '전화', '이메일', '주소', '비고'],
    sample: [
      { 이름: '(주)샘플거래처', 유형: '판매', 대표자: '홍길동', 사업자번호: '123-45-67890', 전화: '02-1234-5678', 이메일: 'sample@example.com', 주소: '서울시 강남구', 비고: '' },
    ],
  },
  products: {
    sheetName: '상품',
    headers: ['이름', '바코드', '분류', '단위', '표준단가', '매입단가', '안전재고', '묶음수량', '비고'],
    sample: [
      { 이름: '샘플상품A', 바코드: '8801234567890', 분류: '문구', 단위: '개', 표준단가: 1000, 매입단가: 700, 안전재고: 10, 묶음수량: 1, 비고: '' },
    ],
  },
  slips: {
    sheetName: '거래전표',
    headers: ['일자', '구분', '거래처명', '결제방식', '공급가', '세액', '합계', '세금계산서', '비고'],
    sample: [
      { 일자: '2026-03-01', 구분: '매출', 거래처명: '(주)샘플', 결제방식: 'credit', 공급가: 100000, 세액: 10000, 합계: 110000, 세금계산서: 'N', 비고: '' },
    ],
  },
  inventory: {
    sheetName: '재고현황',
    headers: ['상품명', '바코드', '창고명', '재고수량'],
    sample: [
      { 상품명: '샘플상품A', 바코드: '8801234567890', 창고명: '본창고', 재고수량: 100 },
    ],
  },
}

export function downloadTemplate(type: TemplateType): void {
  const tmpl = TEMPLATES[type]
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(tmpl.sample, { header: tmpl.headers })

  // 열 너비
  ws['!cols'] = tmpl.headers.map(() => ({ wch: 18 }))

  XLSX.utils.book_append_sheet(wb, ws, tmpl.sheetName)
  XLSX.writeFile(wb, `template_${type}.xlsx`)
}
