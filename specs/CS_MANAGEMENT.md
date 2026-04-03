# CS(고객서비스) 관리 — 상세 스펙

> 여러 채널의 고객 문의를 통합 수집하여 관리

---

## 1. 개요

네이버 톡톡, 11번가 문의, 옥션 문의 등 각 채널에 들어오는 고객 문의를
하나의 인박스에서 확인하고 답변한다.

---

## 2. DB 스키마

```sql
CREATE TABLE cs_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id),
  channel_id UUID REFERENCES channels(id),
  platform_type TEXT NOT NULL,
  external_inquiry_id TEXT NOT NULL,
  inquiry_type TEXT CHECK (inquiry_type IN (
    'product', 'shipping', 'return', 'exchange',
    'cancel', 'payment', 'other'
  )),
  order_id TEXT,                               -- 관련 주문번호
  customer_name TEXT,
  customer_contact TEXT,
  title TEXT,
  content TEXT NOT NULL,
  reply_content TEXT,
  reply_at TIMESTAMPTZ,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'replied', 'closed')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_to UUID REFERENCES auth.users(id),
  ai_suggested_reply TEXT,                     -- AI 추천 답변
  tags TEXT[],
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(channel_id, external_inquiry_id)
);

CREATE INDEX idx_cs_inquiries_status ON cs_inquiries(status);
CREATE INDEX idx_cs_inquiries_business ON cs_inquiries(business_id);
CREATE INDEX idx_cs_inquiries_created ON cs_inquiries(created_at);
```

---

## 3. 채널 어댑터 확장

```typescript
// ChannelAdapter 인터페이스에 추가
interface ChannelAdapter {
  // ... 기존 메서드

  // CS 문의
  fetchInquiries(params: InquiryFetchParams): Promise<ChannelInquiry[]>;
  replyInquiry(inquiryId: string, content: string): Promise<void>;
}

interface InquiryFetchParams {
  fromDate: Date;
  toDate: Date;
  status?: 'answered' | 'unanswered';
}

interface ChannelInquiry {
  externalId: string;
  type: string;
  orderId?: string;
  customerName: string;
  title: string;
  content: string;
  createdAt: Date;
  isAnswered: boolean;
}
```

---

## 4. 수집 흐름

```
자동 동기화 (주문과 함께, 10분 간격)
  └→ sync_enabled 채널 순회
       └→ adapter.fetchInquiries({ status: 'unanswered' })
            └→ cs_inquiries UPSERT
            └→ 미답변 건수 알림

수동 동기화
  └→ CS 관리 페이지 "동기화" 버튼
```

---

## 5. AI 답변 추천 (우선순위 낮음)

### 흐름
```
문의 수신
  → 문의 내용 + 주문 정보 + 상품 정보 조합
  → LLM API 호출 (Claude API or 자체 모델)
  → ai_suggested_reply 필드에 저장
  → 상담원이 확인 후 수정/전송
```

### 프롬프트 템플릿
```
당신은 문구 도매업체의 고객 상담원입니다.
아래 고객 문의에 대해 정중하고 전문적인 답변을 작성해주세요.

[주문 정보]
- 주문번호: {orderId}
- 상품: {productName}
- 주문일: {orderedAt}
- 배송상태: {shippingStatus}

[고객 문의]
{content}

답변 시 주의사항:
- 존댓말 사용
- 구체적인 해결 방안 제시
- 배송 관련 문의는 택배사 정보 포함
- 반품/교환은 절차 안내
```

### 구현 방식
```typescript
// app/api/cs/ai-reply/route.ts
export async function POST(req: Request) {
  const { inquiryId } = await req.json();

  // 문의 + 주문 + 상품 정보 조회
  const inquiry = await getInquiryWithContext(inquiryId);

  // Claude API 호출 (또는 다른 LLM)
  const reply = await generateReply(inquiry);

  // 추천 답변 저장
  await supabase
    .from('cs_inquiries')
    .update({ ai_suggested_reply: reply })
    .eq('id', inquiryId);

  return NextResponse.json({ reply });
}
```

---

## 6. CS 관리 페이지 UI

### 인박스 레이아웃 (macOS Mail 스타일)
```
┌─────────┬──────────────────┬──────────────────┐
│ 사이드바  │    문의 목록       │    문의 상세       │
│         │                  │                  │
│ 📥 전체  │  [미답변 23건]     │  고객: 김철수      │
│ ⏳ 대기  │                  │  채널: 네이버      │
│ ✅ 완료  │  ● 배송 문의      │  유형: 배송문의     │
│         │  김철수 · 네이버   │                  │
│ ─────── │  주문이 아직...    │  주문번호를 확인... │
│ 채널     │  3분 전           │                  │
│  네이버  │                  │  ─────────────── │
│  11번가  │  ○ 상품 문의      │  💡 AI 추천 답변   │
│  옥션    │  박영희 · 11번가   │  [답변내용...]     │
│         │  이 상품의...      │  [수정] [전송]     │
│ ─────── │  1시간 전          │                  │
│ 유형     │                  │  ─────────────── │
│  배송    │                  │  답변 작성:        │
│  상품    │                  │  [              ] │
│  반품    │                  │  [답변 전송]       │
└─────────┴──────────────────┴──────────────────┘
```

### 핵심 UI 요소
- **3단 레이아웃**: 사이드바(필터) + 목록 + 상세
- **실시간 업데이트**: Supabase Realtime으로 신규 문의 알림
- **AI 답변 블록**: 상세 패널에 추천 답변 카드, "수정 후 전송" 워크플로우
- **빠른 답변 템플릿**: 자주 쓰는 답변 저장 & 원클릭 삽입
- **상태 토글**: open → in_progress → replied → closed
