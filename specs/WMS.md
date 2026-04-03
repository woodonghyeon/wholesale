# WMS (Warehouse Management System) — 상세 스펙

> 세분화된 재고 관리, 배송 최적화

---

## 1. 개요

기존 재고 관리(product × business × warehouse)를 로케이션 단위까지
세분화하여 피킹·패킹·출고 프로세스를 지원한다.

---

## 2. DB 스키마 확장

### 로케이션
```sql
CREATE TABLE warehouse_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
  zone TEXT NOT NULL,               -- A, B, C...
  aisle TEXT NOT NULL,              -- 01, 02...
  rack TEXT NOT NULL,               -- 01, 02...
  shelf TEXT NOT NULL,              -- 1, 2, 3...
  location_code TEXT GENERATED ALWAYS AS (zone || '-' || aisle || '-' || rack || '-' || shelf) STORED,
  location_type TEXT DEFAULT 'storage' CHECK (location_type IN ('storage', 'picking', 'packing', 'staging', 'returns')),
  max_capacity INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(warehouse_id, zone, aisle, rack, shelf)
);

CREATE INDEX idx_locations_warehouse ON warehouse_locations(warehouse_id);
```

### 로케이션별 재고
```sql
CREATE TABLE location_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES warehouse_locations(id),
  product_id UUID REFERENCES products(id),
  quantity INTEGER NOT NULL DEFAULT 0,
  lot_number TEXT,
  expiry_date DATE,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(location_id, product_id, lot_number)
);
```

### 작업 지시
```sql
CREATE TABLE work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id),
  warehouse_id UUID REFERENCES warehouses(id),
  order_type TEXT CHECK (order_type IN ('pick', 'pack', 'move', 'receive', 'count')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  priority INTEGER DEFAULT 0,
  ref_type TEXT,                     -- 'channel_order', 'slip', 'stocktake'
  ref_id UUID,
  assigned_to UUID REFERENCES auth.users(id),
  items JSONB NOT NULL,              -- [{ productId, quantity, fromLocation, toLocation }]
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 3. 핵심 프로세스

### 입고 (Receiving)
```
발주서 도착 / 상품 입고
  → 검수: 수량 확인, 품질 체크
  → 로케이션 배정 (자동 추천 or 수동 선택)
  → location_inventory UPDATE
  → stock_logs INSERT (log_type: 'in')
  → inventory UPDATE (기존 집계 재고도 갱신)
```

### 피킹 (Picking)
```
주문 접수 (channel_orders)
  → 피킹 작업 지시 생성 (work_orders)
  → 로케이션별 피킹 리스트 생성
       → 최적 경로 정렬 (zone → aisle → rack → shelf)
  → 피킹 완료 체크
  → location_inventory 차감
  → 패킹 스테이지로 이동
```

### 패킹 (Packing)
```
피킹 완료 상품
  → 합포장 여부 확인
  → 송장 출력
  → 패킹 완료 → 출고 대기
```

---

## 4. 페이지 UI

### 창고 맵 뷰 (`/wms/map`)
- 창고 레이아웃을 그리드로 시각화
- 존·통로·선반별 재고 밀도 히트맵
- 로케이션 클릭 → 해당 위치 상품 목록

### 작업 지시 (`/wms/tasks`)
- 칸반 보드: 대기 | 진행중 | 완료
- 작업 카드: 유형, 상품, 수량, 위치, 담당자
- 드래그&드롭으로 상태 변경

### 입고 처리 (`/wms/receiving`)
- 발주서 기반 입고 처리
- 바코드 스캔으로 빠른 검수
- 로케이션 자동 추천 (잔여 용량 기준)

---

## 5. 우선순위 & 단계

| 단계 | 기능 | 우선순위 |
|------|------|---------|
| 1단계 | 로케이션 마스터 + 로케이션별 재고 | v4 |
| 2단계 | 피킹 리스트 생성 + 작업 지시 | v4 |
| 3단계 | 창고 맵 시각화 | v4 후반 |
| 4단계 | 자동 로케이션 배정, 경로 최적화 | v5 |

> WMS는 v4 단계 기능이므로, v2(채널 통합)·v3(상품·CS) 완료 후 진행.
