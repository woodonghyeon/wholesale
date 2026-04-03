# CLAUDE.md — 문구 도매 통합 관리 시스템

> 최종 갱신: 2026-04-03

---

## 프로젝트 개요

문구류 도매 ERP. 3개 사업자(본점·강남점·온라인), 네이버·11번가·옥션·자사몰 등 다중 판매채널 통합 관리.

- **Supabase 프로젝트:** `hlnaasaqfrgearcckmuo`
- **GitHub:** https://github.com/woodonghyeon/wholesale

---

## 기술 스택

Next.js 14 (App Router) · TypeScript 5 · Supabase · React 18 · Tailwind CSS · Zustand 5 · React Hook Form + Zod · Recharts · xlsx · sonner · node-cron · bcryptjs

---

## 핵심 아키텍처 규칙

- **멀티 테넌트:** `business_id` FK 기반, Zustand `selectedBusinessId`/`selectedChannelId` 전역 필터
- 사업자 전환 시 `selectedChannelId`가 `'all'`로 자동 초기화
- `channels` 테이블은 `business_id`로 사업자에 종속 — 채널 조회 시 반드시 `business_id` 필터 적용
- DB 접근: `lib/supabase/[domain].ts`에 함수 분리
- 페이지 컴포넌트: `'use client'` 지시어 필수
- 한 파일 300줄 이내, 초과 시 컴포넌트 분리

---

## 디렉토리 구조 (요약)

```
app/(auth)/          — 로그인/회원가입
app/(dashboard)/     — 메인 기능 페이지들 (layout.tsx: Sidebar + Header)
app/api/             — API 라우트 (channels/sync-orders, channels/orders)
components/layout/   — Header.tsx (2단), Sidebar.tsx
lib/supabase/        — slips, orders, products, inventory, sales, purchase
lib/channels/naver/  — auth, adapter, mapper
lib/types/index.ts   — 전체 TypeScript 타입
store/businessStore.ts — Zustand persist (selectedBusinessId, selectedChannelId)
supabase/            — schema.sql, seed.sql, channel_orders.sql
middleware.ts        — Auth guard
```

---

## 구현 상태

✅ 완료: 인증, 대시보드, 거래전표, 통합주문(네이버), 매출집계, 채널별매출, 매입집계, 상품관리, 재고관리, 설정, 거래처관리

❌ 미구현: 재고실사, 재고수불, 가격표, 거래처원장, 견적서, 반품, 세금계산서, 현금출납, 채권채무, 어음수표, 분석리포트, 분기집계, 단골고객, 알림센터, 시스템로그

---

## 필수 컨벤션

```typescript
// 금액 포맷
function fmt(n: number) { return new Intl.NumberFormat('ko-KR').format(n) }

// 전표번호: {S|P}{YYYYMMDD}-{seq 3자리}  예) S20260401-001

// 부가세 계산
const supply = items.reduce((s, i) => s + i.quantity * i.unit_price, 0)
const tax = Math.round(supply * 0.1)
const total = supply + tax

// Set 중복제거: for...of + seen Set 패턴 (❌ [...new Set()] → TS2802 오류)
const seen = new Set<string>(); const result: string[] = []
for (const item of arr) { if (!seen.has(item)) { seen.add(item); result.push(item) } }

// 채널 필터 (항상 business_id 함께)
supabase.from('channels').select('*').eq('business_id', businessId)
const { selectedBusinessId, selectedChannelId } = useBusinessStore()
```

---

## 토큰 절약 & 작업 워크플로우

### 모델 전략
```
/model sonnet    # 기본 작업 (80% — 코딩, UI, 버그 수정)
/model opus      # 복잡한 아키텍처 설계, 디버깅에만 전환
```

### 세션 관리
- 기능 구현 완료 → `/wrap-up` (문서 자동 업데이트 + commit) → `/clear`
- 같은 작업 내 대화 길어질 때 → `/compact`
- 작업 주제 완전 변경 시 → `/clear`

### gstack 활용 (✅ 설치 완료: `~/.claude/skills/gstack`)

웹 브라우저 조작이 필요할 때는 반드시 `/browse` 스킬을 사용. `mcp__claude-in-chrome__*` 도구는 사용하지 않는다.

| 커맨드 | 용도 | 토큰 소모 | 사용 시점 |
|--------|------|-----------|-----------|
| `/review` | PR/코드 리뷰 | 30~80K | **매번** — 기능 완료 후 |
| `/ship` | 원커맨드 배포 | 20~50K | **매번** — 배포 시 |
| `/plan-eng-review` | 아키텍처 리뷰 | 50~100K | **가끔** — 새 기능 설계 시 |
| `/browse` | 헤드리스 브라우저 | 10~30K | **가끔** — QA/확인 시 |
| `/qa` | 브라우저 QA | 50~200K | **가끔** — 릴리즈 전 |
| `/retro` | 주간 회고 | 20~50K | **가끔** — 주 1회 |
| `/investigate` | 체계적 디버깅 | 30~80K | **가끔** — 원인 추적 시 |
| `/plan-ceo-review` | 제품 리뷰 | 50~150K | **자제** — 큰 방향 점검 시만 |

<details>
<summary>전체 gstack 커맨드 목록</summary>

`/office-hours` `/plan-ceo-review` `/plan-eng-review` `/plan-design-review` `/design-consultation` `/design-shotgun` `/design-html` `/review` `/ship` `/land-and-deploy` `/canary` `/benchmark` `/browse` `/connect-chrome` `/qa` `/qa-only` `/design-review` `/setup-browser-cookies` `/setup-deploy` `/retro` `/investigate` `/document-release` `/codex` `/cso` `/autoplan` `/careful` `/freeze` `/guard` `/unfreeze` `/gstack-upgrade` `/learn`
</details>

### 새 기능 개발 워크플로우 (권장 순서)

```
1. /plan-eng-review  — 아키텍처 설계 (Opus, 선택적)
2. /clear
3. /model sonnet     — 구현 시작
4. /new-page         — 커스텀 커맨드로 체크리스트 참조
5. (코딩...)
6. /review           — gstack 코드 리뷰
7. /wrap-up          — 문서 업데이트 + commit
8. /clear
```

---

## 알려진 빌드 설정

- `next.config.mjs`: `eslint.ignoreDuringBuilds: true`, `typescript.ignoreBuildErrors: false`
- `experimental.serverComponentsExternalPackages: ['bcryptjs', 'node-cron']`
- DB 실행 현황: `supabase/add_business_to_channels.sql`

---

## 새 기능 추가 체크리스트

1. `lib/types/index.ts` 타입 확인
2. `lib/supabase/[domain].ts` DB 함수 작성 → `docs/CODING_PATTERNS.md` 참고
3. `app/(dashboard)/[feature]/page.tsx` 작성
4. 뷰가 여러 개면 `TableView` / `ListView` / `CardView` 분리
5. Sidebar 수정 불필요 (메뉴 이미 등록됨)

---

## 상세 참조 문서 (필요 시에만 읽기)

| 문서 | 경로 | 내용 |
|------|------|------|
| 디자인 시스템 | `docs/DESIGN_SYSTEM.md` | 색상·컴포넌트 스타일 가이드 |
| DB 스키마 상세 | `docs/DB_SCHEMA.md` | 25개 테이블·RPC·RLS 전체 |
| 코딩 패턴 | `docs/CODING_PATTERNS.md` | 페이지·모달·DB함수 코드 패턴 |
| 네이버 API | `docs/NAVER_API.md` | OAuth2·동기화 플로우 |
| 트러블슈팅 | `docs/TROUBLESHOOTING.md` | 증상·원인·해결 이력 |
| 구현 상세 | `docs/IMPLEMENTATION.md` | 페이지별 기능 목록 |
| 코드베이스 개요 | `CODEBASE_OVERVIEW.md` | 전체 시스템 분석 |

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
