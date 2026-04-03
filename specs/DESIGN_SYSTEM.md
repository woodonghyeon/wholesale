# 디자인 시스템 — macOS 감성 상세 가이드

> Wholesale Master ERP의 UI/UX 가이드라인

---

## 1. 디자인 철학

**"Quiet Confidence"** — Apple의 macOS 데스크탑 앱에서 영감받은 디자인.
화려하지 않지만 정교하고, 단순하지만 깊이가 있는 인터페이스.

### 핵심 키워드
- **Translucency** — 반투명 레이어로 깊이감 (backdrop-blur)
- **Precision** — 1px 단위의 정밀한 정렬과 간격
- **Restraint** — 최소한의 색상, 최소한의 장식
- **Smooth** — 부드러운 트랜지션 (cubic-bezier)
- **System Font** — 네이티브에 가까운 텍스트 렌더링

---

## 2. 타이포그래피

### 폰트 스택
```css
/* 한국어 본문 */
font-family: 'Pretendard Variable', 'Pretendard', -apple-system,
             BlinkMacSystemFont, system-ui, sans-serif;

/* 영문/숫자/코드 */
font-family: 'Geist', 'SF Pro Text', -apple-system, sans-serif;

/* 모노스페이스 (코드, 바코드, 금액) */
font-family: 'Geist Mono', 'SF Mono', 'Menlo', monospace;
```

### 타입 스케일 (8px 기반)
| 용도 | 사이즈 | Weight | Line Height | Tracking |
|------|--------|--------|-------------|----------|
| Display | 28px | 700 | 1.2 | -0.02em |
| Title 1 | 22px | 600 | 1.3 | -0.01em |
| Title 2 | 18px | 600 | 1.3 | -0.01em |
| Title 3 | 15px | 600 | 1.4 | 0 |
| Body | 14px | 400 | 1.5 | 0 |
| Subhead | 13px | 500 | 1.4 | 0 |
| Caption | 12px | 400 | 1.4 | 0.01em |
| Footnote | 11px | 400 | 1.3 | 0.01em |

### 금액 표기
- 폰트: Geist Mono (탭뷸러 숫자)
- 정렬: 우측 정렬 (tabular-nums)
- 포맷: `₩ 1,234,500` (천 단위 콤마)

---

## 3. 컬러 시스템

### 라이트 모드
```css
:root {
  /* Backgrounds */
  --color-bg-primary: #ffffff;
  --color-bg-secondary: #f5f5f7;         /* 사이드바, 카드 배경 */
  --color-bg-tertiary: #ebebf0;          /* 세그먼트 컨트롤 배경 */
  --color-bg-glass: rgba(255,255,255,0.72);
  --color-bg-elevated: #ffffff;

  /* Text */
  --color-text-primary: #1d1d1f;
  --color-text-secondary: #86868b;
  --color-text-tertiary: #aeaeb2;
  --color-text-quaternary: #c7c7cc;

  /* Borders */
  --color-border-default: rgba(0,0,0,0.06);
  --color-border-strong: rgba(0,0,0,0.12);
  --color-border-opaque: #d2d2d7;

  /* Accents (macOS system colors) */
  --color-accent-blue: #007aff;
  --color-accent-green: #34c759;
  --color-accent-orange: #ff9f0a;
  --color-accent-red: #ff3b30;
  --color-accent-purple: #af52de;
  --color-accent-teal: #5ac8fa;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.04);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.08);
  --shadow-lg: 0 8px 32px rgba(0,0,0,0.12);
  --shadow-xl: 0 16px 48px rgba(0,0,0,0.16);
}
```

### 다크 모드
```css
:root.dark {
  --color-bg-primary: #1c1c1e;
  --color-bg-secondary: #2c2c2e;
  --color-bg-tertiary: #3a3a3c;
  --color-bg-glass: rgba(44,44,46,0.72);
  --color-bg-elevated: #2c2c2e;

  --color-text-primary: #f5f5f7;
  --color-text-secondary: #98989d;
  --color-text-tertiary: #636366;

  --color-border-default: rgba(255,255,255,0.08);
  --color-border-strong: rgba(255,255,255,0.16);
}
```

### 상태 색상 적용
| 상태 | 배경 | 텍스트 | 용도 |
|------|------|--------|------|
| 성공 | green-50 | green-700 | 배송완료, 결제완료 |
| 경고 | orange-50 | orange-700 | 재고부족, 만기임박 |
| 오류 | red-50 | red-700 | 취소, 반품, 오류 |
| 정보 | blue-50 | blue-700 | 신규, 진행중 |
| 중립 | gray-100 | gray-600 | 대기, 드래프트 |

---

## 4. 컴포넌트 라이브러리

### Card (유리모피즘)
```tsx
<div className="
  bg-white/72 dark:bg-[#2c2c2e]/72
  backdrop-blur-xl
  border border-black/[0.06] dark:border-white/[0.08]
  rounded-2xl
  shadow-sm
  p-5
">
```

### Sidebar
```tsx
<aside className="
  w-[260px] min-h-screen
  bg-[#f5f5f7] dark:bg-[#2c2c2e]
  border-r border-black/[0.06]
  flex flex-col
">
  {/* 로고 영역 */}
  <div className="h-14 px-4 flex items-center">...</div>

  {/* 네비게이션 */}
  <nav className="flex-1 px-2 py-1 space-y-0.5">
    {/* 카테고리 헤더 */}
    <p className="px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
      매출관리
    </p>
    {/* 메뉴 아이템 */}
    <a className="
      flex items-center gap-2.5 px-3 py-1.5 rounded-lg
      text-[13px] text-gray-700
      hover:bg-black/[0.04]
      data-[active=true]:bg-blue-500/10
      data-[active=true]:text-blue-600
      transition-colors duration-150
    ">
      <Icon size={16} />
      <span>거래전표</span>
    </a>
  </nav>
</aside>
```

### Button
```tsx
// Primary
<button className="
  px-4 py-2 rounded-lg
  bg-[#007aff] text-white text-sm font-medium
  hover:bg-[#0066d6]
  active:bg-[#0055b3]
  transition-all duration-150
  shadow-sm
">

// Secondary
<button className="
  px-4 py-2 rounded-lg
  bg-gray-100 dark:bg-gray-700
  text-gray-700 dark:text-gray-200
  text-sm font-medium
  hover:bg-gray-200 dark:hover:bg-gray-600
  transition-all duration-150
">

// Destructive
<button className="
  px-4 py-2 rounded-lg
  bg-red-500/10 text-red-600
  text-sm font-medium
  hover:bg-red-500/20
  transition-all duration-150
">
```

### Input
```tsx
<input className="
  w-full px-3 py-2 rounded-lg
  border border-gray-300/60 dark:border-gray-600
  bg-white dark:bg-gray-800
  text-sm text-gray-900 dark:text-gray-100
  placeholder:text-gray-400
  focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500
  transition-all duration-150
" />
```

### Segment Control (macOS 스타일)
```tsx
<div className="inline-flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
  {segments.map(seg => (
    <button
      key={seg.value}
      className={cn(
        "px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200",
        active === seg.value
          ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900"
          : "text-gray-500 hover:text-gray-700"
      )}
    >
      {seg.label}
    </button>
  ))}
</div>
```

### Modal (macOS Sheet 스타일)
```tsx
{/* Backdrop */}
<div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50" />

{/* Sheet */}
<div className="
  fixed top-[10%] left-1/2 -translate-x-1/2
  w-full max-w-lg
  bg-white/80 dark:bg-[#2c2c2e]/80
  backdrop-blur-2xl
  rounded-2xl
  shadow-xl
  border border-black/[0.06]
  overflow-hidden
  animate-in fade-in slide-in-from-top-4 duration-200
">
  {/* Header */}
  <div className="px-6 py-4 border-b border-black/[0.06]">
    <h2 className="text-base font-semibold">제목</h2>
  </div>

  {/* Body */}
  <div className="px-6 py-4">...</div>

  {/* Footer */}
  <div className="px-6 py-3 bg-gray-50/50 flex justify-end gap-2">
    <button>취소</button>
    <button>확인</button>
  </div>
</div>
```

### Table
```tsx
<table className="w-full">
  <thead>
    <tr className="border-b border-gray-200/60">
      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
        컬럼명
      </th>
    </tr>
  </thead>
  <tbody className="divide-y divide-gray-100">
    <tr className="hover:bg-gray-50/50 transition-colors duration-100">
      <td className="px-4 py-3 text-sm text-gray-900">값</td>
    </tr>
  </tbody>
</table>
```

### Badge (상태)
```tsx
const statusStyles = {
  success: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  warning: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  error: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  info: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  neutral: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

<span className={cn(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
  statusStyles[status]
)}>
  {label}
</span>
```

### Toast (sonner 커스텀)
```tsx
// 전역 Toaster 설정
<Toaster
  position="top-right"
  toastOptions={{
    className: 'bg-white/80 backdrop-blur-xl border border-black/[0.06] shadow-lg rounded-xl',
    duration: 3000,
  }}
/>
```

---

## 5. 레이아웃 패턴

### 대시보드 레이아웃
```
┌──────────────────────────────────────────────────┐
│ Header (h-14): 사업자 선택 + 검색 + 프로필       │
├──────────┬───────────────────────────────────────┤
│          │                                       │
│ Sidebar  │  Main Content                         │
│ w-[260]  │  p-6                                  │
│          │                                       │
│          │  ┌─ PageHeader ──────────────────┐    │
│          │  │ 페이지 제목        [액션 버튼] │    │
│          │  └──────────────────────────────-┘    │
│          │                                       │
│          │  ┌─ Content Area ───────────────┐    │
│          │  │                              │    │
│          │  │  (페이지별 콘텐츠)             │    │
│          │  │                              │    │
│          │  └──────────────────────────────┘    │
│          │                                       │
└──────────┴───────────────────────────────────────┘
```

### 3단 레이아웃 (CS, 주문 상세)
```
┌──────────┬──────────────────┬──────────────────┐
│ Sidebar  │  Master List     │  Detail Panel    │
│ w-[260]  │  w-[340]         │  flex-1          │
│          │  border-r        │                  │
└──────────┴──────────────────┴──────────────────┘
```

---

## 6. 모션 & 트랜지션

### 기본 이징
```css
--ease-default: cubic-bezier(0.25, 0.1, 0.25, 1);     /* 일반 트랜지션 */
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);      /* 팝업, 토스트 */
--ease-smooth: cubic-bezier(0.16, 1, 0.3, 1);          /* 슬라이드 */
```

### 트랜지션 시간
| 유형 | 시간 | 용도 |
|------|------|------|
| Micro | 100ms | 호버, 포커스 |
| Fast | 150ms | 버튼 클릭, 토글 |
| Normal | 200ms | 드롭다운, 탭 전환 |
| Slow | 300ms | 모달, 사이드 패널 |
| Deliberate | 500ms | 페이지 전환 |

### 적용 예시
```css
/* 호버 */
.hoverable { transition: all 100ms var(--ease-default); }

/* 모달 */
.modal-enter { animation: slideDown 200ms var(--ease-smooth); }

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 사이드 패널 (Inspector) */
.panel-enter { animation: slideLeft 300ms var(--ease-smooth); }

@keyframes slideLeft {
  from { opacity: 0; transform: translateX(100%); }
  to { opacity: 1; transform: translateX(0); }
}
```

---

## 7. 아이콘

### 라이브러리
Lucide React (`lucide-react`) — macOS SF Symbols와 유사한 스타일.

### 사이즈 규칙
| 컨텍스트 | 사이즈 | strokeWidth |
|---------|--------|-------------|
| 사이드바 메뉴 | 16px | 1.5 |
| 버튼 안 | 16px | 2 |
| 테이블 액션 | 14px | 1.5 |
| 카드 KPI | 20px | 1.5 |
| 빈 상태 | 48px | 1 |

---

## 8. 반응형

| Breakpoint | 너비 | 변화 |
|-----------|------|------|
| sm | 640px | 모바일 기본 |
| md | 768px | 사이드바 접힘 (토글) |
| lg | 1024px | 사이드바 펼침 |
| xl | 1280px | 대시보드 4컬럼 그리드 |
| 2xl | 1536px | 최대 너비 제한 (max-w-[1400px]) |

모바일에서 사이드바는 햄버거 메뉴로 전환 (Sheet 스타일 슬라이드).
