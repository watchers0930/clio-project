# 회의록 → 할일 자동 추출 설계서

> **요약**: 회의록(STT 변환 텍스트)에서 GPT-4o가 액션 아이템·담당자·기한을 자동 추출하여 todos 테이블에 등록하는 기능의 기술 명세
>
> **프로젝트**: CLIO v5.6.0
> **작성일**: 2026-04-12
> **상태**: Draft
> **계획서**: [clio-meeting-todo.plan.md](../../01-plan/features/clio-meeting-todo.plan.md)

---

## 관련 문서

| 단계 | 문서 | 상태 |
|------|------|------|
| 계획서 | `docs/01-plan/features/clio-meeting-todo.plan.md` | ✅ Approved |
| 기존 STT API | `src/app/api/transcribe/route.ts` | ✅ 참조 |
| 기존 요약 라이브러리 | `src/lib/ai/summarize.ts` | ✅ 참조 |
| todos 마이그레이션 | `supabase/migrations/005_schedule_todo.sql` | ✅ 참조 |

---

## 1. 개요

### 1-1. 기능 요약

STT(Whisper-1) 파이프라인으로 생성된 회의록 텍스트를 GPT-4o가 분석하여 액션 아이템, 담당자 이름, 기한을 구조화된 JSON으로 추출한다. 추출된 항목은 사용자가 미리보기 모달에서 선택적으로 검토한 뒤 `todos` 테이블에 일괄 등록된다. `/api/transcribe` 응답에 `extractedTodos` 배열을 추가하는 방식으로 기존 파이프라인을 파괴적으로 변경하지 않는다.

### 1-2. 기술 스택

| 항목 | 기술 |
|------|------|
| 프레임워크 | Next.js 16 (App Router) |
| 데이터베이스 | Supabase (PostgreSQL + RLS) |
| AI 모델 | OpenAI GPT-4o (`gpt-4o`) — 추출, GPT-4o-mini — 요약(기존) |
| SDK | `ai` (Vercel AI SDK), `@ai-sdk/openai` |
| 언어 | TypeScript |
| 상태관리 | Zustand (`auth-store`) + 컴포넌트 로컬 state |

---

## 2. 데이터베이스 설계

### 2-1. 기존 todos 테이블 스키마 확인

계획서 정의에 따라 **todos 테이블 스키마 변경 없음**. 기존 컬럼만 활용한다.

```sql
-- 기존 구조 (005_schedule_todo.sql 확인 완료)
-- id, title, description, due_date, priority, status,
-- completed_at, user_id, created_at, updated_at
```

### 2-2. 마이그레이션 파일: `010_meeting_todos.sql`

P2(FR-10) 중복 방지를 위한 `todo_extractions` 추적 테이블 추가. 기존 todos 컬럼은 변경하지 않는다.

```sql
-- =============================================================================
-- CLIO - 회의록 할일 추출 이력 테이블
-- 파일명: supabase/migrations/010_meeting_todos.sql
-- 목적: 동일 document_id에서 중복 추출 방지 (FR-10)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.todo_extractions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id   UUID NOT NULL,                     -- documents.id 참조 (FK 없음 — 유연성 확보)
  extracted_by  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  todo_ids      UUID[] NOT NULL DEFAULT '{}',       -- 실제 등록된 todos.id 배열
  todo_count    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_todo_extractions_document_id
  ON public.todo_extractions(document_id);

CREATE INDEX IF NOT EXISTS idx_todo_extractions_extracted_by
  ON public.todo_extractions(extracted_by);

-- RLS 활성화
ALTER TABLE public.todo_extractions ENABLE ROW LEVEL SECURITY;

-- 본인이 추출한 이력만 조회 가능
CREATE POLICY "todo_extractions_select" ON public.todo_extractions
  FOR SELECT TO authenticated
  USING (extracted_by = auth.uid());

-- 본인 기록만 INSERT 가능
CREATE POLICY "todo_extractions_insert" ON public.todo_extractions
  FOR INSERT TO authenticated
  WITH CHECK (extracted_by = auth.uid());
```

### 2-3. todos 테이블 활용 컬럼 매핑

```
todos 컬럼         ← 추출 데이터 출처
─────────────────────────────────────────────────────
title           ← ExtractedTodo.title
description     ← "회의록 자동 추출 (문서: {docTitle})"
due_date        ← ExtractedTodo.dueDate | null
priority        ← ExtractedTodo.priority ('high' | 'medium' | 'low')
status          ← 'active' (고정)
user_id         ← 담당자 매핑 성공 → 담당자 uuid
                   담당자 매핑 실패 → 요청자 auth.uid()
```

### 2-4. RLS 정책 요약

| 테이블 | 정책 | 조건 |
|--------|------|------|
| `todos` | 기존 `todos_all` 정책 그대로 적용 | `user_id = auth.uid()` |
| `todo_extractions` | `todo_extractions_select` | `extracted_by = auth.uid()` |
| `todo_extractions` | `todo_extractions_insert` | `extracted_by = auth.uid()` |

---

## 3. API 설계

### 3-1. 엔드포인트 목록

| 메서드 | 경로 | 역할 | 인증 |
|--------|------|------|------|
| POST | `/api/transcribe` | STT + 요약 + 할일 자동 추출 통합 (기존 수정) | Supabase 세션 |
| POST | `/api/todos/extract` | 기존 document_id 기반 재추출 + 선택 등록 | Supabase 세션 |

### 3-2. 엔드포인트 상세 명세

#### `POST /api/transcribe` (기존 파일 수정)

**변경 내용**: `summarizeTranscript()` 호출 이후 `extractTodosFromText()` 추가 호출. 실패 시 `extractedTodos: []` 반환 (회의록 생성 중단 없음).

**Request**: 기존과 동일 (`multipart/form-data`, `file: File`)

**Response (기존 필드 유지 + `extractedTodos` 추가)**:

```typescript
interface TranscribeResponse {
  success: boolean;
  data: {
    transcript: string;
    summary: MeetingSummary;         // 기존
    document: {
      id: string;
      title: string;
      content: string;
    } | null;
    extractedTodos: ExtractedTodo[]; // 신규 (빈 배열 가능)
  };
}
```

**처리 흐름**:

```
1. STT 변환 (Whisper-1)
2. AI 요약 (GPT-4o-mini) — 기존
3. 회의록 문서 DB INSERT — 기존
4. extractTodosFromText(transcript, docTitle, authUserId)
   ├── GPT-4o 호출 (최대 15,000자 슬라이싱)
   ├── 담당자 이름 → users.name 매핑 (admin 클라이언트)
   ├── 매핑 실패 시 user_id = authUserId (fallback)
   └── 실패 시 [] 반환 (에러 throw 금지)
5. 응답에 extractedTodos 포함
   ※ 이 단계에서는 todos INSERT 하지 않음 (UI 선택 후 등록)
```

---

#### `POST /api/todos/extract` (신규 파일)

**경로**: `src/app/api/todos/extract/route.ts`

**역할**: 기존 회의록 document_id로 재추출 + 선택된 항목 todos 테이블에 일괄 INSERT

**Request Body**:

```typescript
interface ExtractRequest {
  documentId: string;           // documents.id (UUID)
  selectedTodos: ExtractedTodo[]; // 사용자가 선택한 항목만
}
```

**Response (200 OK)**:

```typescript
interface ExtractResponse {
  success: boolean;
  data: TodoInsertResult;
}

interface TodoInsertResult {
  inserted: number;
  skipped: number;
  todos: Array<{ id: string; title: string }>;
}
```

**에러 응답**:

| 코드 | 원인 | 메시지 |
|------|------|--------|
| 400 | documentId 없음 | `'documentId는 필수입니다.'` |
| 401 | 비인증 | `'인증이 필요합니다.'` |
| 403 | 타인 문서 접근 | `'접근 권한이 없습니다.'` |
| 404 | 문서 없음 | `'문서를 찾을 수 없습니다.'` |
| 500 | DB 오류 | `'할일 등록에 실패했습니다.'` |

**처리 흐름**:

```
1. documentId 수신 + 인증 확인
2. documents 테이블에서 문서 조회
   └── created_by !== authUserId → 403
3. extractTodosFromText(content, title, authUserId) 호출
   (재추출 — GPT-4o 재호출)
4. selectedTodos 중 todos 테이블 일괄 INSERT (admin 클라이언트)
5. todo_extractions에 이력 저장 (FR-10)
6. TodoInsertResult 반환
```

---

### 3-3. 기존 `/api/todos` 엔드포인트

변경 없음. 기존 POST 엔드포인트 그대로 사용 가능.

---

## 4. 컴포넌트 설계

### 4-1. 신규 파일 목록

| 파일 경로 | 역할 | 레이어 |
|-----------|------|--------|
| `src/lib/ai/extract-todos.ts` | GPT-4o 추출 + users 매핑 + todos INSERT 로직 | Infrastructure |
| `src/app/api/todos/extract/route.ts` | 재추출 API 핸들러 | Presentation (API) |
| `src/components/meetings/TodoExtractModal.tsx` | 추출 결과 미리보기 + 선택 등록 모달 | Presentation (UI) |

### 4-2. 수정 파일 목록

| 파일 경로 | 변경 내용 |
|-----------|-----------|
| `src/app/api/transcribe/route.ts` | `extractTodosFromText()` 호출 추가, 응답에 `extractedTodos` 포함 |
| `src/lib/ai/summarize.ts` | `MeetingSummary` 인터페이스에 `extractedTodos?` 선택 필드 추가 검토 (선택사항) |
| `src/app/(app)/documents/page.tsx` | "할일 자동 추출" 버튼 + `TodoExtractModal` 연결 |

---

### 4-3. `src/lib/ai/extract-todos.ts`

```typescript
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

// ─── 타입 정의 ──────────────────────────────────────────────

/** GPT-4o가 반환하는 개별 할일 항목 */
export interface ExtractedTodo {
  title: string;            // 할일 제목 (필수, 빈 문자열 불허)
  assigneeName: string;     // 담당자 이름 텍스트 (빈 문자열 가능)
  dueDate: string | null;   // ISO 날짜 (YYYY-MM-DD) 또는 null
  priority: 'high' | 'medium' | 'low';
}

/** todos 테이블 일괄 INSERT 결과 */
export interface TodoInsertResult {
  inserted: number;
  skipped: number;
  todos: Array<{ id: string; title: string }>;
}

// ─── 핵심 함수 ──────────────────────────────────────────────

/**
 * 회의록 텍스트에서 할일 목록을 추출한다.
 * 실패 시 예외를 던지지 않고 빈 배열 반환.
 */
export async function extractTodosFromText(
  transcriptText: string,
  docTitle: string,
  requestUserId: string,
): Promise<ExtractedTodo[]> {
  try {
    const { text } = await generateText({
      model: openai('gpt-4o'),
      system: EXTRACT_SYSTEM_PROMPT,
      prompt: buildExtractUserPrompt(transcriptText),
      maxTokens: 2000,
      temperature: 0.1,
    });

    const cleaned = text.replace(/```json\n?|```/g, '').trim();
    const parsed = JSON.parse(cleaned) as { todos: ExtractedTodo[] };

    if (!Array.isArray(parsed.todos)) return [];
    return parsed.todos.filter((t) => t.title && t.title.trim().length > 0);
  } catch (err) {
    console.error('[extract-todos] GPT-4o 추출 실패:', err);
    return [];
  }
}

/**
 * 담당자 이름을 users 테이블에서 조회하여 user_id를 반환한다.
 * 일치하지 않으면 requestUserId(요청자 본인)를 반환한다.
 */
export async function resolveAssigneeUserId(
  assigneeName: string,
  requestUserId: string,
): Promise<string> {
  if (!assigneeName.trim()) return requestUserId;

  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from('users')
    .select('id')
    .ilike('name', assigneeName.trim())
    .eq('is_active', true)
    .limit(1)
    .single();

  return data?.id ?? requestUserId;
}

/**
 * 선택된 ExtractedTodo 배열을 todos 테이블에 일괄 INSERT한다.
 * admin 클라이언트 사용 (RLS bypass — user_id를 직접 지정하기 위해).
 */
export async function insertExtractedTodos(
  selectedTodos: ExtractedTodo[],
  docTitle: string,
  requestUserId: string,
): Promise<TodoInsertResult> {
  const admin = createAdminSupabaseClient();
  const insertedRows: Array<{ id: string; title: string }> = [];
  let skipped = 0;

  for (const todo of selectedTodos) {
    const userId = await resolveAssigneeUserId(todo.assigneeName, requestUserId);

    const { data, error } = await admin
      .from('todos')
      .insert({
        title: todo.title,
        description: `회의록 자동 추출 (문서: ${docTitle})`,
        due_date: todo.dueDate ?? null,
        priority: todo.priority,
        status: 'active',
        user_id: userId,
      })
      .select('id, title')
      .single();

    if (error || !data) {
      console.error('[insert-todos] INSERT 실패:', error?.message);
      skipped++;
    } else {
      insertedRows.push({ id: data.id, title: data.title });
    }
  }

  return {
    inserted: insertedRows.length,
    skipped,
    todos: insertedRows,
  };
}
```

---

### 4-4. `src/components/meetings/TodoExtractModal.tsx`

#### Props 인터페이스

```typescript
import type { ExtractedTodo } from '@/lib/ai/extract-todos';

interface TodoExtractModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;      // 재추출 API 호출용
  documentTitle: string;   // UI 표시용
  initialTodos: ExtractedTodo[];  // /api/transcribe 응답 또는 재추출 결과
  onSuccess: (count: number) => void; // 등록 완료 후 토스트 트리거
}
```

#### 주요 상태 (useState)

```typescript
const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
// 인덱스 기반 선택 상태 (ExtractedTodo에 id 없으므로 배열 인덱스 사용)

const [isLoading, setIsLoading] = useState(false);
// 재추출 또는 등록 API 호출 중 로딩 표시

const [todos, setTodos] = useState<ExtractedTodo[]>(initialTodos);
// 현재 모달에서 보여줄 할일 목록 (재추출 시 갱신)

const [isReExtracting, setIsReExtracting] = useState(false);
// "다시 추출" 버튼 클릭 후 GPT-4o 재호출 상태
```

#### ASCII 와이어프레임

```
┌─────────────────────────────────────────────────────┐
│  할일 자동 추출 결과                         [X 닫기] │
│  문서: {documentTitle}                              │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ☑ 전체 선택  (3개 항목)          [다시 추출하기]   │
│  ─────────────────────────────────────────────────  │
│  ☑  API 명세서 작성            담당: 김철수  D-3일  │
│     [high]                                          │
│  ☑  테스트 케이스 작성         담당: 이영희  D-7일  │
│     [medium]                                        │
│  ☐  디자인 시안 검토           담당: (미지정) -     │
│     [low]                                           │
│                                                     │
├─────────────────────────────────────────────────────┤
│  [취소]                  [선택 항목 등록 (2개)]     │
└─────────────────────────────────────────────────────┘
```

#### 핵심 동작 흐름

```
사용자가 "할일 자동 추출" 버튼 클릭
  → TodoExtractModal 열림 (initialTodos로 목록 초기화)
  → 전체 선택 상태로 시작
  → 개별 항목 체크/해제 가능
  → "다시 추출하기" 클릭 시 /api/todos/extract?reExtract=true 호출
  → "선택 항목 등록" 클릭
      → /api/todos/extract POST 호출 (selectedTodos 전달)
      → 성공: onSuccess(count) 호출 → 토스트 표시 → 모달 닫힘
      → 실패: 에러 메시지 모달 내부 표시 (닫지 않음)
```

---

### 4-5. 문서 상세 페이지 수정 (`src/app/(app)/documents/page.tsx`)

회의록 문서에 한해 "할일 자동 추출" 버튼을 조건부 렌더링한다.

**조건**: 문서 `title`에 "회의록" 포함 또는 `template_id`가 회의록 템플릿인 경우

```typescript
// 버튼 조건 렌더링 예시
{isMeetingDocument(selectedDoc) && (
  <button onClick={() => setIsExtractModalOpen(true)}>
    할일 자동 추출
  </button>
)}

<TodoExtractModal
  isOpen={isExtractModalOpen}
  onClose={() => setIsExtractModalOpen(false)}
  documentId={selectedDoc.id}
  documentTitle={selectedDoc.title}
  initialTodos={[]}          // 문서 상세에서 열릴 때는 빈 배열 → 재추출 트리거
  onSuccess={(count) => {
    showToast(`${count}개의 할일이 등록되었습니다.`);
    setIsExtractModalOpen(false);
  }}
/>
```

---

## 5. AI 프롬프트 설계

### 5-1. System Prompt (전체)

```
당신은 회의록에서 액션 아이템을 추출하는 전문 AI입니다.

규칙:
1. 회의 내용에서 실제 할 일(action item)만 추출합니다. 논의사항이나 정보 공유는 제외합니다.
2. 담당자가 명시된 경우에만 assigneeName을 채웁니다. 불명확하면 빈 문자열("")로 설정합니다.
3. 기한이 명시된 경우에만 dueDate를 채웁니다. 불명확하거나 언급 없으면 null로 설정합니다.
4. dueDate는 반드시 ISO 8601 형식(YYYY-MM-DD)으로 작성합니다. 상대적 표현("다음 주", "3일 후")은 오늘 날짜 기준으로 계산합니다. 오늘 날짜: {TODAY}
5. priority는 긴급도·중요도를 기준으로 판단합니다:
   - high: "긴급", "오늘까지", "내일까지", "빠르게" 등의 표현 포함
   - low: "여유 있게", "나중에", "검토해보면" 등의 표현 포함
   - medium: 그 외 (기본값)
6. 반드시 JSON만 응답합니다. 설명 텍스트 금지.
```

### 5-2. User Prompt 구조

```typescript
function buildExtractUserPrompt(transcriptText: string): string {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return `다음은 회의 내용입니다 (오늘 날짜: ${today}):

---
${transcriptText.slice(0, 15000)}
---

위 회의 내용에서 액션 아이템을 추출하여 아래 JSON 형식으로만 응답하세요:

{
  "todos": [
    {
      "title": "할일 제목",
      "assigneeName": "담당자 이름 또는 빈 문자열",
      "dueDate": "YYYY-MM-DD 또는 null",
      "priority": "high | medium | low"
    }
  ]
}

액션 아이템이 없으면 todos를 빈 배열([])로 반환합니다.`;
}
```

### 5-3. 응답 JSON 스키마

```typescript
/** GPT-4o가 반환하는 전체 응답 구조 */
interface ExtractGptResponse {
  todos: ExtractedTodo[];
}

/** 개별 할일 항목 */
interface ExtractedTodo {
  title: string;                    // 비어있으면 필터링
  assigneeName: string;             // "" 가능
  dueDate: string | null;           // "2026-04-15" 또는 null
  priority: 'high' | 'medium' | 'low';
}
```

### 5-4. GPT-4o 호출 파라미터

```typescript
const { text } = await generateText({
  model: openai('gpt-4o'),          // gpt-4o (정확도 우선, mini 사용 금지)
  system: EXTRACT_SYSTEM_PROMPT,    // 위 5-1 내용
  prompt: buildExtractUserPrompt(transcriptText),
  maxTokens: 2000,                  // 할일 목록은 짧으므로 2000으로 충분
  temperature: 0.1,                 // 일관된 구조화 출력 위해 낮게 설정
  // response_format은 Vercel AI SDK generateText에서
  // system 프롬프트의 "JSON만 응답" 지시로 대체
});
```

---

## 6. 에러 처리 설계

### 6-1. 에러 케이스별 처리 방법

| 케이스 | 발생 위치 | 처리 방법 |
|--------|-----------|-----------|
| GPT-4o API 타임아웃 (10초 초과) | `extractTodosFromText()` | `try/catch` → `[]` 반환, 콘솔 에러 로그. `/api/transcribe` 응답에 `extractedTodos: []` 포함 — 회의록 생성은 정상 완료 |
| GPT-4o JSON 파싱 실패 | `extractTodosFromText()` | `JSON.parse` 실패 → catch에서 `[]` 반환 |
| 담당자 이름 users 매핑 실패 | `resolveAssigneeUserId()` | `requestUserId` 반환 (fallback). 별도 에러 없음 |
| todos INSERT 실패 (DB 오류) | `insertExtractedTodos()` | 해당 항목만 `skipped++`, 나머지는 계속 삽입. 전체 실패 시 `500` 반환 |
| documents 접근 권한 없음 | `/api/todos/extract` | `403` 응답 + UI에서 "접근 권한이 없습니다." 토스트 |
| 빈 추출 결과 | `TodoExtractModal` | "추출된 할일이 없습니다." 안내 문구 + "직접 입력하기" 링크 표시 |
| 네트워크 오류 (클라이언트) | `TodoExtractModal` | 로딩 해제 + "잠시 후 다시 시도해 주세요." 모달 내부 에러 메시지 |
| 중복 추출 경고 (FR-10) | `/api/todos/extract` | `todo_extractions` 조회 후 이미 추출 이력 존재 시 `200` 응답에 `alreadyExtracted: true` 포함 → UI에서 경고 배너 표시 |

### 6-2. API 에러 응답 형식 (기존 CLIO 패턴 준수)

```typescript
// 기존 CLIO 에러 응답 패턴 (다른 API와 일관성 유지)
NextResponse.json({ success: false, error: '에러 메시지' }, { status: 코드 })
```

---

## 7. 구현 순서 (Phase별 체크리스트)

### Phase 1 — AI 추출 라이브러리 구현 (P0)

- [ ] `src/lib/ai/extract-todos.ts` 신규 생성
  - [ ] `ExtractedTodo` 타입 정의
  - [ ] `TodoInsertResult` 타입 정의
  - [ ] `EXTRACT_SYSTEM_PROMPT` 상수 작성
  - [ ] `buildExtractUserPrompt()` 함수 작성
  - [ ] `extractTodosFromText()` 함수 작성 (GPT-4o 호출 + 파싱)
  - [ ] `resolveAssigneeUserId()` 함수 작성 (users 이름 매핑)
  - [ ] `insertExtractedTodos()` 함수 작성 (todos 일괄 INSERT)

### Phase 2 — 기존 STT API 통합 (P0)

- [ ] `src/app/api/transcribe/route.ts` 수정
  - [ ] `extractTodosFromText` import 추가
  - [ ] 회의록 문서 INSERT 이후 `extractTodosFromText()` 호출 추가
  - [ ] 응답 body에 `extractedTodos` 필드 추가
  - [ ] 추출 실패 시 `extractedTodos: []` fallback 동작 검증

### Phase 3 — 재추출 API 구현 (P1)

- [ ] `src/app/api/todos/extract/route.ts` 신규 생성
  - [ ] POST 핸들러: `documentId` + `selectedTodos` 수신
  - [ ] documents 테이블에서 문서 조회 + 소유권 검증
  - [ ] `extractTodosFromText()` 호출 (재추출)
  - [ ] `insertExtractedTodos()` 호출 (선택 항목만)
  - [ ] `todo_extractions` 이력 INSERT
  - [ ] `TodoInsertResult` 응답 반환

### Phase 4 — 미리보기 모달 UI 구현 (P1)

- [ ] `src/components/meetings/TodoExtractModal.tsx` 신규 생성
  - [ ] Props 인터페이스 정의
  - [ ] 로컬 state 설정 (`checkedIds`, `isLoading`, `todos`, `isReExtracting`)
  - [ ] 체크리스트 UI 렌더링 (개별 항목 + 전체 선택)
  - [ ] 담당자명·기한·우선순위 뱃지 표시
  - [ ] "다시 추출하기" 버튼 → `/api/todos/extract` 재호출
  - [ ] "선택 항목 등록" 버튼 → API 호출 → `onSuccess` 콜백
  - [ ] 빈 결과 처리 UI ("추출된 할일이 없습니다.")
  - [ ] 이미 추출 이력 존재 시 경고 배너 (FR-10)

### Phase 5 — 문서 상세 페이지 연동 (P1)

- [ ] `src/app/(app)/documents/page.tsx` 수정
  - [ ] `isMeetingDocument()` 헬퍼 함수 작성 (제목 기반)
  - [ ] "할일 자동 추출" 버튼 조건부 렌더링
  - [ ] `TodoExtractModal` import + 연결
  - [ ] `isExtractModalOpen` state 관리
  - [ ] 등록 완료 후 토스트 메시지 표시 (기존 toast 컴포넌트 활용)

### Phase 6 — DB 마이그레이션 (P2)

- [ ] `supabase/migrations/010_meeting_todos.sql` 작성
  - [ ] `todo_extractions` 테이블 CREATE
  - [ ] 인덱스 2개 생성
  - [ ] RLS 정책 2개 설정

### Phase 7 — 검증 (회귀 테스트)

- [ ] 오디오 업로드 → `/api/transcribe` 응답에 `extractedTodos` 포함 확인
- [ ] 담당자 이름 매핑 성공 케이스 검증
- [ ] 담당자 이름 매핑 실패 fallback 검증 (요청자 본인 uid)
- [ ] GPT-4o 실패 시 `extractedTodos: []` 반환 + 회의록 생성 정상 완료 확인
- [ ] 미리보기 모달 전체 선택/해제 동작
- [ ] 선택 항목만 todos 등록 확인
- [ ] 타인 문서에서 추출 시도 시 403 응답 확인 (RLS)
- [ ] 기존 STT 회의록 생성 회귀 없음 확인
- [ ] 기존 할일 CRUD 회귀 없음 확인

---

## Version History

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 0.1 | 2026-04-12 | 최초 작성 | 크로미 (PM/Design) |
