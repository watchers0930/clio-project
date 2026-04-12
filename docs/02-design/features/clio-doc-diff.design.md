# clio-doc-diff 설계서

> **요약**: Myers diff 알고리즘 기반 문서 버전 비교 뷰어 + GPT-4o AI 변경 해석 패널
>
> **프로젝트**: CLIO v5.6.0
> **버전**: v0.1
> **작성자**: 크로미
> **작성일**: 2026-04-12
> **상태**: Draft
> **계획서**: [clio-doc-diff.plan.md](../01-plan/features/clio-doc-diff.plan.md)

---

## 관련 문서

| 구분 | 문서 | 상태 |
|------|------|------|
| 계획서 | `docs/01-plan/features/clio-doc-diff.plan.md` | Approved |
| 연계 기능 | P3-1 버전 관리 (`documents.parent_id` 체인) | 구현 완료 |

---

## 1. 개요

### 1-1. 기능 요약

`clio-doc-diff`는 CLIO 문서 시스템에서 동일 문서의 두 버전을 나란히 비교하고,
GPT-4o가 변경 맥락을 자연어로 해석해 주는 AI 강화 diff 뷰어다.

- **핵심 흐름**: 사용자가 비교할 두 버전 선택 → Myers diff 계산 → Side-by-Side 또는 Inline 뷰 렌더링 → AI 해석 패널 스트리밍 표시
- **계약서 특화**: 문서 타입이 계약서인 경우 갑/을 유불리 조항 분류 추가 실행
- **DB 변경 없음**: 기존 `documents.parent_id` 버전 체인을 그대로 활용

### 1-2. 기술 스택

| 구분 | 기술 |
|------|------|
| 프레임워크 | Next.js 16 (App Router) |
| 언어 | TypeScript |
| DB / Auth | Supabase (PostgreSQL + RLS) |
| AI | OpenAI GPT-4o (스트리밍 SSE) |
| 스타일링 | Tailwind CSS |
| diff 알고리즘 | Myers diff (직접 구현, `lib/utils/myers-diff.ts`) |
| 스트리밍 | ReadableStream + SSE (`text/event-stream`) |

---

## 2. Myers Diff 알고리즘 설계

### 2-1. 행 단위 diff 처리 방식

1. 두 버전의 `content` 문자열을 줄바꿈(`\n`)으로 분할하여 배열로 변환
2. Myers diff 알고리즘으로 두 배열의 최소 편집 경로(Shortest Edit Script) 계산
3. 편집 경로를 순회하여 각 줄을 `added` / `removed` / `unchanged`로 분류
4. 인접한 `removed` + `added` 쌍을 감지하여 `modified`로 병합 (변경 라인)
5. `modified` 라인 내부에서 단어 단위 재귀 diff를 실행하여 세부 하이라이트 생성

### 2-2. DiffLine 타입 정의

```typescript
// lib/utils/myers-diff.ts

type DiffLineType = 'added' | 'removed' | 'unchanged' | 'modified';

type DiffLine = {
  type: DiffLineType;
  oldLine?: number;   // 구 버전 줄 번호 (removed, unchanged, modified)
  newLine?: number;   // 신 버전 줄 번호 (added, unchanged, modified)
  content: string;    // 해당 줄의 전체 텍스트
  // modified 타입일 때만 존재 — 단어 단위 세부 diff
  wordDiff?: WordDiff[];
};

type WordDiff = {
  type: 'added' | 'removed' | 'unchanged';
  text: string;
};

type DiffResult = {
  lines: DiffLine[];
  stats: {
    added: number;
    removed: number;
    changed: number;
    unchanged: number;
  };
};
```

### 2-3. `lib/utils/myers-diff.ts` 구현 설계

```typescript
// 공개 API (함수 시그니처)

/**
 * 두 문자열을 행 단위로 비교하여 DiffResult 반환
 * @param oldText - 구 버전 문자열
 * @param newText - 신 버전 문자열
 * @returns DiffResult
 */
export function computeDiff(oldText: string, newText: string): DiffResult

/**
 * Myers diff 알고리즘 핵심 — 최단 편집 경로 계산
 * @param oldLines - 구 버전 줄 배열
 * @param newLines - 신 버전 줄 배열
 * @returns EditOperation[]
 */
function myersEditScript(
  oldLines: string[],
  newLines: string[]
): EditOperation[]

/**
 * EditOperation 배열을 DiffLine 배열로 변환
 * modified 병합 및 줄 번호 부여 포함
 */
function buildDiffLines(
  ops: EditOperation[],
  oldLines: string[],
  newLines: string[]
): DiffLine[]

/**
 * 단어 단위 세부 diff (modified 라인 내부용)
 */
function computeWordDiff(oldContent: string, newContent: string): WordDiff[]

// 내부 타입
type EditOperation =
  | { op: 'keep'; oldIdx: number; newIdx: number }
  | { op: 'delete'; oldIdx: number }
  | { op: 'insert'; newIdx: number };
```

**핵심 로직 흐름**:

```
computeDiff(oldText, newText)
  1. oldLines = oldText.split('\n')
  2. newLines = newText.split('\n')
  3. ops = myersEditScript(oldLines, newLines)
  4. lines = buildDiffLines(ops, oldLines, newLines)
     - 인접 delete+insert → modified 병합
     - modified에 computeWordDiff 적용
  5. stats = { added, removed, changed, unchanged } 집계
  6. return { lines, stats }
```

### 2-4. 큰 문서 처리 전략

| 문서 크기 | 전략 |
|-----------|------|
| ~10,000자 | 전체 diff 즉시 계산 |
| 10,000~50,000자 | 섹션(단락 구분 기준) 단위로 분할 후 순차 계산, 뷰포트 내 섹션만 렌더링 |
| 50,000자 초과 | 경고 배너 표시 + 처음 50,000자만 diff 계산 (`"이후 내용은 너무 길어 일부만 표시됩니다"`) |

섹션 분할 기준: 빈 줄 2개 이상(`\n\n`) 또는 마크다운 헤딩(`#`, `##`)

---

## 3. API 설계

### 3-1. `POST /api/documents/[id]/diff`

**역할**: 두 버전의 텍스트를 조회하여 Myers diff를 계산하고 전체 DiffResult를 반환한다.

**Request**:

```typescript
// Body
{
  compareWith: string;  // 비교 대상 document ID (신 버전)
}
// [id] = 기준(구) 버전 document ID
```

**Response (200 OK)**:

```typescript
// DiffResult 전체 반환
{
  lines: DiffLine[];
  stats: {
    added: number;
    removed: number;
    changed: number;
    unchanged: number;
  };
  // 메타 정보
  from: {
    id: string;
    versionNumber: number;
    createdAt: string;
    title: string;
  };
  to: {
    id: string;
    versionNumber: number;
    createdAt: string;
    title: string;
  };
}
```

**처리 흐름**:

```
1. [id]에 해당하는 document 조회 (Supabase, RLS 적용)
2. compareWith에 해당하는 document 조회 (동일 RLS 적용)
3. 두 document가 동일한 parent_id 체인에 속하는지 유효성 검증
4. computeDiff(from.content, to.content) 실행
5. DiffResult + 메타 정보 반환
```

**에러 응답**:

```typescript
// 400: 동일 문서 체인 아님
{ "error": { "code": "INVALID_VERSION_CHAIN", "message": "두 문서가 같은 버전 체인에 속하지 않습니다." } }

// 403: RLS 차단 (타 조직 문서)
{ "error": { "code": "FORBIDDEN", "message": "접근 권한이 없습니다." } }

// 404: 문서 없음
{ "error": { "code": "NOT_FOUND", "message": "문서를 찾을 수 없습니다." } }
```

---

### 3-2. `POST /api/documents/[id]/diff/analyze`

**역할**: DiffResult를 GPT-4o에 전달하여 변경 내용 해석 + 갑/을 유불리 분석을 SSE 스트리밍으로 반환한다.

**Request**:

```typescript
{
  diffResult: DiffResult;
  contractType?: string;     // 계약서 유형 (예: "용역계약서", "임대차계약서")
  perspective?: 'buyer' | 'seller'; // 갑(buyer) 또는 을(seller) 입장
}
```

**SSE 이벤트 형식**:

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

event: chunk
data: {"text": "변경 요약\n총 3개 항목이 변경되었습니다.\n"}

event: chunk
data: {"text": "1. 계약 기간: 1년 → 2년 (연장)\n"}

event: done
data: {}
```

**처리 흐름**:

```
1. diffResult.stats.added + removed + changed === 0 이면 즉시 done 이벤트 전송
2. 변경된 줄만 필터링하여 프롬프트 구성 (5,000자 초과 시 분할)
3. OpenAI createChatCompletion(stream: true) 호출
4. 응답 청크를 SSE event: chunk / data: {"text": "..."} 형식으로 중계
5. 스트림 종료 시 event: done / data: {} 전송
```

**에러 처리**:

- OpenAI API 오류 시: `event: error / data: {"message": "AI 해석에 실패했습니다. diff 뷰는 정상 동작합니다."}` 전송 후 스트림 종료
- 토큰 초과 시: diff를 청크 단위로 분할하여 순차 분석 후 결과 합산

---

## 4. 컴포넌트 설계

### 4-1. 파일 구조

```
app/
└── (main)/
    └── documents/
        └── [id]/
            └── diff/
                └── page.tsx                    ← diff 뷰어 페이지

components/
└── document-diff/
    ├── DiffViewer.tsx                          ← 메인 뷰어 (토글 관리)
    ├── SideBySideView.tsx                      ← 좌우 분할 뷰
    ├── InlineView.tsx                          ← 인라인 뷰
    ├── DiffAnalysisPanel.tsx                   ← AI 분석 결과 패널
    └── VersionSelector.tsx                     ← 비교 버전 선택 드롭다운

lib/
└── utils/
    └── myers-diff.ts                           ← diff 알고리즘
```

---

### 4-2. `app/(main)/documents/[id]/diff/page.tsx`

**역할**: diff 뷰어 진입점 페이지. URL에서 비교 대상 버전 ID를 읽어 DiffViewer에 전달.

```typescript
// Props (Next.js route params)
interface PageProps {
  params: { id: string };           // 기준(구) 버전 document ID
  searchParams: { compare?: string }; // 비교 대상 document ID (쿼리스트링)
}
```

**주요 상태**:
- `compareWithId`: 선택된 비교 대상 ID (초기값: 최신 버전)
- `diffResult`: API 응답 결과
- `isLoading`: diff 계산 중 여부

**URL 패턴**: `/documents/[id]/diff?compare=[compareWithId]`

---

### 4-3. `components/document-diff/DiffViewer.tsx`

**역할**: 전체 diff 뷰어를 총괄하는 메인 컴포넌트. Side-by-Side / Inline 토글, 변경 네비게이션, 상단 통계 바를 포함한다.

```typescript
interface DiffViewerProps {
  baseDocumentId: string;   // 기준(구) 버전 ID
  compareDocumentId: string; // 비교(신) 버전 ID
  documentType?: string;    // 계약서 타입 (유불리 분석 여부 결정)
}
```

**주요 상태**:

```typescript
const [viewMode, setViewMode] = useState<'side-by-side' | 'inline'>('side-by-side');
const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
const [currentChangeIdx, setCurrentChangeIdx] = useState<number>(0);
const [isLoading, setIsLoading] = useState(false);
const changeRefs = useRef<HTMLElement[]>([]); // 변경 줄 DOM refs (네비게이션용)
```

---

### 4-4. `components/document-diff/SideBySideView.tsx`

**역할**: 구 버전(좌)과 신 버전(우)을 나란히 렌더링. 동일 줄 번호가 수평으로 정렬된다.

```typescript
interface SideBySideViewProps {
  lines: DiffLine[];
  onChangeRef: (idx: number, el: HTMLElement | null) => void; // 네비게이션용 ref 등록
}
```

**렌더링 방식**: `DiffLine[]`을 순회하며 좌우 열(column)에 각각 `oldLine`/`newLine` 번호와 `content`를 표시. `removed` 타입은 좌측에만, `added` 타입은 우측에만 표시하고 반대편에는 빈 줄을 렌더링하여 줄 번호 정렬 유지.

**ASCII 와이어프레임**:

```
┌────────────────────────────────────────────────────────────────────────────┐
│  [← 이전 변경]  변경 2/6  [다음 변경 →]     + 3줄  - 1줄  ~ 2줄  [Inline] │
├─────────────────────────────────┬──────────────────────────────────────────┤
│  v1.0  (2026-03-01)             │  v2.0  (2026-04-12)                      │
├────┬────────────────────────────┼────┬─────────────────────────────────────┤
│  1 │ 계약 기간: 1년              │  1 │ 계약 기간: 2년                      │← 변경(노랑)
│  2 │ 대금: 1,000만원             │  2 │ 대금: 1,200만원                     │← 변경(노랑)
│  3 │ 지체보상금: 0.1%            │  3 │ 지체보상금: 0.1%                    │
│    │                             │  4 │ 하자보증: 1년                       │← 추가(초록)
│  4 │ 서명: ___________           │  5 │ 서명: ___________                   │
└────┴────────────────────────────┴────┴─────────────────────────────────────┘
```

---

### 4-5. `components/document-diff/InlineView.tsx`

**역할**: 삭제된 텍스트(취소선 빨강)와 추가된 텍스트(밑줄 초록)를 같은 줄에 인라인으로 표시.

```typescript
interface InlineViewProps {
  lines: DiffLine[];
  onChangeRef: (idx: number, el: HTMLElement | null) => void;
}
```

**렌더링 방식**: `modified` 타입 줄은 `wordDiff`를 순회하며 `removed` 단어는 `<del>` 태그(빨강 취소선), `added` 단어는 `<ins>` 태그(초록 밑줄)로 렌더링.

---

### 4-6. `components/document-diff/DiffAnalysisPanel.tsx`

**역할**: AI 분석 결과를 SSE 스트리밍으로 수신하여 점진적으로 표시. 계약서 타입일 경우 갑/을 유불리 섹션도 표시.

```typescript
interface DiffAnalysisPanelProps {
  diffResult: DiffResult;
  documentType?: string;
  perspective?: 'buyer' | 'seller';
  baseDocumentId: string;
}
```

**주요 상태**:

```typescript
const [streamText, setStreamText] = useState('');
const [isStreaming, setIsStreaming] = useState(false);
const [error, setError] = useState<string | null>(null);
```

**SSE 수신 로직 (useEffect)**:

```typescript
const res = await fetch(`/api/documents/${baseDocumentId}/diff/analyze`, {
  method: 'POST',
  body: JSON.stringify({ diffResult, contractType: documentType, perspective }),
});
const reader = res.body!.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const text = decoder.decode(value);
  // "data: {...}" 파싱 후 streamText에 누적
  parseSSEChunk(text, (chunk) => {
    setStreamText((prev) => prev + chunk.text);
  });
}
setIsStreaming(false);
```

---

### 4-7. `components/document-diff/VersionSelector.tsx`

**역할**: 버전 체인에서 비교 가능한 버전 목록을 드롭다운으로 표시.

```typescript
interface VersionSelectorProps {
  currentDocumentId: string;
  selectedVersionId: string;
  onVersionChange: (versionId: string) => void;
}
```

**버전 목록 조회**: 기존 `GET /api/documents/[id]/versions` API 활용.

```typescript
// 응답 예시
[
  { id: "uuid-v1", versionNumber: 1, createdAt: "2026-03-01", title: "v1.0 초안" },
  { id: "uuid-v2", versionNumber: 2, createdAt: "2026-04-12", title: "v2.0 최종" },
]
```

---

## 5. AI 분석 프롬프트 설계 (계약서 특화)

### 5-1. System Prompt

```
당신은 문서 변경 내용 분석 전문가입니다.
아래 diff 결과를 보고 다음을 수행하세요:

1. [변경 요약]: 총 변경 항목 수와 주요 변경 내용을 번호 목록으로 정리
2. [변경 맥락]: 변경 내용의 흐름과 의도를 2~3문장으로 설명
{{계약서_특화_지시문 — documentType이 계약서일 때만 추가}}
3. [유불리 분석]: 갑(발주자/임차인)과 을(공급자/임대인) 각각에 유리/불리한 변경 항목 분류
4. [법적 주의 사항]: 추가 협의가 필요한 모호한 조항 지적 (없으면 "해당 없음")

답변은 간결하고 명확하게 작성하세요. 불필요한 서론 없이 바로 분석을 시작하세요.
```

### 5-2. User Prompt 구조

```
문서 제목: {document.title}
문서 유형: {documentType}
비교 입장: {perspective === 'buyer' ? '갑(발주자) 입장' : perspective === 'seller' ? '을(공급자) 입장' : '중립'}

--- 변경 내용 ---
{변경된 줄만 필터링하여 포함}
{type: 'removed'} 삭제: {content}
{type: 'added'}   추가: {content}
{type: 'modified'} 변경: {oldContent} → {newContent}
---

위 변경 내용을 분석해 주세요.
```

**토큰 절약 전략**: `unchanged` 줄은 프롬프트에서 제외. 변경 컨텍스트가 필요한 경우 변경 줄 앞뒤 2줄만 포함.

### 5-3. SSE 스트리밍 구현 (ReadableStream)

```typescript
// app/api/documents/[id]/diff/analyze/route.ts

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { diffResult, contractType, perspective } = await req.json();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const sendChunk = (text: string) => {
        controller.enqueue(
          encoder.encode(`event: chunk\ndata: ${JSON.stringify({ text })}\n\n`)
        );
      };

      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
          stream: true,
          messages: [
            { role: 'system', content: buildSystemPrompt(contractType) },
            { role: 'user', content: buildUserPrompt(diffResult, contractType, perspective) },
          ],
        });

        for await (const chunk of completion) {
          const text = chunk.choices[0]?.delta?.content ?? '';
          if (text) sendChunk(text);
        }
      } catch (err) {
        controller.enqueue(
          encoder.encode(
            `event: error\ndata: ${JSON.stringify({ message: 'AI 해석에 실패했습니다. diff 뷰는 정상 동작합니다.' })}\n\n`
          )
        );
      } finally {
        controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

### 5-4. 응답 구조 (자유 텍스트 스트리밍)

AI 응답은 구조화된 JSON이 아닌 자유 텍스트 스트리밍으로 반환한다. 클라이언트는 수신된 텍스트를 그대로 누적하여 마크다운 형식으로 렌더링한다.

```
[변경 요약]
총 3개 항목이 변경되었습니다.
1. 계약 기간: 1년 → 2년 (연장)
2. 대금: 1,000만원 → 1,200만원 (20% 인상)
3. 하자보증 조항 신설 (1년)

[변경 맥락]
이번 개정은 계약 기간 연장과 함께...

[유불리 분석]
갑(발주자)에게 유리한 변경:
  - 하자보증 조항 신설 → 공급자(을) 책임 강화
...
```

---

## 6. 색상 시스템

| 변경 유형 | Tailwind 클래스 (배경) | Tailwind 클래스 (텍스트) | 거터 기호 |
|-----------|------------------------|--------------------------|-----------|
| 추가 (Added) | `bg-green-50` | `text-green-800` | `+` |
| 삭제 (Removed) | `bg-red-50` | `text-red-800` | `-` |
| 변경 (Modified) | `bg-yellow-50` | `text-yellow-800` | `~` |
| 동일 (Unchanged) | 없음 (기본 배경) | 없음 (기본 텍스트) | — |

**색약 대응**: 배경색 외에 줄 좌측 거터(gutter)에 `+` / `-` / `~` 기호를 항상 표시하여 색상에만 의존하지 않도록 한다.

**단어 단위 하이라이트** (modified 내부):

| 단어 변경 유형 | 스타일 |
|----------------|--------|
| 삭제된 단어 | `bg-red-200 line-through` |
| 추가된 단어 | `bg-green-200 underline` |

---

## 7. 버전 체인 연동

### 7-1. `documents.parent_id`를 통한 버전 목록 조회

기존 구현된 `GET /api/documents/[id]/versions`는 `parent_id` 체인을 재귀적으로 순회하여 버전 목록을 반환한다. `clio-doc-diff`는 이 API를 그대로 활용하며 DB 변경이 없다.

```sql
-- 버전 체인 재귀 조회 (기존 구현 참고)
WITH RECURSIVE version_chain AS (
  SELECT id, parent_id, version_number, title, created_at
  FROM documents
  WHERE id = $rootId

  UNION ALL

  SELECT d.id, d.parent_id, d.version_number, d.title, d.created_at
  FROM documents d
  JOIN version_chain vc ON d.parent_id = vc.id
)
SELECT * FROM version_chain
ORDER BY version_number ASC;
```

### 7-2. VersionSelector 컴포넌트에서 버전 목록 표시

```
┌──────────────────────────────────┐
│  기준 버전                        │
│  [v1.0  2026-03-01  초안    ▼]   │
├──────────────────────────────────┤
│  비교 버전 (신)                   │
│  [v2.0  2026-04-12  최종    ▼]   │
│                                  │
│  ┌─ 드롭다운 목록 ─────────────┐  │
│  │  v1.0  2026-03-01  초안    │  │
│  │  v2.0  2026-04-12  최종  ✓ │  │
│  └────────────────────────────┘  │
│                                  │
│  [버전 비교 시작]                 │
└──────────────────────────────────┘
```

- 버전 선택 변경 시 URL 쿼리스트링(`?compare=uuid`)을 업데이트하여 공유 링크 자동 생성
- 기준 버전과 동일한 버전은 비교 버전 목록에서 비활성화 처리

---

## 8. 구현 순서 (Phase별 체크리스트)

### Phase 1: Myers diff 알고리즘 유틸 + API (예상 4시간)

- [ ] `lib/utils/myers-diff.ts` — `computeDiff`, `myersEditScript`, `buildDiffLines`, `computeWordDiff` 구현
- [ ] 단위 테스트: 추가/삭제/변경/동일 케이스, modified 병합, 빈 문서 처리
- [ ] `POST /api/documents/[id]/diff/route.ts` — 두 버전 조회 + diff 계산 + 반환
- [ ] 버전 체인 유효성 검증 (동일 parent 체인 여부)
- [ ] RLS 정책 확인 (기존 documents RLS 그대로 상속되는지 검증)

### Phase 2: UI 컴포넌트 — DiffViewer, SideBySide, Inline (예상 6시간)

- [ ] `components/document-diff/DiffViewer.tsx` — 메인 컨테이너, 토글 버튼, 상단 통계 바, 변경 네비게이션 버튼
- [ ] `components/document-diff/SideBySideView.tsx` — 좌우 분할 렌더링, 줄 번호 정렬, 색상 적용
- [ ] `components/document-diff/InlineView.tsx` — 인라인 렌더링, wordDiff 하이라이트
- [ ] `components/document-diff/VersionSelector.tsx` — 버전 드롭다운, 기존 versions API 연동
- [ ] `app/(main)/documents/[id]/diff/page.tsx` — 진입점 페이지, URL 쿼리스트링 연동
- [ ] 문서 상세 페이지에 "버전 비교" 버튼 추가
- [ ] 변경 네비게이션: `changeRefs` 배열 관리 + `scrollIntoView` 구현
- [ ] 동일 버전 비교 시 "변경 사항 없음" 빈 상태 UI

### Phase 3: AI 분석 SSE 스트리밍 (예상 3시간)

- [ ] `POST /api/documents/[id]/diff/analyze/route.ts` — ReadableStream + GPT-4o 스트리밍
- [ ] System / User 프롬프트 빌더 함수 구현 (`buildSystemPrompt`, `buildUserPrompt`)
- [ ] 계약서 유불리 프롬프트 분기 처리 (documentType 기반)
- [ ] `components/document-diff/DiffAnalysisPanel.tsx` — SSE 수신, 스트리밍 텍스트 누적 렌더링
- [ ] AI 오류 시 fallback UI (diff 뷰 유지, 패널에 오류 메시지)
- [ ] diff 없을 시 (stats 모두 0) AI 패널 숨김 처리

### Phase 4: 버전 선택 UI + 진입점 연결 + 검증 (예상 3시간)

- [ ] Quick Compare 버튼 (현재 버전 ↔ 최신 버전) — Could 요구사항
- [ ] URL 쿼리스트링 공유 링크 — `?compare=uuid` 형식 동작 확인
- [ ] 반응형 확인: 1024px 미만에서 Inline 뷰 자동 전환
- [ ] 색약 대응: 거터 기호 + ARIA 레이블 점검
- [ ] 회귀 테스트: 문서 생성, 버전 목록 API, 결재 워크플로우 정상 동작 확인
- [ ] 성능 검증: 10,000자 기준 diff 렌더링 1초 이내, AI TTFB 3초 이내

---

## 9. 아키텍처 레이어 배분

| 컴포넌트 | 레이어 | 경로 |
|----------|--------|------|
| `DiffViewer`, `SideBySideView`, `InlineView`, `DiffAnalysisPanel`, `VersionSelector` | Presentation | `components/document-diff/` |
| `page.tsx` | Presentation | `app/(main)/documents/[id]/diff/` |
| `computeDiff`, `myersEditScript` | Domain (순수 로직) | `lib/utils/myers-diff.ts` |
| `POST /api/documents/[id]/diff` | Infrastructure | `app/api/documents/[id]/diff/route.ts` |
| `POST /api/documents/[id]/diff/analyze` | Infrastructure | `app/api/documents/[id]/diff/analyze/route.ts` |

---

## 10. 보안 고려사항

- [ ] diff API: Supabase RLS 정책 상속 확인 — `auth.uid() = user_id OR organization_id 일치` 조건이 두 버전 모두에 적용되는지 검증
- [ ] analyze API: diff 결과에 민감 정보가 포함될 수 있으므로 OpenAI 전송 전 조직 ID 확인
- [ ] 비교 대상 버전이 동일한 parent_id 체인에 속하지 않으면 400 반환 (타 문서 내용 유출 방지)
- [ ] SSE 응답에 `X-Content-Type-Options: nosniff` 헤더 추가

---

## 11. 에러 처리 정의

| 상황 | 처리 방법 |
|------|-----------|
| 두 버전이 동일한 내용 | "변경 사항이 없습니다" 빈 상태 UI 표시, AI 패널 숨김 |
| GPT-4o API 오류 | diff 뷰 유지, AI 패널에 fallback 메시지 표시 |
| 50,000자 초과 문서 | 경고 배너 + 처음 50,000자만 diff 계산 |
| parent_id 체인 깨짐 | 오류 메시지 + 문서 목록으로 이동 버튼 |
| RLS 차단 (403) | "접근 권한이 없습니다" 전체 페이지 오류 상태 |
| 버전 목록 조회 실패 | VersionSelector 드롭다운 비활성화 + 재시도 버튼 |

---

## 버전 이력

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 0.1 | 2026-04-12 | 최초 작성 | 크로미 |
