# memo-insight 설계서

> **요약**: 메모 저장 시 pgvector 임베딩을 자동 생성하고, 유사 메모를 AI가 그룹화하여 섹션으로 표시하며, 그룹 기반 AI 아이디어 제안 및 문서생성 연결까지 제공하는 아이디어 허브 기능
>
> **프로젝트**: CLIO  
> **버전**: v7.1.0 (목표)  
> **작성자**: 크로미  
> **작성일**: 2026-04-20  
> **상태**: Draft  
> **계획서**: [memo-insight.plan.md](../../01-plan/features/memo-insight.plan.md)

---

## 1. 개요

### 1-1. 기능 요약

PC·모바일에서 틈틈이 기록한 메모들을 AI가 의미적으로 분석하여 유사한 메모끼리 자동 그룹화하고, 그룹 단위로 GPT-4o 아이디어 제안을 받아 문서 생성으로 연결하는 아이디어 허브다.  
기존 `lib/ai/embeddings.ts`의 `generateEmbedding()` 함수를 재사용하며, 파일 파이프라인과 동일한 `text-embedding-3-small` 모델을 사용한다.

### 1-2. 전체 데이터 흐름

```
메모 저장/수정 (POST/PATCH /api/memos)
        ↓ fire-and-forget
POST /api/memos/[id]/embed
        ↓
generateEmbedding(title + content)
        ↓
memo_embeddings 테이블 UPSERT
        ↓ (사용자가 그룹 뷰 토글)
GET /api/memos/groups
        ↓
전체 메모 임베딩 로드 → 코사인 유사도 클러스터링
        ↓
GPT-4o-mini로 그룹명 자동 작명
        ↓
memo_groups 캐시 저장 (TTL 1시간)
        ↓ (사용자가 "아이디어 제안받기" 클릭)
POST /api/memos/groups/suggest
        ↓
그룹 내 메모 전체 내용 → GPT-4o 제안 생성
        ↓
IdeaSuggestPanel에 표시
        ↓ (선택)
"문서로 생성" → 기존 문서생성 모달 연결
"메모로 저장" → POST /api/memos
```

### 1-3. 기술 스택

| 구분 | 기술 |
|------|------|
| 프레임워크 | Next.js 16 (App Router) |
| 언어 | TypeScript |
| 인증/DB | Supabase Auth + PostgreSQL + pgvector |
| 임베딩 | OpenAI `text-embedding-3-small` (dim: 1536) |
| AI 제안 | OpenAI GPT-4o |
| 그룹명 작명 | OpenAI GPT-4o-mini |
| 유사도 계산 | pgvector `<=>` 코사인 거리 연산자 |
| UI 스타일 | Tailwind CSS (기존 CLIO 스타일 시스템 준수) |

---

## 2. 데이터베이스 설계

### 2-1. memo_embeddings 테이블

```sql
-- 마이그레이션 파일: supabase/migrations/021_memo_embeddings.sql

CREATE TABLE memo_embeddings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memo_id    UUID NOT NULL REFERENCES memos(id) ON DELETE CASCADE,
  embedding  vector(1536) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(memo_id)
);

-- ivfflat 인덱스 (코사인 유사도 검색)
CREATE INDEX idx_memo_embeddings_vector
  ON memo_embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION update_memo_embeddings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_memo_embeddings_updated_at
  BEFORE UPDATE ON memo_embeddings
  FOR EACH ROW EXECUTE FUNCTION update_memo_embeddings_updated_at();
```

### 2-2. memo_groups 테이블 (클러스터 캐시)

```sql
CREATE TABLE memo_groups (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  memo_ids   UUID[] NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '1 hour'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_memo_groups_user ON memo_groups(user_id, expires_at);
```

### 2-3. RLS 정책

```sql
ALTER TABLE memo_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE memo_groups ENABLE ROW LEVEL SECURITY;

-- memo_embeddings: 메모 소유자만 접근
CREATE POLICY "memo_embeddings_own" ON memo_embeddings
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM memos m
      WHERE m.id = memo_embeddings.memo_id
        AND m.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM memos m
      WHERE m.id = memo_embeddings.memo_id
        AND m.created_by = auth.uid()
    )
  );

-- memo_groups: 본인 그룹만 접근
CREATE POLICY "memo_groups_own" ON memo_groups
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

### 2-4. match_memo_embeddings RPC (유사 메모 검색)

```sql
-- 연관 메모 조회용 RPC
CREATE OR REPLACE FUNCTION match_memo_embeddings(
  query_embedding vector(1536),
  match_user_id   UUID,
  exclude_memo_id UUID,
  match_count     INT DEFAULT 3,
  similarity_threshold FLOAT DEFAULT 0.75
)
RETURNS TABLE (
  memo_id    UUID,
  similarity FLOAT
)
LANGUAGE sql STABLE AS $$
  SELECT
    me.memo_id,
    1 - (me.embedding <=> query_embedding) AS similarity
  FROM memo_embeddings me
  JOIN memos m ON m.id = me.memo_id
  WHERE m.created_by = match_user_id
    AND me.memo_id != exclude_memo_id
    AND 1 - (me.embedding <=> query_embedding) >= similarity_threshold
  ORDER BY me.embedding <=> query_embedding
  LIMIT match_count;
$$;
```

---

## 3. API 설계

### 3-1. POST `/api/memos/[id]/embed`

메모 임베딩 생성·갱신. 메모 저장/수정 후 fire-and-forget으로 호출.

**인증:** 필수 (본인 메모만)

**응답:**
```json
{ "success": true }
```

**처리 로직:**
1. 메모 소유권 확인
2. `title + "\n" + content` 를 `generateEmbedding()`에 전달
3. `memo_embeddings` UPSERT (`ON CONFLICT (memo_id) DO UPDATE`)
4. 메모 수정 시 기존 `memo_groups` 캐시 무효화 (해당 user_id의 만료된 캐시 DELETE)

**에러 처리:**
- OpenAI API 실패 → 500 반환 (fire-and-forget이므로 클라이언트 UX 영향 없음)
- 메모 미존재 → 404

---

### 3-2. GET `/api/memos/groups`

전체 메모 그룹 조회. 유효 캐시 있으면 반환, 없으면 재계산.

**인증:** 필수

**응답:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "SNS 마케팅 전략",
      "memos": [
        { "id": "uuid", "title": "인스타 트렌드", "content": "...", "color": "default", "is_pinned": false }
      ]
    }
  ],
  "ungrouped": [
    { "id": "uuid", "title": "기타 메모", ... }
  ]
}
```

**처리 로직:**
1. `memo_groups`에서 `expires_at > now()` 인 유효 캐시 조회
2. 캐시 HIT: memo_ids로 memos 조회 후 반환
3. 캐시 MISS:
   - 사용자 전체 메모 + 임베딩 로드
   - 임베딩 없는 메모는 `ungrouped`로 분류
   - 코사인 유사도 0.75 이상인 메모 쌍을 Union-Find로 클러스터링
   - 클러스터 2개 미만(단독 메모)은 `ungrouped`로 분류
   - 각 클러스터 상위 3개 메모 제목으로 GPT-4o-mini 그룹명 생성
   - `memo_groups` INSERT (expires_at = now() + 1시간)
   - 결과 반환

**클러스터링 알고리즘 (Union-Find):**
```typescript
// lib/ai/memo-clustering.ts
// 1. 전체 메모 임베딩 쌍 코사인 유사도 계산
// 2. 유사도 >= 0.75인 쌍을 같은 그룹으로 합침
// 3. 그룹 크기 1인 경우 ungrouped로 분류
```

---

### 3-3. POST `/api/memos/groups/suggest`

그룹 내 메모 기반 AI 아이디어 제안.

**인증:** 필수

**요청:**
```json
{
  "groupId": "uuid",
  "groupName": "SNS 마케팅 전략"
}
```

**응답 (SSE 스트리밍):**
```
data: {"type":"idea","index":1,"title":"Q2 인스타그램 캠페인 기획","description":"...","effect":"..."}
data: {"type":"idea","index":2,...}
data: {"type":"done"}
```

**GPT-4o 프롬프트:**
```
다음은 사용자가 기록한 메모들입니다. 이 메모들의 공통 맥락을 분석하고,
실행 가능한 아이디어 3~5개를 제안하세요.

각 아이디어는 다음 형식의 JSON 배열로 응답하세요:
[
  {
    "title": "아이디어 제목",
    "description": "구체적인 설명 (2~3문장)",
    "effect": "예상 효과 또는 기대 결과"
  }
]

메모 목록:
{memos.map(m => `[${m.title}]\n${m.content}`).join('\n\n')}
```

---

### 3-4. GET `/api/memos/[id]/related`

특정 메모와 유사한 메모 최대 3개 반환.

**인증:** 필수 (본인 메모만)

**응답:**
```json
{
  "success": true,
  "data": [
    { "id": "uuid", "title": "관련 메모 제목", "similarity": 0.89 }
  ]
}
```

**처리 로직:**
1. 해당 메모의 임베딩 조회
2. 임베딩 없으면 빈 배열 반환 (에러 없이)
3. `match_memo_embeddings` RPC 호출 (threshold: 0.75, count: 3)

---

## 4. 컴포넌트 설계

### 4-1. 파일 구조

```
src/
├── app/
│   ├── (app)/memos/
│   │   └── page.tsx                    # 기존 파일 수정 (그룹 뷰 토글 추가)
│   └── api/memos/
│       ├── [id]/
│       │   ├── embed/
│       │   │   └── route.ts            # 신규
│       │   └── related/
│       │       └── route.ts            # 신규
│       └── groups/
│           ├── route.ts                # 신규
│           └── suggest/
│               └── route.ts           # 신규
├── components/memos/
│   ├── memo-list.tsx                   # 기존 수정 (그룹 뷰 분기)
│   ├── MemoGroupView.tsx               # 신규 — 그룹 섹션 뷰
│   ├── MemoGroupHeader.tsx             # 신규 — 그룹 헤더 + 제안 버튼
│   ├── IdeaSuggestPanel.tsx            # 신규 — 우측 슬라이드 패널
│   ├── IdeaCard.tsx                    # 신규 — 아이디어 카드 1개
│   ├── RelatedMemos.tsx                # 신규 — 연관 메모 목록
│   └── memo-view-modal.tsx             # 기존 수정 (RelatedMemos 추가)
├── hooks/
│   └── useMemoGroups.ts                # 신규 — 그룹 조회 + 캐시 상태
└── lib/ai/
    └── memo-clustering.ts              # 신규 — Union-Find 클러스터링
```

### 4-2. useMemoGroups 훅

```typescript
// src/hooks/useMemoGroups.ts
interface MemoGroup {
  id: string;
  name: string;
  memos: MemoItem[];
}

interface UseMemoGroupsReturn {
  groups: MemoGroup[];
  ungrouped: MemoItem[];
  loading: boolean;
  refresh: () => void;
}

export function useMemoGroups(): UseMemoGroupsReturn
```

- 마운트 시 `/api/memos/groups` 호출
- `groups`, `ungrouped` 상태 관리
- `refresh()`: 캐시 무효화 후 재조회

### 4-3. MemoGroupView

```typescript
// src/components/memos/MemoGroupView.tsx
interface Props {
  groups: MemoGroup[];
  ungrouped: MemoItem[];
  onPin: (id: string) => void;
  onView: (memo: MemoItem) => void;
  onEdit: (memo: MemoItem) => void;
  onDelete: (id: string) => void;
  onSuggest: (group: MemoGroup) => void;  // 아이디어 제안 트리거
}
```

- 그룹별 섹션 렌더링
- 각 섹션: `MemoGroupHeader` + 메모 카드 그리드
- `ungrouped` 섹션은 하단에 "기타" 로 표시

### 4-4. IdeaSuggestPanel

```typescript
// src/components/memos/IdeaSuggestPanel.tsx
interface Idea {
  title: string;
  description: string;
  effect: string;
}

interface Props {
  open: boolean;
  group: MemoGroup | null;
  onClose: () => void;
  onSaveAsMemo: (content: string) => void;   // 메모로 저장
  onCreateDocument: (content: string) => void; // 문서로 생성
}
```

- 우측에서 슬라이드인 (translate-x 트랜지션)
- SSE 스트리밍으로 아이디어 순차 표시
- 로딩 중: 스피너 + "아이디어를 생각하는 중..."
- 각 아이디어: `IdeaCard` 컴포넌트

### 4-5. RelatedMemos

```typescript
// src/components/memos/RelatedMemos.tsx
interface Props {
  memoId: string;
  onNavigate: (memo: MemoItem) => void;
}
```

- 마운트 시 `/api/memos/[id]/related` 호출
- 유사도 0.85 이상: "유사도 높음" 뱃지
- 유사도 0.75~0.85: "유사도 보통" 뱃지
- 임베딩 없거나 관련 메모 없으면 섹션 미표시

---

## 5. 메모 저장/수정 흐름 수정

기존 `page.tsx`의 `handleCreate`, `handleUpdate` 함수에 임베딩 fire-and-forget 추가.

```typescript
// 기존 handleCreate 수정
const handleCreate = async (data: MemoFormData) => {
  const res = await fetch('/api/memos', { method: 'POST', ... });
  const result = await res.json();
  if (result.success) {
    fetchMemos();
    // fire-and-forget: 응답 기다리지 않음
    fetch(`/api/memos/${result.data.id}/embed`, { method: 'POST' })
      .then(() => {}, () => {});
  }
};
```

---

## 6. 클러스터링 로직 설계

### 6-1. Union-Find 알고리즘

```typescript
// src/lib/ai/memo-clustering.ts

interface EmbeddingRow {
  memo_id: string;
  embedding: number[];
}

export function clusterMemos(
  embeddings: EmbeddingRow[],
  threshold = 0.75
): Map<string, string[]> {
  // 1. parent 맵 초기화 (각 메모가 자기 자신의 부모)
  // 2. 모든 쌍의 코사인 유사도 계산
  // 3. 유사도 >= threshold 이면 union
  // 4. 클러스터(그룹) 맵 반환 { root_id: [memo_id, ...] }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const normB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  return dot / (normA * normB);
}
```

> **성능 주의**: N개 메모의 모든 쌍 비교는 O(N²). 메모 수가 200개를 초과하면 pgvector RPC 방식으로 전환 권장. 현재 구현은 100개 이하 기준.

### 6-2. 그룹명 생성 프롬프트 (GPT-4o-mini)

```
다음 메모 제목들을 보고, 이 메모들의 공통 주제를 나타내는 짧은 그룹명(10자 이내)을 하나만 응답하세요.
메모 제목: {titles.join(', ')}
응답 예시: SNS 마케팅, 기술 스택 검토, 신규 기능 아이디어
```

---

## 7. UI 상세 설계

### 7-1. 그룹 뷰 토글

메모 페이지 헤더 우측에 탭 형태 토글:

```
[목록 보기] [그룹 보기]  ← 기존 검색창·추가 버튼 좌측
```

- 그룹 뷰 최초 진입 시 로딩 스피너 표시
- 임베딩이 없는 메모가 있으면 상단 안내:  
  `"일부 메모는 아직 분석 중입니다. 잠시 후 다시 확인해주세요."`

### 7-2. 그룹 섹션 헤더

```
── SNS 마케팅 전략 (4개) ────────────────  [아이디어 제안받기]
```

- 그룹명 + 메모 수
- 우측 버튼: accent 컬러(`#2E6FF2`), Lightbulb 아이콘

### 7-3. IdeaSuggestPanel 레이아웃

```
┌──────────────────────┬──────────────────────────────┐
│  메모 목록           │  💡 아이디어 제안              │
│                      │  SNS 마케팅 전략 기반          │
│                      │  ────────────────────────     │
│                      │  1. Q2 캠페인 기획             │
│                      │     설명: ...                  │
│                      │     예상 효과: ...             │
│                      │                               │
│                      │  2. 콘텐츠 자동화              │
│                      │     ...                        │
│                      │  ────────────────────────     │
│                      │  [문서로 생성]  [메모로 저장]   │
└──────────────────────┴──────────────────────────────┘
```

- 패널 너비: `w-96` (384px), 모바일에서는 하단 시트로 전환
- 닫기: X 버튼 또는 패널 외부 클릭
- "문서로 생성": 아이디어 전체 내용을 지시사항에 넣고 문서생성 모달 오픈

### 7-4. RelatedMemos (뷰 모달 내)

```
── 관련 메모 ─────────────────────────
• 인스타 트렌드 분석    [유사도 높음]
• 경쟁사 캠페인 사례    [유사도 보통]
• Q1 마케팅 회고        [유사도 보통]
```

- 메모가 없으면 섹션 자체 미렌더링

---

## 8. 에러 처리 정책

| 상황 | 처리 |
|------|------|
| 임베딩 생성 실패 | fire-and-forget이므로 UI 영향 없음. 해당 메모는 ungrouped 분류 |
| 그룹 조회 중 OpenAI 오류 | 500 반환, 프론트에서 "그룹화 실패. 잠시 후 다시 시도해주세요" 토스트 |
| 아이디어 제안 스트리밍 오류 | SSE 연결 끊김 → 패널에 "제안 생성에 실패했습니다" 인라인 메시지 |
| 메모 0개 상태에서 그룹 뷰 | "메모를 작성하면 자동으로 그룹화됩니다" EmptyState 표시 |
| 임베딩 없는 메모만 있을 때 | ungrouped 섹션만 표시 + 분석 중 안내 |

---

## 9. 구현 순서

| 순서 | 작업 | 파일 |
|------|------|------|
| 1 | DB 마이그레이션 작성 | `supabase/migrations/021_memo_embeddings.sql` |
| 2 | `memo-clustering.ts` 구현 | `src/lib/ai/memo-clustering.ts` |
| 3 | embed API 구현 | `src/app/api/memos/[id]/embed/route.ts` |
| 4 | related API 구현 | `src/app/api/memos/[id]/related/route.ts` |
| 5 | groups API 구현 | `src/app/api/memos/groups/route.ts` |
| 6 | suggest API 구현 | `src/app/api/memos/groups/suggest/route.ts` |
| 7 | `useMemoGroups` 훅 구현 | `src/hooks/useMemoGroups.ts` |
| 8 | `MemoGroupView`, `MemoGroupHeader` | `src/components/memos/` |
| 9 | `IdeaSuggestPanel`, `IdeaCard` | `src/components/memos/` |
| 10 | `RelatedMemos` + `memo-view-modal.tsx` 수정 | `src/components/memos/` |
| 11 | `memo-list.tsx` 그룹 뷰 토글 분기 추가 | `src/components/memos/memo-list.tsx` |
| 12 | `memos/page.tsx` fire-and-forget 임베딩 연결 | `src/app/(app)/memos/page.tsx` |

---

## 10. 검증 기준 (GAP 분석 체크리스트)

| 항목 | 확인 방법 | 기대 결과 |
|------|----------|----------|
| DB 테이블 생성 | Supabase 대시보드 확인 | `memo_embeddings`, `memo_groups` 존재 |
| 임베딩 자동 생성 | 메모 저장 후 `memo_embeddings` 조회 | 해당 `memo_id` 레코드 존재 |
| 그룹 뷰 토글 | UI에서 토글 클릭 | 섹션별 메모 분류 표시 |
| 그룹명 자동 작명 | 그룹 이름 확인 | 내용 반영한 10자 이내 이름 |
| 아이디어 제안 스트리밍 | 패널 열고 로딩 확인 | 아이디어 순차적으로 표시 |
| 연관 메모 표시 | 메모 열람 시 하단 확인 | 유사 메모 최대 3개 표시 |
| 문서 생성 연결 | 제안 결과 → "문서로 생성" | 문서생성 모달 오픈 + 내용 자동 입력 |
| TTL 캐시 | 1시간 후 재조회 | 새 클러스터링 결과 반환 |
| 메모 0개 | 빈 상태 그룹 뷰 | EmptyState 표시, 에러 없음 |
| 500줄 제한 | 각 파일 줄 수 확인 | 모든 파일 500줄 미만 |
