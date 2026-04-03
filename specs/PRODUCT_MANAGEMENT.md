# 상품 관리 — 상세 스펙

> 바코드 리더기 연동, 채널별 상품 게시, 통합 상품 관리

---

## 1. 바코드 리더기 연동 (Cone-3000)

### HID 모드 동작
Cone-3000은 USB HID(키보드 에뮬레이션) 모드로 동작.
스캔 시 바코드 문자열 + Enter 키를 전송한다.

### 구현 방식
```typescript
// components/products/BarcodeScanner.tsx

function BarcodeScanner({ onScan }: { onScan: (barcode: string) => void }) {
  const [buffer, setBuffer] = useState('');
  const lastKeyTime = useRef(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();

      // 바코드 리더기는 빠르게 연속 입력 (50ms 이내)
      // 일반 키보드 타이핑과 구분
      if (now - lastKeyTime.current > 100) {
        setBuffer(''); // 새로운 스캔 시작
      }
      lastKeyTime.current = now;

      if (e.key === 'Enter' && buffer.length >= 8) {
        e.preventDefault();
        onScan(buffer);
        setBuffer('');
      } else if (e.key.length === 1) {
        setBuffer(prev => prev + e.key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [buffer, onScan]);

  return null; // 렌더링 없음 — 글로벌 키 리스너
}
```

### 바코드 → 상품 정보 자동 입력

#### 조회 흐름
```
바코드 스캔
  → 1차: 내부 DB 조회 (products.barcode)
       → 있으면: 기존 상품 정보 반환
  → 2차: 외부 API 조회
       → 바코드넷 API (barcode.gs1kr.org)
       → 또는 네이버 쇼핑 검색 API
       → 조회 결과로 상품 정보 자동 채움
  → 3차: 조회 실패 시 수동 입력 안내
```

#### API Route
```
GET /api/barcode?code=8801234567890

Response:
{
  "found": true,
  "source": "internal" | "gs1" | "naver",
  "product": {
    "barcode": "8801234567890",
    "name": "모나미 볼펜 153 0.7mm",
    "category": "필기구",
    "manufacturer": "모나미",
    "unit": "EA",
    "image_url": "https://...",
    "suggested_price": 500
  }
}
```

### 상품 등록 UI 연동
```
┌───────────────────────────────────────────┐
│  📷 바코드 스캔 대기중...                     │
│  ─────────────────────────────────────── │
│  바코드: [8801234567890        ] [조회]    │
│                                           │
│  ✅ 외부 조회 결과:                         │
│  상품명: [모나미 볼펜 153 0.7mm     ]       │
│  카테고리: [필기구          ▼]              │
│  단위: [EA  ▼]   매입가: [350  ]           │
│  판매가: [500  ]  안전재고: [100 ]          │
│                                           │
│  [등록]  [취소]                              │
└───────────────────────────────────────────┘
```

---

## 2. 채널별 상품 게시

### 상품 채널 매핑 테이블
```sql
CREATE TABLE product_channel_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES channels(id),
  external_product_id TEXT,          -- 채널에서 부여한 상품ID
  channel_product_name TEXT,         -- 채널별 상품명 (다를 수 있음)
  channel_price NUMERIC(12,0),       -- 채널별 판매가
  is_listed BOOLEAN DEFAULT false,   -- 게시 여부
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_id, channel_id)
);
```

### 상품 게시 흐름
```
상품 상세 페이지
  → "채널 게시" 탭
  → 게시할 채널 선택 + 채널별 가격/상품명 설정
  → "게시" 클릭
       → getAdapter(channel).createProduct(productData)
       → product_channel_mappings INSERT/UPDATE
       → external_product_id 저장

상품 정보 변경 시
  → "채널 동기화" 버튼
  → 매핑된 채널에 일괄 업데이트
       → getAdapter(channel).updateProduct(externalId, changes)
```

### 채널별 API 차이 핸들링
각 채널의 상품 등록 필수 필드가 다르므로, 채널별 폼 확장 필요:

| 필드 | 네이버 | 11번가 | 옥션 |
|------|--------|--------|------|
| 카테고리 | 네이버 카테고리 ID | 11번가 카테고리 | 옥션 카테고리 |
| 이미지 | 대표 1 + 추가 9 | 대표 1 + 추가 4 | 대표 1 + 추가 9 |
| 옵션 | 조합형/독립형 | 단독/조합 | 직접등록 |
| 상세페이지 | HTML | HTML | HTML |
| 배송정보 | 템플릿 ID | 직접입력 | 직접입력 |

---

## 3. 상품 관리 페이지 개선

### 기존 기능 (유지)
- 상품 CRUD, 카테고리 필터, 검색
- 번들 상품 (묶음), 재고 연결

### 추가 UI 요소
- **바코드 스캔 플로팅 버튼**: 우하단 FAB, 클릭 시 스캔 모드 활성화
- **채널 게시 상태 뱃지**: 상품 목록에 [N] [11] [옥] 아이콘 표시
- **대량 작업**: 선택 상품 → 일괄 가격 변경, 일괄 채널 게시
- **상품 상세 탭**: 기본정보 | 가격표 | 재고 | 채널게시 | 이력

### 상품 목록 테이블 컬럼
```
□ | 이미지 | 바코드 | 상품명 | 카테고리 | 매입가 | 판매가 |
현재고 | 채널 | 상태 | 액션
```
