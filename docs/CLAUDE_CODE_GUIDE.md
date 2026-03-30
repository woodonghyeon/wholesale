# Claude Code 작업 가이드 — 도매 통합 관리 시스템

> 작성일: 2026-03-29
> 목적: 이 프로젝트에서 Claude Code를 효율적으로 사용하기 위한 전략 정리

---

## Part 1. 토큰 절약 전략

### 1-1. 가장 효과가 큰 기본 원칙

| 원칙 | 방법 | 예상 절감 |
|------|------|----------|
| 무관한 작업 사이에는 `/clear` | 재고 작업 → 전표 작업 전환 시 실행 | ★★★ 최대 |
| `CLAUDE.md` 200줄 이내 유지 | 불필요한 규칙 제거 | ★★★ 최대 |
| **구체적 프롬프트** 사용 | "개선해줘" ❌ → "inventory/page.tsx의 조정 버튼 클릭 핸들러에 에러 처리 추가" ✅ | ★★★ 최대 |
| 조사는 서브에이전트에게 위임 | "파일 5개 탐색" 작업은 Agent로 분리 | ★★ 중간 |

---

### 1-2. 컨텍스트 관리 명령어

```bash
/clear      # 현재 대화 초기화 (무관한 작업 전환 시)
/compact    # 대화 압축 (컨텍스트 절반 이상 채워졌을 때)
/compact "슬립 관련 변경사항 위주로 압축"  # 타겟 압축
/context    # 현재 컨텍스트 사용량 확인
/cost       # 현재 세션 토큰 비용 확인
/rename "task-slip-input"  # 세션 이름 저장 (나중에 재개 가능)
```

```bash
# 터미널에서
claude --continue          # 가장 최근 세션 이어서
claude --resume            # 세션 목록에서 선택해서 재개
```

---

### 1-3. CLAUDE.md 최적화 원칙

- **포함할 것:** 빌드 명령어, 이 프로젝트만의 코딩 규칙, 특이한 설정
- **제외할 것:** Claude가 코드 보면 알 수 있는 것, 표준 관례, 긴 설명
- **분리할 것:** 자주 안 쓰는 도메인 지식은 별도 파일로 (`@docs/파일명` 참조)

```markdown
<!-- CLAUDE.md 예시 (권장 구조) -->
# 프로젝트 핵심 규칙
- selectedBusinessId: 전 페이지 필터 기준 (businessStore.ts)
- adjust_inventory RPC: 재고 변경은 반드시 이 함수 사용
- logActivity 필수: 모든 CRUD 후 감사 로그 기록

# 빌드
npm run dev | npm run build

# 참조
- 타입: @lib/types/index.ts
- DB 모듈: @lib/supabase/
```

---

### 1-4. 파일 읽기 전략 (비싼 작업)

```
탐색 순서: Glob → Grep → Read (순서대로, 필요한 만큼만)
```

**예시 — 재고 관련 버그 수정 요청 시:**
```
❌ 비효율: "재고 관련 파일 모두 보여줘"
✅ 효율적: "lib/supabase/inventory.ts의 adjustInventory 함수 확인해줘"
```

---

### 1-5. 세션 분리 전략 (이 프로젝트 기준)

작업 단위별로 세션을 나누면 컨텍스트 오염 방지:

```
세션 A: "feature/transactions-form" — 전표 입력 개선
  → 완료 후 /rename → /clear

세션 B: "feature/inventory-grid" — 재고 그리드 UI 수정
  → 별도 세션으로 시작

세션 C: "fix/dashboard-query" — 대시보드 쿼리 최적화
  → 별도 세션으로 시작
```

---

### 1-6. 서브에이전트 위임 (탐색/조사 작업)

아래 작업은 서브에이전트 위임으로 메인 컨텍스트 보호:

```
"서브에이전트를 사용해서 channel-sales 페이지의 순수익 계산 로직이
 어디서 어떻게 처리되는지 조사하고 요약해줘"
```

→ 서브에이전트가 파일 20개를 탐색해도 메인 세션에는 요약만 전달됨

---

### 1-7. 모델 선택 기준

| 작업 유형 | 추천 모델 | 이유 |
|-----------|-----------|------|
| 새 기능 설계, 아키텍처 결정 | Opus | 복잡한 추론 필요 |
| 일반 기능 구현, 버그 수정 | Sonnet (기본) | 비용/성능 균형 |
| 단순 수정, 포맷팅 | Haiku (서브에이전트) | 저비용 |

```bash
/model claude-opus-4-5   # 세션 중 모델 전환
/model claude-sonnet-4-5
```

---

### 1-8. 반복 실패 시 처리법

```
2번 수정해도 안 되면:
1. /clear 실행
2. 프롬프트를 더 구체적으로 재작성
3. 관련 파일 경로 명시해서 다시 시작
```

---

## Part 2. 이 프로젝트에 추천하는 Skills & 기능

### 2-1. `simplify` — 코드 품질 자동 리뷰

**언제:** 기능 구현 완료 후

```bash
/simplify
```

**이 프로젝트에서 특히 유용한 경우:**
- `lib/supabase/*.ts` 모듈에 중복 쿼리 로직 정리
- 전표 입력 폼 유효성 검사 로직 단순화
- 대시보드 `Promise.all()` 병렬 쿼리 최적화 여부 확인

---

### 2-2. `anthropic-skills:xlsx` — Excel 기능 강화

**언제:** Excel 가져오기/내보내기 작업 시

```bash
/xlsx
```

**이 프로젝트 관련 활용:**
- `lib/excel/import.ts` — 현재 검증 미완인 가져오기 기능 완성
- `lib/excel/export.ts` — 9종 멀티시트 구조 개선
- 거래처별, 상품별 Excel 템플릿 생성
- Excel → DB 배치 upsert 에러 핸들링 강화

---

### 2-3. `anthropic-skills:pdf` — PDF 생성 고도화

**언제:** PDF 관련 기능 추가/수정 시

```bash
/pdf
```

**이 프로젝트 관련 활용:**
- `/api/pdf/quote` — 견적서·발주서 PDF 레이아웃 개선
- `/api/pdf/price-list` — 가격표 PDF A4 출력 최적화
- `/api/pdf/slip` — 영수증 전표 PDF 포맷 개선
- 도장/로고 삽입, 페이지 번호 추가 등

---

### 2-4. `update-config` — 자동화 훅 설정

**언제:** 반복 작업을 자동화하고 싶을 때

```bash
/update-config
```

**이 프로젝트에서 추천 훅 설정:**

```json
// .claude/settings.json 권장 설정
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Edit",
      "hooks": [{
        "type": "command",
        "command": "npx tsc --noEmit 2>&1 | head -20"
      }]
    }]
  }
}
```

→ 파일 수정 후 TypeScript 타입 에러 자동 확인 (토큰 절약 + 품질 향상)

---

### 2-5. `schedule` / `anthropic-skills:schedule` — 자동화 작업

**언제:** 네이버 자동동기화, 정기 리포트 등 예약 작업

```bash
/schedule
```

**이 프로젝트 관련 활용:**
- `lib/naver/auto-sync.ts` — node-cron 스케줄러 설정 보조
- 일별 매출 리포트 자동 생성
- 저재고 알림 정기 체크

---

## Part 3. 이 프로젝트 전용 작업 흐름 권장안

### 새 기능 추가 시

```
1. /clear (이전 작업과 분리)
2. 구체적 프롬프트: "어떤 파일의 어떤 함수에 무엇을 추가"
3. 구현 완료 후 /simplify 실행
4. 타입 에러 확인 (훅 자동 실행 또는 수동)
5. /rename "feature-xxx" 저장
```

### 버그 수정 시

```
1. 에러 메시지 + 파일 경로 함께 제공
2. 관련 파일 2-3개만 명시
3. 수정 후 /cost로 비용 확인
```

### Excel / PDF 작업 시

```
1. /xlsx 또는 /pdf 스킬 먼저 호출
2. 스킬 가이드에 따라 작업
3. lib/excel/ 또는 app/api/pdf/ 경로 명시
```

### 대규모 리팩토링 시

```
1. "서브에이전트를 사용해서 XXX 분석해줘" 로 조사 위임
2. 결과 요약 받은 후 /compact
3. 실제 수정 작업 시작
```

---

## Part 4. 빠른 참조

### 자주 쓰는 명령어 요약

```bash
# 컨텍스트 관리
/clear                    # 초기화
/compact                  # 압축
/context                  # 사용량 확인
/cost                     # 비용 확인
/rename "세션명"           # 세션 저장

# 스킬 호출
/simplify                 # 코드 품질 리뷰
/xlsx                     # Excel 작업
/pdf                      # PDF 작업
/update-config            # 훅/설정 구성
/schedule                 # 예약 작업

# 모델 전환
/model claude-sonnet-4-5  # 기본 작업
/model claude-opus-4-5    # 복잡한 설계
```

### 이 프로젝트의 핵심 경로 (프롬프트에 명시할 것)

```
lib/supabase/            — DB 쿼리 모듈
lib/types/index.ts       — 타입 정의
app/(dashboard)/         — 페이지 컴포넌트
app/api/                 — API 라우트
lib/excel/               — Excel 처리
store/businessStore.ts   — 전역 사업자 상태
supabase/functions.sql   — RPC 함수
```

---

*이 문서는 2026-03-29 기준 작성되었습니다.*
