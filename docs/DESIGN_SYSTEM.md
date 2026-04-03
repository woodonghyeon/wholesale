# 디자인 시스템 — macOS 감성

## 디자인 철학

Apple의 Human Interface Guidelines에서 영감을 받은 **깔끔하고 정제된** UI.
과도한 장식 없이 콘텐츠에 집중하며, 부드러운 애니메이션과 일관된 여백으로 고급스러움을 표현한다.

## 핵심 원칙

1. **Vibrancy & Depth** — 반투명 배경(backdrop-blur), 미세한 그림자 레이어링
2. **Typography** — `Geist` (영문/코드, Next.js 기본 로드)
3. **Color** — 채도 낮은 액센트 (#007aff macOS blue)
4. **Spacing** — 8px 기반 그리드, 넉넉한 패딩 (p-4~p-6)
5. **Motion** — 200~300ms ease-out 트랜지션, 과도한 bounce 금지
6. **Border** — 1px solid with low opacity (`border-black/[0.06]`), `rounded-xl` / `rounded-2xl` 선호
7. **Components** — 유리모피즘(glassmorphism) 카드, 세그먼트 컨트롤

## 색상 팔레트

```
배경(기본):   #fafafa
배경(사이드): #f5f5f5
카드(유리):   bg-white/80 backdrop-blur-xl
테두리:       border-black/[0.06]
텍스트(주):   #1d1d1f
텍스트(부):   #86868b
액센트:       #007aff  (hover: #0066d6)
성공:         #34c759
경고:         #ff9f0a
위험:         #ff3b30
```

## 컴포넌트 스타일 가이드

```
Card:       bg-white/80 backdrop-blur-xl border border-black/[0.06] rounded-2xl shadow-card p-5
Sidebar:    w-[240px] bg-[#f5f5f5] border-r border-black/[0.06]
Header:     1행(h-14) + 2행(h-10, 채널 선택 시) — bg-white/72 backdrop-blur-xl sticky top-0 z-10
Button(주): rounded-lg px-4 py-2 text-sm font-medium bg-[#007aff] text-white transition-all duration-200
Button(부): rounded-lg px-4 py-2 text-sm font-medium border border-gray-200 hover:bg-gray-50
Input:      rounded-lg border border-gray-300/60 bg-white px-3 py-2 focus:ring-2 focus:ring-blue-500/20
Modal:      fixed inset-0 z-50 / 내부: bg-white/90 backdrop-blur-2xl rounded-2xl shadow-2xl
Table:      text-xs divide-y divide-gray-100 / row: hover:bg-blue-50/40 transition cursor-pointer / 교차행: bg-gray-50/40
Badge:      rounded-full px-2.5 py-0.5 text-xs font-medium
Segment:    inline-flex bg-gray-100 rounded-lg p-0.5 (macOS segmented control)
SlidePanel: fixed inset-0 z-40 flex justify-end / 내부: w-[420px] bg-white/95 backdrop-blur-2xl border-l
```

## 마진율 색상

```
m >= 30% → text-[#34c759]  (녹색)
m >= 10% → text-[#007aff]  (파랑)
m < 10%  → text-[#ff3b30]  (빨강)
```

## 채널 색상 (chart/badge)

각 채널은 고유 색상으로 구분. Recharts BarChart에서 채널별 fill 색상 사용.
