# clio-contract-suggest 설계서

> **요약**: 계약서 리스크 분석 결과에서 선택한 조항을 pgvector로 관련 법령 조문을 검색하고 GPT-4o가 수정 제안문을 생성하며, 원본 파일(DOCX/HWPX/PDF/HWP)에 수정 조항을 적용하여 다운로드할 수 있는 기능
>
> **프로젝트**: CLIO
> **버전**: v6.5.0 (목표)
> **작성자**: 크로미 (Frontend Architect Agent)
> **작성일**: 2026-04-16
> **상태**: Draft
> **선행 기능**: [clio-contract-risk.design.md](./clio-contract-risk.design.md)

---

## 1. 개요

### 1-1. 기능 요약

계약서 리스크 분석(`contract-risk`) 결과 페이지에서 사용자가 수정 제안을 원하는 리스크 항목을 선택하면, CLIO가 pgvector로 관련 법령 조문(민법·하도급법 등)을 유사도 검색하고 GPT-4o가 원문 조항 + 법령 근거를 바탕으로 구체적인 수정 제안문과 수정 이유를 생성한다. 사용자는 제안을 항목별로 승인 또는 건너뛰고, 최종적으로 수락된 조항이 반영된 DOCX 또는 HWPX 파일을 다운로드한다.

### 1-2. 기술 스택

| 구분 | 기술 |
|------|------|
| 프레임워크 | Next.js 16 (App Router) |
| 언어 | TypeScript |
| 인증/DB | Supabase Auth + PostgreSQL + pgvector(이미 구성됨) |
| AI 엔진 | OpenAI GPT-4o + text-embedding-3-small |
| 파일 추출 | 기존 `lib/extractors/` (DOCX/HWPX/PDF) + node-hwp(HWP) |
| 파일 재생성 | PizZip(DOCX), ZIP XML 조작(HWPX) |
| 스토리지 | Supabase Storage (`contract-files` 버킷) |
| UI 스타일 | Tailwind CSS (기존 CLIO 스타일 시스템 준수) |

### 1-3. 사용자 시나리오

```
[contract-risk/[id] 결과 페이지]
  ↓ "⚖️ 조항 수정 제안" 버튼 클릭 (현재 ClauseFixModal 위치)
  ↓ 좌측 사이드바에서 수정 제안받을 리스크 항목 선택 (복수 선택 가능)
  ↓ "수정 제안 받기" → POST /api/contract-risk/[id]/suggest 호출
  ↓ 우측 패널: 원문 조항 → 관련 법령 카드 → 수정 제안문 순차 표시
  ↓ [이 조항 적용] / [건너뜀] 버튼으로 항목별 의사결정
  ↓ 하단 BulkApplyBar에서 파일 형식(DOCX/HWPX) 선택 후 다운로드
  ↓ POST /api/contract-risk/[id]/apply → 수정 파일 signed URL 반환
  ↓ 파일 자동 다운로드
```

---

## 2. 데이터베이스 설계

### 2-1. law_chunks 테이블

마이그레이션 파일: `supabase/migrations/015_law_chunks.sql`

```sql
CREATE TABLE law_chunks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  law_name    TEXT NOT NULL,        -- '민법', '하도급법', '상법', '개인정보보호법' 등
  article_no  TEXT NOT NULL,        -- '제13조'
  clause_no   TEXT,                 -- '②항' (선택 — NULL이면 전체 조문)
  content     TEXT NOT NULL,        -- 조문 원문
  embedding   vector(1536),         -- text-embedding-3-small 차원
  category    TEXT NOT NULL,        -- 'payment'|'penalty'|'termination'|'privacy'|'general'
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ivfflat 인덱스 (cosine 유사도 검색용)
CREATE INDEX ON law_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- category 기반 사전 필터링용 인덱스
CREATE INDEX idx_law_chunks_category ON law_chunks (category);

-- RLS 활성화
ALTER TABLE law_chunks ENABLE ROW LEVEL SECURITY;

-- 인증 여부 무관하게 모든 사용자 읽기 허용 (법령은 공공정보)
CREATE POLICY "Public read" ON law_chunks FOR SELECT USING (true);
```

### 2-2. law_chunks 레코드 예시

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "law_name": "하도급법",
  "article_no": "제13조",
  "clause_no": "①항",
  "content": "원사업자는 수급사업자에게 제조 등의 위탁을 한 경우에는 목적물 등의 수령일부터 60일 이내의 가능한 짧은 기한으로 정한 지급기일까지 하도급대금을 지급하여야 한다.",
  "category": "payment",
  "created_at": "2026-04-16T00:00:00Z"
}
```

### 2-3. category 분류 기준

| category 값 | 대응 계약 조항 유형 | 관련 법령 예시 |
|------------|------------------|--------------|
| `payment` | 대금 지급, 지급기한, 지체상금 | 하도급법 제13조, 민법 제387조 |
| `penalty` | 손해배상, 위약금, 책임한도 | 민법 제398조, 제393조 |
| `termination` | 계약 해지, 해제, 중도 종료 | 민법 제543조, 제544조 |
| `privacy` | 개인정보 처리, 비밀유지 | 개인정보보호법 제26조 |
| `general` | 지식재산권, 검수, 완료기준 등 기타 | 저작권법 제9조, 상법 제47조 |

---

## 3. TypeScript 타입 정의

### 3-1. 신규 타입 파일: `lib/types/contract-suggest.ts`

```typescript
// ─── 법령 조문 ───────────────────────────────────────────────────────────────

/** law_chunks 테이블 레코드 */
export interface LawChunk {
  id: string;
  law_name: string;     // '민법', '하도급법' 등
  article_no: string;   // '제13조'
  clause_no: string | null; // '②항' | null
  content: string;      // 조문 원문
  category: LawCategory;
  similarity?: number;  // cosine 유사도 (0~1, 검색 결과에만 포함)
}

export type LawCategory = 'payment' | 'penalty' | 'termination' | 'privacy' | 'general';

// ─── 수정 제안 ────────────────────────────────────────────────────────────────

/** 단일 조항에 대한 수정 제안 */
export interface SuggestionItem {
  item_key: string;         // 리스크 항목 ID ('A-02', 'B-04' 등)
  item_name: string;        // 리스크 항목명 ('손해배상 무제한 책임' 등)
  original: string;         // 원문 발췌 (RiskItem.excerpt)
  laws: LawChunk[];         // 관련 법령 조문 (top 3)
  revised: string;          // GPT-4o가 생성한 수정 제안 조항 전문
  reason: string;           // 수정 이유 (법령 근거 포함, 2~3문장)
}

/** POST /api/contract-risk/[id]/suggest 요청 바디 */
export interface SuggestRequest {
  item_keys: string[];      // 수정 제안 원하는 리스크 항목 키 목록
}

/** POST /api/contract-risk/[id]/suggest 응답 */
export interface SuggestResponse {
  suggestions: SuggestionItem[];
}

// ─── 적용 ────────────────────────────────────────────────────────────────────

/** 적용할 단일 조항 교체 정보 */
export interface ApplyTarget {
  item_key: string;
  revised: string;          // 사용자가 수락한 수정 제안문
}

/** POST /api/contract-risk/[id]/apply 요청 바디 */
export interface ApplyRequest {
  suggestions: ApplyTarget[];
  outputFormat: 'docx' | 'hwpx';
}

/** POST /api/contract-risk/[id]/apply 응답 */
export interface ApplyResponse {
  signedUrl: string;        // Supabase Storage signed URL (60분 유효)
  fileName: string;         // 다운로드 파일명
}

// ─── UI 상태 ─────────────────────────────────────────────────────────────────

/** 조항별 사용자 결정 상태 */
export type DecisionStatus = 'pending' | 'accepted' | 'skipped';

/** UI에서 관리하는 제안 항목 상태 */
export interface SuggestionState extends SuggestionItem {
  decision: DecisionStatus;
}

/** POST /api/laws/seed 요청 바디 (관리자용) */
export interface LawSeedRequest {
  chunks: Omit<LawChunk, 'id' | 'similarity'>[];
}

/** POST /api/laws/seed 응답 (관리자용) */
export interface LawSeedResponse {
  inserted: number;
  failed: number;
  errors?: string[];
}
```

---

## 4. API 설계

### 4-1. 엔드포인트 목록

| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|------|
| POST | `/api/contract-risk/[id]/suggest` | 선택 조항 수정 제안 생성 | 필수 |
| POST | `/api/contract-risk/[id]/apply` | 수락된 조항 파일에 반영 후 다운로드 URL 반환 | 필수 |
| POST | `/api/laws/seed` | 법령 청크 삽입 + 임베딩 생성 (관리자 전용) | 서비스 키 |

---

### 4-2. POST /api/contract-risk/[id]/suggest

선택한 리스크 항목들의 원문 조항을 pgvector로 유사 법령 검색 후 GPT-4o에게 수정 제안문을 생성하도록 요청한다.

**Request Body**:

```typescript
{
  item_keys: string[];   // 예: ['A-02', 'B-04', 'C-02']
}
```

**Response (200 OK)**:

```typescript
{
  suggestions: Array<{
    item_key: string;       // 'A-02'
    item_name: string;      // '손해배상 무제한 책임'
    original: string;       // 원문 발췌
    laws: Array<{
      id: string;
      law_name: string;     // '민법'
      article_no: string;   // '제398조'
      clause_no: string | null;
      content: string;      // 조문 원문
      similarity: number;   // 0.87
    }>;
    revised: string;        // 수정 제안 조항 전문
    reason: string;         // 수정 이유 (법령 근거 포함)
  }>
}
```

**처리 흐름**:

```
1. 인증 확인 (Supabase session)
2. UUID 형식 검증
3. contract_risk_analyses에서 해당 id 레코드 조회 (user_id 일치 확인)
4. risk_result.items에서 item_keys에 해당하는 RiskItem 필터링
   └─ found=false 항목도 포함 (원문이 없으면 원문 없음 명시)
5. item_key별로 병렬 처리 (Promise.allSettled):
   a. RiskItem.excerpt → text-embedding-3-small 임베딩 생성
   b. pgvector cosine 유사도 검색 (law_chunks, top 3)
   c. GPT-4o 호출: 원문 + 법령 조문 → revised + reason 생성
6. 결과 조립 → SuggestResponse 반환
```

**pgvector 검색 쿼리** (Supabase RPC 함수):

```sql
-- supabase/migrations/015_law_chunks.sql 에 함께 생성
CREATE OR REPLACE FUNCTION match_law_chunks(
  query_embedding vector(1536),
  match_count      INT DEFAULT 3,
  filter_category  TEXT DEFAULT NULL
)
RETURNS TABLE (
  id          UUID,
  law_name    TEXT,
  article_no  TEXT,
  clause_no   TEXT,
  content     TEXT,
  category    TEXT,
  similarity  FLOAT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    id, law_name, article_no, clause_no, content, category,
    1 - (embedding <=> query_embedding) AS similarity
  FROM law_chunks
  WHERE (filter_category IS NULL OR category = filter_category)
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
```

**GPT-4o 프롬프트 구조**:

```typescript
// System
const systemPrompt = `
당신은 한국 IT 계약 분야의 법률 검토 전문가입니다.
계약서의 불리하거나 누락된 조항을 수정하는 데 있어 한국 법령(민법, 하도급법 등)을 근거로
구체적이고 실무에서 바로 사용 가능한 수정 조항문을 작성합니다.

응답 형식 (JSON only):
{
  "revised": "수정 제안 조항 전문 (계약서에 바로 삽입 가능한 완전한 문장)",
  "reason": "수정 이유 (어떤 법령 조문을 근거로 어떻게 보호받는지 2~3문장)"
}

작성 기준:
- revised는 원문 조항을 대체할 수 있는 완전한 조항문으로 작성합니다.
- 제공된 법령 조문의 핵심 요건을 반영합니다.
- reason은 법령 조문명(조항 번호 포함)을 명시합니다.
- 법적 조언이 아닌 참고 자료임을 과도하게 단정하지 않습니다.
`;

// User (항목별 호출)
const userPrompt = `
[리스크 항목] ${item_name} (${item_key})

[원문 조항]
${original || '(해당 조항이 계약서에 존재하지 않아 신규 추가가 필요합니다.)'}

[관련 법령 조문]
${laws.map(l => `${l.law_name} ${l.article_no}${l.clause_no ? ' ' + l.clause_no : ''}: ${l.content}`).join('\n\n')}

위 정보를 바탕으로 수정 제안 조항과 이유를 JSON 형식으로 작성하세요.
`;
```

**OpenAI 호출 옵션**:

```typescript
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ],
  response_format: { type: 'json_object' },
  temperature: 0.3,
  max_tokens: 1500,  // 단일 조항 수정 제안 충분
});
```

**에러 응답**:

```typescript
// 400: item_keys가 비어 있음
{ error: 'INVALID_REQUEST', message: '수정 제안받을 항목을 선택해주세요.' }

// 404: 분석 결과 없음 또는 타인 레코드
{ error: 'NOT_FOUND', message: '분석 결과를 찾을 수 없습니다.' }

// 502: GPT-4o API 오류
{ error: 'AI_SUGGEST_FAILED', message: 'AI 수정 제안 생성 중 오류가 발생했습니다.' }
```

---

### 4-3. POST /api/contract-risk/[id]/apply

사용자가 수락한 조항 교체 목록을 원본 계약서 파일에 적용하고 수정된 파일을 Supabase Storage에 업로드 후 signed URL을 반환한다.

**Request Body**:

```typescript
{
  suggestions: Array<{
    item_key: string;
    revised: string;
  }>;
  outputFormat: 'docx' | 'hwpx';
}
```

**Response (200 OK)**:

```typescript
{
  signedUrl: string;   // 60분 유효 Supabase Storage signed URL
  fileName: string;    // '계약서명_수정제안_20260416.docx'
}
```

**처리 흐름**:

```
1. 인증 확인 + 레코드 조회 (user_id 일치 확인)
2. contract_risk_analyses.raw_text가 null이면:
   → Supabase Storage에서 원본 파일 다운로드 (file_name 기준)
   → lib/extractors/ 로 텍스트 재추출
3. suggestions 배열의 각 item_key에 대해:
   a. RiskItem.excerpt(원문 발췌)를 찾아 raw_text에서 위치 탐색
   b. 해당 위치의 텍스트를 revised로 교체 (clause-replacer.ts)
4. outputFormat 기준 파일 재생성:
   'docx' → PizZip으로 word/document.xml 조작
   'hwpx' → ZIP XML 구조에서 content.hml 조작
5. 수정 파일을 Supabase Storage 업로드
   버킷: 'contract-files'
   경로: '{user_id}/revised/{id}_{timestamp}.{ext}'
6. createSignedUrl (60분) → 반환
```

**에러 응답**:

```typescript
// 400: suggestions가 비어 있음
{ error: 'INVALID_REQUEST', message: '적용할 수정 조항이 없습니다.' }

// 404: 분석 결과 없음 또는 원본 파일 없음
{ error: 'NOT_FOUND', message: '원본 계약서 파일을 찾을 수 없습니다.' }

// 422: 조항 교체 실패 (원문 발췌 텍스트를 파일에서 찾지 못함)
{ error: 'CLAUSE_NOT_FOUND', message: '일부 조항을 원본 파일에서 찾지 못했습니다. 수동 수정을 권장합니다.' }

// 502: 파일 재생성 오류
{ error: 'FILE_GENERATION_FAILED', message: '수정 파일 생성 중 오류가 발생했습니다.' }
```

---

### 4-4. POST /api/laws/seed (관리자 전용)

법령 청크 데이터를 DB에 삽입하고 각 청크에 대한 text-embedding-3-small 임베딩을 생성한다.

**인증**: `Authorization: Bearer {SUPABASE_SERVICE_ROLE_KEY}` 헤더 필수

**Request Body**:

```typescript
{
  chunks: Array<{
    law_name: string;
    article_no: string;
    clause_no?: string;
    content: string;
    category: 'payment' | 'penalty' | 'termination' | 'privacy' | 'general';
  }>
}
```

**Response (200 OK)**:

```typescript
{
  inserted: number;
  failed: number;
  errors?: string[];
}
```

**처리 흐름**:

```
1. Service Role Key 검증
2. 각 청크에 대해 배치 처리 (10개 단위):
   a. text-embedding-3-small API 호출 → vector(1536)
   b. law_chunks INSERT (embedding 포함)
3. 결과 집계 → { inserted, failed, errors } 반환
```

---

## 5. 컴포넌트 설계

### 5-1. 컴포넌트 목록

| 컴포넌트 | 경로 | 역할 |
|----------|------|------|
| 분석 결과 페이지 (재구성) | `app/(app)/contract-risk/[id]/page.tsx` | 기존 + SuggestionPanel 통합 |
| RiskItemSidebar | `components/contract-risk/RiskItemSidebar.tsx` | 리스크 조항 목록, 선택 UI |
| SuggestionPanel | `components/contract-risk/SuggestionPanel.tsx` | 우측 수정 제안 전체 패널 |
| LawReferenceCard | `components/contract-risk/LawReferenceCard.tsx` | 관련 법령 조문 카드 |
| RevisedClauseBox | `components/contract-risk/RevisedClauseBox.tsx` | 수정 제안문 + 수정 이유 |
| BulkApplyBar | `components/contract-risk/BulkApplyBar.tsx` | 하단 고정 바 (적용 수 + 다운로드) |

---

### 5-2. 분석 결과 페이지 재구성 (`[id]/page.tsx`)

기존 단일 컬럼 레이아웃을 수정 제안 UI가 활성화되면 2컬럼(사이드바 + 패널)으로 전환한다.

**주요 클라이언트 상태**:

```typescript
// 기존 상태 유지
const [analysis, setAnalysis] = useState<ContractRiskAnalysis | null>(null);
const [filter, setFilter] = useState<RiskFilterState>({ level: 'all', category: 'all' });

// 신규: 수정 제안 UI 상태
const [suggestMode, setSuggestMode] = useState(false);
const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
const [suggestions, setSuggestions] = useState<SuggestionState[]>([]);
const [activeKey, setActiveKey] = useState<string | null>(null);
const [isSuggesting, setIsSuggesting] = useState(false);
const [isApplying, setIsApplying] = useState(false);
const [outputFormat, setOutputFormat] = useState<'docx' | 'hwpx'>('docx');
```

**레이아웃 전환 로직**:

```typescript
// suggestMode=false: 기존 단일 컬럼 레이아웃
// suggestMode=true: 2컬럼 (좌 RiskItemSidebar 320px + 우 SuggestionPanel flex-1)

const handleSuggestStart = async () => {
  if (selectedKeys.size === 0) return;
  setIsSuggesting(true);
  const res = await fetch(`/api/contract-risk/${id}/suggest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ item_keys: Array.from(selectedKeys) }),
  });
  const json = await res.json();
  setSuggestions(json.suggestions.map((s: SuggestionItem) => ({ ...s, decision: 'pending' })));
  setActiveKey(json.suggestions[0]?.item_key ?? null);
  setIsSuggesting(false);
};
```

---

### 5-3. RiskItemSidebar 컴포넌트

```typescript
interface RiskItemSidebarProps {
  items: RiskItem[];                   // found=true인 항목들
  selectedKeys: Set<string>;
  onToggleSelect: (key: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  activeKey: string | null;
  onActivate: (key: string) => void;
  suggestions: SuggestionState[];      // 제안 생성 후 상태 확인용
  isSuggesting: boolean;
  onSuggestStart: () => void;          // "수정 제안 받기" 버튼 핸들러
}
```

**시각적 구성**:

```
┌──────────────────────────────────────┐
│ 조항 목록             [전체선택] [해제] │
├──────────────────────────────────────┤
│ ☑ 🔴 A-02  손해배상 무제한 책임       │  ← accepted: 초록 테두리
│ ☑ 🔴 B-01  계약 목적물 명세 누락      │  ← pending: 기본
│ ☐ 🟡 A-05  대금 지급 기한 과도        │  ← skipped: 회색
│ ☑ 🟡 B-03  검수 기준 미정의           │
│ ─────────────────────────────────── │
│         [수정 제안 받기 (3개)]        │
└──────────────────────────────────────┘
```

**항목 상태별 스타일**:

| decision | 배경색 | 테두리 | 텍스트 |
|----------|--------|--------|--------|
| `pending` | `#FFF` | `#E2E5EA` | `#1B1F2B` |
| `accepted` | `#F0FDF4` | `#86EFAC` | `#166534` |
| `skipped` | `#F7F8FA` | `#E2E5EA` | `#9CA3AF` |

---

### 5-4. SuggestionPanel 컴포넌트

```typescript
interface SuggestionPanelProps {
  suggestion: SuggestionState | null;   // 현재 활성 항목
  onAccept: (key: string) => void;
  onSkip: (key: string) => void;
  isLoading: boolean;                   // 제안 생성 중
}
```

**내부 구성 (세로 스택)**:

```
SuggestionPanel
├── 항목 헤더 (item_key + item_name + 리스크 레벨 배지)
├── OriginalClause
│   ├── 레이블: "원문 조항"
│   └── 회색 배경 박스 (original 텍스트)
├── LawReferenceCard × N (laws 배열 순서대로)
├── RevisedClauseBox
│   ├── revised 텍스트 (파란 배경 박스)
│   └── reason 텍스트 (회색 소형)
└── ActionButtons
    ├── [이 조항 적용]  ← 클릭 시 decision='accepted'
    └── [건너뜀]        ← 클릭 시 decision='skipped'
```

---

### 5-5. LawReferenceCard 컴포넌트

```typescript
interface LawReferenceCardProps {
  law: LawChunk;
  index: number;   // 1, 2, 3 (참조 번호 표시용)
}
```

**카드 구성**:

```
┌──────────────────────────────────────────────┐
│ [1]  민법 제398조 ②항           유사도 87%    │
│                                              │
│ 당사자는 손해배상액의 예정을 한 경우에...      │
│ (조문 원문 최대 150자, 초과 시 접기)           │
└──────────────────────────────────────────────┘
```

**Props 타입 상세**:

```typescript
interface LawReferenceCardProps {
  law: LawChunk & { similarity: number };
  index: number;
}
```

**스타일**: 배경 `#EEF3FE`, 테두리 `#C7D9FB`, 법령명 텍스트 `#2E6FF2 font-semibold`

---

### 5-6. RevisedClauseBox 컴포넌트

```typescript
interface RevisedClauseBoxProps {
  revised: string;
  reason: string;
  onCopy: () => void;  // 수정 제안문 클립보드 복사
}
```

**구성**:

```
┌──────────────────────────────────────────────┐
│ 수정 제안 조항                         [복사] │
│ ┌────────────────────────────────────────┐   │
│ │ 갑이 을에게 지급하는 손해배상액은 본    │   │
│ │ 계약의 계약금액을 초과하지 아니한다.   │   │
│ │ 다만, 갑의 고의 또는 중과실로 인한...  │   │
│ └────────────────────────────────────────┘   │
│                                              │
│ 수정 이유                                    │
│ 민법 제398조 ②항에 따르면 손해배상 예정액이  │
│ 부당히 과다한 경우 법원이 감액할 수 있으나,  │
│ 계약금액 초과 책임 제한 조항이 명시될 때...  │
└──────────────────────────────────────────────┘
```

---

### 5-7. BulkApplyBar 컴포넌트

하단에 고정되는 액션 바. `accepted` 상태 항목이 1개 이상일 때 표시.

```typescript
interface BulkApplyBarProps {
  acceptedCount: number;
  totalCount: number;
  outputFormat: 'docx' | 'hwpx';
  onFormatChange: (format: 'docx' | 'hwpx') => void;
  onDownload: () => void;
  isApplying: boolean;
}
```

**시각적 구성**:

```
┌──────────────────────────────────────────────────────────────────┐
│  ✓ 3개 조항 수락됨 / 전체 5개    [DOCX ▼] [HWPX]   [파일 다운로드] │
└──────────────────────────────────────────────────────────────────┘
```

**스타일**: `position: fixed; bottom: 0; left: 0; right: 0; z-index: 30`
배경 `#1B1F2B`, 텍스트 `white`, 다운로드 버튼 `bg-[#2E6FF2]`

---

### 5-8. 인쇄 레이아웃 (`@media print`)

분석 결과 페이지에서 브라우저 인쇄 시 적용되는 레이아웃. 사이드바·패널 UI 숨기고 테이블 리포트로 전환.

```typescript
// 페이지 내 PrintReport 섹션 (hidden print:block)
interface PrintReportProps {
  analysis: ContractRiskAnalysis;
  suggestions: SuggestionState[];   // accepted 항목만 출력
}
```

**인쇄 구조**:

```
┌─────────────────────────────────────────────────────────────────┐
│  CLIO 법령 기반 계약 조항 수정 제안 리포트                        │
│  계약서: {file_name}  |  분석일: {created_at}  |  수정 제안일: 오늘│
│  ⚠ 본 리포트는 AI 참고 자료이며 법적 조언이 아닙니다.            │
├──────────┬──────────────────────┬──────────────────────────────┤
│ 항목     │ 관련 법령             │ 수정 제안 조항                │
├──────────┼──────────────────────┼──────────────────────────────┤
│ A-02     │ 민법 제398조 ②항     │ 갑이 을에게 지급하는...       │
│ 손해배상 │ 하도급법 제35조      │                              │
│ 무제한   ├──────────────────────┤                              │
│ 책임     │ [수정 이유]           │                              │
│          │ 민법 제398조에 따라…  │                              │
├──────────┼──────────────────────┼──────────────────────────────┤
│ ...      │ ...                  │ ...                          │
└──────────┴──────────────────────┴──────────────────────────────┘
```

---

### 5-9. 전체 페이지 와이어프레임 (ASCII)

**수정 제안 모드 활성화 후**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CLIO  >  계약서 리스크 분석  >  시스템구축계약서_ABC사.docx                    │
│                               [조항 수정 제안 모드]         [DOCX 리포트 ↓]  │
├────────────────────────┬────────────────────────────────────────────────────┤
│  조항 목록  [전체] [해제]│  A-02  손해배상 무제한 책임          🔴 상           │
│ ──────────────────── │  ──────────────────────────────────────────────── │
│ ✓ 🔴 A-02 손해배상...  │  원문 조항                                         │
│ ✓ 🔴 B-01 목적물...   │  ┌──────────────────────────────────────────────┐  │
│ ○ 🟡 A-05 대금지급... │  │ "...모든 손해에 대하여 제한 없이 배상하여야  │  │
│ ✓ 🟡 B-03 검수기준... │  │  한다."                                      │  │
│                        │  └──────────────────────────────────────────────┘  │
│                        │                                                    │
│                        │  관련 법령                                          │
│                        │  ┌──────────────────────────────────────────────┐  │
│                        │  │ [1]  민법 제398조 ②항          유사도 87%    │  │
│                        │  │ 당사자는 손해배상액의 예정을 한 경우...      │  │
│                        │  └──────────────────────────────────────────────┘  │
│                        │  ┌──────────────────────────────────────────────┐  │
│                        │  │ [2]  하도급법 제35조           유사도 79%    │  │
│                        │  │ 원사업자가 부당하게 수급사업자에게...        │  │
│                        │  └──────────────────────────────────────────────┘  │
│                        │                                                    │
│                        │  수정 제안 조항                            [복사]   │
│                        │  ┌──────────────────────────────────────────────┐  │
│ ──────────────────── │  │ 갑이 을에게 지급하는 손해배상액은 본 계약의  │  │
│ [수정 제안 받기 (3개)]  │  │ 계약금액을 초과하지 아니한다...             │  │
│                        │  └──────────────────────────────────────────────┘  │
│                        │  수정 이유                                          │
│                        │  민법 제398조 ②항에 의거, 부당히 과다한 손해배상   │
│                        │  예정액은 감액 청구가 가능하나...                   │
│                        │                                                    │
│                        │              [건너뜀]  [이 조항 적용 ✓]            │
├────────────────────────┴────────────────────────────────────────────────────┤
│  ✓ 2개 조항 수락됨 / 전체 3개          [DOCX]  [HWPX]    [수정 파일 다운로드] │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. 신규 파일 목록

```
src/
├── app/
│   ├── (app)/contract-risk/[id]/page.tsx          ← 기존 파일 재구성 (suggestMode 추가)
│   └── api/
│       ├── contract-risk/[id]/suggest/route.ts    ← 신규
│       ├── contract-risk/[id]/apply/route.ts      ← 신규
│       └── laws/seed/route.ts                     ← 신규 (관리자용)
├── components/contract-risk/
│   ├── RiskItemSidebar.tsx                        ← 신규
│   ├── SuggestionPanel.tsx                        ← 신규
│   ├── LawReferenceCard.tsx                       ← 신규
│   ├── RevisedClauseBox.tsx                       ← 신규
│   └── BulkApplyBar.tsx                           ← 신규
└── lib/
    ├── types/
    │   └── contract-suggest.ts                    ← 신규 (타입 정의)
    ├── laws/
    │   ├── law-seed-data.ts                       ← 신규 (법령 원문 데이터)
    │   └── law-embedder.ts                        ← 신규 (법령 임베딩 생성)
    └── contract-suggest/
        ├── clause-extractor.ts                    ← 신규 (파일 타입별 텍스트 추출)
        └── clause-replacer.ts                     ← 신규 (조항 교체 + 파일 재생성)

supabase/
└── migrations/
    └── 015_law_chunks.sql                         ← 신규 (테이블 + RPC 함수)
```

---

## 7. 유틸리티 서비스 설계

### 7-1. `lib/laws/law-embedder.ts`

법령 청크 텍스트에 대한 임베딩을 생성하는 유틸리티.

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * 단일 텍스트에 대한 text-embedding-3-small 임베딩 반환
 * @returns number[] (1536차원)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000),  // 토큰 제한 안전 처리
  });
  return response.data[0].embedding;
}

/**
 * 배치 임베딩 생성 (최대 10개씩 병렬)
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  batchSize = 10
): Promise<number[][]> {
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const embeddings = await Promise.all(batch.map(generateEmbedding));
    results.push(...embeddings);
  }
  return results;
}
```

---

### 7-2. `lib/contract-suggest/clause-extractor.ts`

파일 타입별 텍스트 추출 (기존 `lib/extractors/` 확장).

```typescript
import type { ContractRiskAnalysis } from '@/lib/types/contract-risk';

export type SupportedFormat = 'docx' | 'hwpx' | 'pdf' | 'hwp';

/**
 * Supabase Storage에서 원본 파일을 다운로드하고 텍스트를 추출한다.
 * raw_text가 이미 있는 경우 DB 값을 우선 사용한다.
 */
export async function extractTextFromAnalysis(
  analysis: ContractRiskAnalysis,
  fileBuffer?: ArrayBuffer
): Promise<string> {
  // raw_text가 DB에 있으면 재추출 생략
  if (analysis.raw_text) return analysis.raw_text;
  if (!fileBuffer) throw new Error('파일 버퍼가 필요합니다.');
  return extractByFileType(fileBuffer, analysis.file_type as SupportedFormat);
}

async function extractByFileType(
  buffer: ArrayBuffer,
  format: SupportedFormat
): Promise<string> {
  switch (format) {
    case 'docx':
      // 기존 lib/extractors/docx.ts 재사용
      const { extractDocxText } = await import('@/lib/extractors/docx');
      return extractDocxText(Buffer.from(buffer));
    case 'hwpx':
      // 기존 lib/extractors/hwpx.ts 재사용
      const { extractHwpxText } = await import('@/lib/extractors/hwpx');
      return extractHwpxText(Buffer.from(buffer));
    case 'pdf':
      const { extractPdfText } = await import('@/lib/extractors/pdf');
      return extractPdfText(Buffer.from(buffer));
    default:
      throw new Error(`지원하지 않는 파일 형식: ${format}`);
  }
}
```

---

### 7-3. `lib/contract-suggest/clause-replacer.ts`

원문 조항을 수정 제안문으로 교체하고 파일을 재생성한다.

```typescript
import type { ApplyTarget } from '@/lib/types/contract-suggest';

export interface ReplacementResult {
  buffer: Buffer;
  notFound: string[];  // 원문을 파일에서 찾지 못한 item_key 목록
}

/**
 * DOCX 파일에서 원문 발췌를 찾아 수정 제안문으로 교체 후 Buffer 반환
 */
export async function replaceClausesInDocx(
  originalBuffer: Buffer,
  targets: ApplyTarget[],
  excerpts: Record<string, string>  // item_key → 원문 발췌
): Promise<ReplacementResult> {
  const PizZip = (await import('pizzip')).default;
  const Docxtemplater = (await import('docxtemplater')).default;

  const zip = new PizZip(originalBuffer);
  // word/document.xml 직접 조작
  let xml = zip.files['word/document.xml'].asText();
  const notFound: string[] = [];

  for (const target of targets) {
    const original = excerpts[target.item_key];
    if (!original) continue;
    // XML 이스케이프 처리 후 교체
    const escapedOriginal = escapeXml(original);
    const escapedRevised = escapeXml(target.revised);
    if (!xml.includes(escapedOriginal)) {
      notFound.push(target.item_key);
      continue;
    }
    xml = xml.replace(escapedOriginal, escapedRevised);
  }

  zip.file('word/document.xml', xml);
  return {
    buffer: zip.generate({ type: 'nodebuffer' }),
    notFound,
  };
}

/**
 * HWPX 파일에서 조항 교체 (ZIP XML 구조 조작)
 */
export async function replaceClausesInHwpx(
  originalBuffer: Buffer,
  targets: ApplyTarget[],
  excerpts: Record<string, string>
): Promise<ReplacementResult> {
  const AdmZip = (await import('adm-zip')).default;
  const zip = new AdmZip(originalBuffer);
  let xml = zip.readAsText('Contents/content.hml');
  const notFound: string[] = [];

  for (const target of targets) {
    const original = excerpts[target.item_key];
    if (!original || !xml.includes(original)) {
      if (original) notFound.push(target.item_key);
      continue;
    }
    xml = xml.replace(original, target.revised);
  }

  zip.updateFile('Contents/content.hml', Buffer.from(xml, 'utf-8'));
  return {
    buffer: zip.toBuffer(),
    notFound,
  };
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
```

---

## 8. 법령 시드 데이터 구조 (`lib/laws/law-seed-data.ts`)

```typescript
import type { LawChunk } from '@/lib/types/contract-suggest';

type SeedChunk = Omit<LawChunk, 'id' | 'similarity'>;

export const LAW_SEED_DATA: SeedChunk[] = [
  // ── 지급 관련 ──────────────────────────────────────────────────────────────
  {
    law_name: '하도급법',
    article_no: '제13조',
    clause_no: '①항',
    content: '원사업자는 수급사업자에게 제조 등의 위탁을 한 경우에는 목적물 등의 수령일부터 60일 이내의 가능한 짧은 기한으로 정한 지급기일까지 하도급대금을 지급하여야 한다.',
    category: 'payment',
  },
  {
    law_name: '민법',
    article_no: '제387조',
    clause_no: '①항',
    content: '채무의 이행기가 도래하면 채권자는 그 이행을 청구할 수 있고, 채무자는 지체 없이 이행하여야 한다.',
    category: 'payment',
  },

  // ── 손해배상·위약금 ─────────────────────────────────────────────────────────
  {
    law_name: '민법',
    article_no: '제393조',
    clause_no: null,
    content: '채무불이행으로 인한 손해배상은 통상의 손해를 그 한도로 한다. 특별한 사정으로 인한 손해는 채무자가 그 사정을 알았거나 알 수 있었을 때에 한하여 배상의 책임이 있다.',
    category: 'penalty',
  },
  {
    law_name: '민법',
    article_no: '제398조',
    clause_no: '②항',
    content: '손해배상액의 예정은 그 이행을 강제함을 목적으로 한다. 예정액이 부당히 과다한 경우에는 법원은 적당히 감액할 수 있다.',
    category: 'penalty',
  },

  // ── 계약 해지 ──────────────────────────────────────────────────────────────
  {
    law_name: '민법',
    article_no: '제543조',
    clause_no: null,
    content: '계약 또는 법률의 규정에 의하여 당사자의 일방이 해제권을 가지는 때에는 그 해제는 상대방에 대한 의사표시로 한다.',
    category: 'termination',
  },
  {
    law_name: '민법',
    article_no: '제544조',
    clause_no: null,
    content: '당사자 일방이 그 채무를 이행하지 아니하는 때에는 상대방은 상당한 기간을 정하여 그 이행을 최고하고 그 기간 내에 이행하지 아니한 때에는 계약을 해제할 수 있다.',
    category: 'termination',
  },

  // ── 개인정보 ───────────────────────────────────────────────────────────────
  {
    law_name: '개인정보보호법',
    article_no: '제26조',
    clause_no: '①항',
    content: '개인정보처리자가 제3자에게 개인정보의 처리 업무를 위탁하는 경우에는 위탁하는 업무의 내용과 수탁자를 정보주체가 언제든지 쉽게 확인할 수 있도록 공개하여야 한다.',
    category: 'privacy',
  },

  // ── 지식재산권·기타 ─────────────────────────────────────────────────────────
  {
    law_name: '저작권법',
    article_no: '제9조',
    clause_no: null,
    content: '법인·단체 그 밖의 사용자(이하 "법인 등"이라 한다)의 기획 하에 법인 등의 업무에 종사하는 자가 업무상 작성하는 저작물로서 법인 등이 저작자로 결정되는 경우에는 그 저작물의 저작자는 법인 등이 된다.',
    category: 'general',
  },
];
```

---

## 9. 구현 순서 (Phase별 체크리스트)

### Phase 1 — DB + 법령 데이터 (예상: 0.5일)

- [ ] `supabase/migrations/015_law_chunks.sql` 작성 및 실행
  - `law_chunks` 테이블 + ivfflat 인덱스 생성
  - `match_law_chunks` RPC 함수 생성
  - RLS 정책 적용
- [ ] `lib/types/contract-suggest.ts` 타입 정의 파일 생성
- [ ] `lib/laws/law-seed-data.ts` 법령 데이터 작성 (우선순위 법령 30~50개 조문)
- [ ] `lib/laws/law-embedder.ts` 임베딩 유틸리티 구현
- [ ] `app/api/laws/seed/route.ts` 시드 API 구현
- [ ] 시드 API 호출로 law_chunks 데이터 삽입 + 임베딩 생성 검증

### Phase 2 — 수정 제안 API (예상: 1일)

- [ ] `lib/contract-suggest/clause-extractor.ts` 구현
- [ ] `lib/contract-suggest/clause-replacer.ts` 구현
  - DOCX 조항 교체 (PizZip + XML 조작)
  - HWPX 조항 교체 (adm-zip + XML 조작)
- [ ] `app/api/contract-risk/[id]/suggest/route.ts` 구현
  - pgvector 유사도 검색 (`match_law_chunks` RPC 호출)
  - GPT-4o 수정 제안 생성 (항목별 병렬 호출)
  - 에러 처리 (Promise.allSettled 기반)
- [ ] `app/api/contract-risk/[id]/apply/route.ts` 구현
  - 원본 파일 다운로드 (Supabase Storage)
  - 조항 교체 + 파일 재생성
  - 수정 파일 업로드 + signed URL 반환
- [ ] 샘플 계약서 3건으로 suggest → apply 전체 흐름 E2E 검증

### Phase 3 — UI 구현 (예상: 1.5일)

- [ ] `components/contract-risk/RiskItemSidebar.tsx` 구현
  - 항목 선택/해제 체크박스
  - decision 상태별 스타일 적용
  - "수정 제안 받기" 버튼
- [ ] `components/contract-risk/LawReferenceCard.tsx` 구현
  - 유사도 배지
  - 조문 내용 접기/펼치기 (150자 초과 시)
- [ ] `components/contract-risk/RevisedClauseBox.tsx` 구현
  - 복사 버튼 (Clipboard API)
- [ ] `components/contract-risk/SuggestionPanel.tsx` 구현
  - OriginalClause + LawReferenceCard 목록 + RevisedClauseBox + ActionButtons 조립
  - 로딩 스켈레톤 (isSuggesting=true 시)
- [ ] `components/contract-risk/BulkApplyBar.tsx` 구현
  - DOCX/HWPX 형식 선택 토글
  - 수락 건수 표시
- [ ] `app/(app)/contract-risk/[id]/page.tsx` 재구성
  - suggestMode 상태 추가
  - 2컬럼 레이아웃 전환 로직
  - BulkApplyBar 통합
  - @media print 인쇄 레이아웃 추가

### Phase 4 — 검증 (예상: 0.5일)

- [ ] 법령 검색 품질 검증: 5개 리스크 항목별 top-3 법령이 적절한지 수동 확인
- [ ] GPT-4o 수정 제안문 품질 검증: 실무 사용 가능 수준인지 법률 용어 검토
- [ ] DOCX 조항 교체 정확성 검증: 원문 발췌가 XML에서 정확히 교체되는지 확인
- [ ] HWPX 조항 교체 정확성 검증
- [ ] 인쇄 레이아웃 PDF 변환 품질 확인
- [ ] 기존 contract-risk 기능 회귀 테스트 (분석, 이력, 다운로드)

---

## 10. 보안 고려사항

| 항목 | 처리 방식 |
|------|-----------|
| suggest/apply API 인증 | Supabase 세션 인증 필수, user_id 일치 확인 |
| 타인 레코드 접근 | user_id 불일치 시 404 반환 (403 대신 — 존재 여부 노출 방지) |
| seed API 인증 | Service Role Key 헤더 검증 (관리자 전용) |
| law_chunks RLS | `FOR SELECT USING (true)` — 법령은 공공 정보, 쓰기는 서비스 키만 허용 |
| 수정 파일 Storage 경로 | `{user_id}/revised/` 접두사로 사용자별 격리 |
| signed URL 유효기간 | 60분으로 제한 (장기 노출 방지) |
| 원본 파일 미존재 처리 | Storage 조회 실패 시 raw_text fallback, 없으면 명확한 에러 반환 |

---

## 11. 에러 처리 전략

```typescript
// 공통 에러 응답 형식 (기존 clio-contract-risk.design.md 준수)
interface ApiError {
  error: string;   // 에러 코드 (대문자 스네이크)
  message: string; // 사용자 표시용 한글 메시지
}
```

| 시나리오 | HTTP | 에러 코드 | 사용자 메시지 |
|----------|------|-----------|---------------|
| 미인증 요청 | 401 | `UNAUTHORIZED` | 로그인이 필요합니다. |
| 분석 결과 없음/타인 레코드 | 404 | `NOT_FOUND` | 분석 결과를 찾을 수 없습니다. |
| item_keys 빈 배열 | 400 | `INVALID_REQUEST` | 수정 제안받을 항목을 선택해주세요. |
| 법령 검색 결과 없음 | 200 (빈 laws) | - | (UI에서 "관련 법령 없음" 표시) |
| GPT-4o 수정 제안 실패 | 502 | `AI_SUGGEST_FAILED` | AI 수정 제안 생성 중 오류가 발생했습니다. |
| 원본 파일 없음 | 404 | `NOT_FOUND` | 원본 계약서 파일을 찾을 수 없습니다. |
| 조항 교체 위치 못 찾음 | 422 | `CLAUSE_NOT_FOUND` | 일부 조항을 원본 파일에서 찾지 못했습니다. 수동 수정을 권장합니다. |
| 파일 재생성 오류 | 502 | `FILE_GENERATION_FAILED` | 수정 파일 생성 중 오류가 발생했습니다. |
| seed API 인증 실패 | 403 | `FORBIDDEN` | 관리자 권한이 필요합니다. |

---

## 12. 레이어 구조 (Clean Architecture)

| 컴포넌트 | 레이어 | 경로 |
|----------|--------|------|
| RiskItemSidebar, SuggestionPanel, LawReferenceCard, RevisedClauseBox, BulkApplyBar | Presentation | `components/contract-risk/` |
| `[id]/page.tsx` (재구성) | Presentation | `app/(app)/contract-risk/` |
| SuggestItem, SuggestionState, ApplyTarget, LawChunk | Domain | `lib/types/contract-suggest.ts` |
| law-embedder.ts | Application | `lib/laws/` |
| law-seed-data.ts | Application | `lib/laws/` |
| clause-extractor.ts | Application | `lib/contract-suggest/` |
| clause-replacer.ts | Application | `lib/contract-suggest/` |
| suggest/route.ts, apply/route.ts, seed/route.ts | Infrastructure | `app/api/` |
| Supabase 클라이언트 (기존) | Infrastructure | `lib/supabase/` |
| openai.ts (기존) | Infrastructure | `lib/openai.ts` |

---

## 13. 관련 문서

- 선행 설계서: [clio-contract-risk.design.md](./clio-contract-risk.design.md)
- 기존 리스크 타입: `lib/types/contract-risk.ts`
- 기존 파일 추출 파이프라인: `lib/extractors/`
- 기존 DOCX 생성기: `lib/generators/docx-generator.ts`
- 기존 분석 결과 페이지: `src/app/(app)/contract-risk/[id]/page.tsx`
- 기존 리스크 분석 API: `src/app/api/contract-risk/[id]/route.ts`

---

## 버전 이력

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 0.1 | 2026-04-16 | 최초 작성 | 크로미 (Frontend Architect Agent) |
