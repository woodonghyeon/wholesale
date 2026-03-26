import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/client'

export type ExportEntity =
  | 'partners'
  | 'products'
  | 'inventory'
  | 'slips'
  | 'slip_items'
  | 'cash'
  | 'notes'
  | 'payments'
  | 'stock_logs'

export interface ExportOption {
  key: ExportEntity
  label: string
  description: string
  selected: boolean
  dateFilter?: boolean  // 기간 필터 지원 여부
}

export const EXPORT_OPTIONS: ExportOption[] = [
  { key: 'partners',    label: '거래처',      description: '거래처 기본정보 (이름, 유형, 연락처 등)',       selected: true,  dateFilter: false },
  { key: 'products',    label: '상품',        description: '상품 목록 (이름, 바코드, 단가, 분류 등)',       selected: true,  dateFilter: false },
  { key: 'inventory',   label: '재고 현황',   description: '현재 재고 수량 (상품×창고)',                    selected: true,  dateFilter: false },
  { key: 'slips',       label: '거래 전표',   description: '매출/매입 전표 헤더 (일자, 거래처, 금액 등)',   selected: false, dateFilter: true  },
  { key: 'slip_items',  label: '거래 명세',   description: '전표 품목 상세 (상품, 수량, 단가 등)',          selected: false, dateFilter: true  },
  { key: 'cash',        label: '현금 출납',   description: '입출금 이력 및 잔액',                           selected: false, dateFilter: true  },
  { key: 'notes',       label: '어음·수표',   description: '어음/수표 관리 목록',                           selected: false, dateFilter: true  },
  { key: 'payments',    label: '수금·지급',   description: '미수금·미지급 수금/지급 내역',                  selected: false, dateFilter: true  },
  { key: 'stock_logs',  label: '수불 이력',   description: '재고 입출고·조정 이력',                         selected: false, dateFilter: true  },
]

// ─── 각 엔티티 데이터 fetch ────────────────────────────────

async function fetchPartners() {
  const sb = createClient()
  const { data } = await sb.from('partners').select('*').order('name')
  return (data ?? []).map((r: any) => ({
    이름: r.name,
    유형: r.partner_type === 'supplier' ? '공급' : r.partner_type === 'customer' ? '판매' : '겸용',
    대표자: r.ceo_name ?? '',
    사업자번호: r.business_no ?? '',
    전화: r.phone ?? '',
    팩스: r.fax ?? '',
    이메일: r.email ?? '',
    주소: r.address ?? '',
    비고: r.memo ?? '',
    등록일: r.created_at?.slice(0, 10) ?? '',
  }))
}

async function fetchProducts() {
  const sb = createClient()
  const { data } = await sb.from('products').select('*').order('name')
  return (data ?? []).map((r: any) => ({
    이름: r.name,
    바코드: r.barcode ?? '',
    분류: r.category ?? '',
    단위: r.unit ?? '',
    표준단가: r.sale_price ?? '',
    매입단가: r.purchase_price ?? '',
    안전재고: r.safety_stock ?? '',
    묶음수량: r.bundle_qty ?? 1,
    비고: r.memo ?? '',
    등록일: r.created_at?.slice(0, 10) ?? '',
  }))
}

async function fetchInventory() {
  const sb = createClient()
  const { data } = await sb
    .from('inventory')
    .select('*, products(name, barcode), warehouses(name), businesses(name)')
  return (data ?? []).map((r: any) => ({
    상품명: r.products?.name ?? '',
    바코드: r.products?.barcode ?? '',
    창고: r.warehouses?.name ?? '',
    사업자: r.businesses?.name ?? '',
    재고수량: r.quantity,
    최종수정일: r.updated_at?.slice(0, 10) ?? '',
  }))
}

async function fetchSlips(from?: string, to?: string) {
  const sb = createClient()
  let q = sb
    .from('slips')
    .select('*, partners(name), warehouses(name), channels(name)')
    .order('slip_date', { ascending: false })
  if (from) q = q.gte('slip_date', from)
  if (to) q = q.lte('slip_date', to)
  const { data } = await q
  return (data ?? []).map((r: any) => ({
    전표번호: r.slip_no ?? '',
    일자: r.slip_date,
    구분: r.slip_type === 'sale' ? '매출' : '매입',
    거래처: r.partners?.name ?? '',
    창고: r.warehouses?.name ?? '',
    채널: r.channels?.name ?? '',
    결제방식: r.payment_type,
    공급가: r.supply_amount,
    세액: r.tax_amount,
    합계: r.total_amount,
    세금계산서: r.is_tax_invoice ? 'Y' : 'N',
    비고: r.memo ?? '',
    등록일: r.created_at?.slice(0, 10) ?? '',
  }))
}

async function fetchSlipItems(from?: string, to?: string) {
  const sb = createClient()
  let q = sb
    .from('slip_items')
    .select('*, products(name, barcode), slips!inner(slip_no, slip_date, slip_type, partners(name))')
    .order('slips.slip_date', { ascending: false })
  if (from) q = q.gte('slips.slip_date', from)
  if (to) q = q.lte('slips.slip_date', to)
  const { data } = await q
  return (data ?? []).map((r: any) => ({
    전표번호: r.slips?.slip_no ?? '',
    일자: r.slips?.slip_date ?? '',
    구분: r.slips?.slip_type === 'sale' ? '매출' : '매입',
    거래처: r.slips?.partners?.name ?? '',
    상품명: r.products?.name ?? '',
    바코드: r.products?.barcode ?? '',
    수량: r.quantity,
    단가: r.unit_price,
    공급가: r.supply_amount,
    비고: r.memo ?? '',
  }))
}

async function fetchCash(from?: string, to?: string) {
  const sb = createClient()
  let q = sb.from('cash_books').select('*, businesses(name)').order('entry_date', { ascending: false })
  if (from) q = q.gte('entry_date', from)
  if (to) q = q.lte('entry_date', to)
  const { data } = await q
  return (data ?? []).map((r: any) => ({
    일자: r.entry_date,
    사업자: r.businesses?.name ?? '',
    구분: r.entry_type === 'in' ? '입금' : '출금',
    금액: r.amount,
    적요: r.description ?? '',
    비고: r.memo ?? '',
  }))
}

async function fetchNotes(from?: string, to?: string) {
  const sb = createClient()
  let q = sb.from('payment_notes').select('*, partners(name)').order('issue_date', { ascending: false })
  if (from) q = q.gte('issue_date', from)
  if (to) q = q.lte('issue_date', to)
  const { data } = await q
  return (data ?? []).map((r: any) => ({
    구분: r.note_type,
    방향: r.direction === 'receive' ? '수취' : '발행',
    거래처: r.partners?.name ?? '',
    어음번호: r.note_no ?? '',
    발행일: r.issue_date,
    만기일: r.due_date,
    금액: r.amount,
    상태: r.status,
    비고: r.memo ?? '',
  }))
}

async function fetchPayments(from?: string, to?: string) {
  const sb = createClient()
  let q = sb.from('payments').select('*, partners(name)').order('payment_date', { ascending: false })
  if (from) q = q.gte('payment_date', from)
  if (to) q = q.lte('payment_date', to)
  const { data } = await q
  return (data ?? []).map((r: any) => ({
    일자: r.payment_date,
    거래처: r.partners?.name ?? '',
    방향: r.direction === 'receive' ? '수금' : '지급',
    금액: r.amount,
    방법: r.method ?? '',
    비고: r.memo ?? '',
  }))
}

async function fetchStockLogs(from?: string, to?: string) {
  const sb = createClient()
  let q = sb
    .from('stock_logs')
    .select('*, products(name), warehouses(name)')
    .order('created_at', { ascending: false })
    .limit(5000)
  if (from) q = q.gte('created_at', from + 'T00:00:00')
  if (to) q = q.lte('created_at', to + 'T23:59:59')
  const { data } = await q
  return (data ?? []).map((r: any) => ({
    일시: r.created_at?.slice(0, 19).replace('T', ' ') ?? '',
    상품명: r.products?.name ?? '',
    창고: r.warehouses?.name ?? '',
    유형: r.log_type,
    수량: r.quantity,
    비고: r.note ?? '',
  }))
}

// ─── 메인 export 함수 ────────────────────────────────────────

export interface ExportConfig {
  entities: ExportEntity[]
  from?: string
  to?: string
  filename?: string
}

export async function exportToExcel(config: ExportConfig): Promise<void> {
  const wb = XLSX.utils.book_new()

  const fetchers: Record<ExportEntity, () => Promise<Record<string, unknown>[]>> = {
    partners:   () => fetchPartners(),
    products:   () => fetchProducts(),
    inventory:  () => fetchInventory(),
    slips:      () => fetchSlips(config.from, config.to),
    slip_items: () => fetchSlipItems(config.from, config.to),
    cash:       () => fetchCash(config.from, config.to),
    notes:      () => fetchNotes(config.from, config.to),
    payments:   () => fetchPayments(config.from, config.to),
    stock_logs: () => fetchStockLogs(config.from, config.to),
  }

  const sheetNames: Record<ExportEntity, string> = {
    partners:   '거래처',
    products:   '상품',
    inventory:  '재고현황',
    slips:      '거래전표',
    slip_items: '거래명세',
    cash:       '현금출납',
    notes:      '어음수표',
    payments:   '수금지급',
    stock_logs: '수불이력',
  }

  for (const entity of config.entities) {
    const rows = await fetchers[entity]()
    const ws = XLSX.utils.json_to_sheet(rows)

    // 열 너비 자동 설정
    const colWidths = rows.length > 0
      ? Object.keys(rows[0]).map(key => ({
          wch: Math.max(key.length * 2, 10),
        }))
      : []
    ws['!cols'] = colWidths

    XLSX.utils.book_append_sheet(wb, ws, sheetNames[entity])
  }

  const date = new Date().toISOString().slice(0, 10)
  const filename = config.filename ?? `wholesale_export_${date}.xlsx`
  XLSX.writeFile(wb, filename)
}
