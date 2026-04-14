# 문서 관리

[coverage: high -- sources: src/app/(app)/documents/, src/app/api/documents/, src/components/documents/, src/lib/renderers/, src/lib/utils/parse-sections.ts, src/lib/utils/myers-diff.ts, docs/02-design/features/comment-reflect.design.md, docs/02-design/features/clio-doc-diff.design.md, docs/02-design/features/clio-doc-quality.design.md]

---

## Purpose [coverage: high -- 5 sources]

CLIO 문서 관리 시스템은 세 가지 핵심 기능을 중심으로 구성된다:

1. **파일 저장소** — 원본 파일 업로드 + 벡터 임베딩 (AI 문서 생성의 소스 데이터)
2. **AI 생성 문서** — 업로드 파일 기반으로 GPT-4o가 생성하는 구조화된 실무 문서
3. **협업 & 품질 관리** — 댓글 → AI 반영, 버전 비교(diff), AI 품질 검수

결재(approval) 워크플로우는 v6.2.0에서 전면 제거되었으며, 댓글 + AI 반영 시스템으로 대체되었다.

---

## Architecture [coverage: high -- 4 sources]

```
src/
├── app/
│   ├── (app)/documents/
│   │   ├── page.tsx                     ← 문서 목록 + 생성 모달 (Client Component)
│   │   └── [id]/
│   │       └── page.tsx                 ← 문서 뷰어 (Client Component)
│   └── api/documents/
│       ├── route.ts                     ← GET 목록 (parent_id IS NULL 필터)
│       └── [id]/
│           ├── route.ts                 ← GET/PATCH 단건 조회·상태변경
│           ├── download/route.ts        ← 다운로드 (DOCX/HWPX inline 변환)
│           ├── versions/route.ts        ← 버전 목록 (parent_id 체인)
│           ├── comments/route.ts        ← GET/POST 댓글
│           ├── comments/[commentId]/    ← DELETE 댓글
│           ├── apply-comments/route.ts  ← POST 부분 반영 (insert/append 2모드)
│           ├── reflect/route.ts         ← POST 전체 문서 재생성 (레거시)
│           ├── diff/route.ts            ← POST Myers diff 계산
│           └── diff/analyze/route.ts   ← POST GPT-4o diff 해석 (SSE)
├── components/documents/
│   ├── DocumentCommentPanel.tsx         ← 댓글 목록·작성·선택 패널
│   ├── CommentReflectModal.tsx          ← 반영 모드 선택 모달 (v6.4.0)
│   ├── VersionPanel.tsx                 ← 버전 이력 패널
│   ├── QualityCheckPanel.tsx            ← AI 품질 검수 결과 패널
│   ├── ShareLinkModal.tsx               ← 공유 링크 모달
│   └── document-diff/
│       ├── DiffViewer.tsx               ← diff 뷰어 메인 컨테이너
│       ├── SideBySideView.tsx           ← 좌우 분할 뷰
│       ├── InlineView.tsx               ← 인라인 뷰
│       ├── DiffAnalysisPanel.tsx        ← AI 해석 패널 (SSE)
│       └── VersionSelector.tsx          ← 버전 선택 드롭다운
└── lib/
    ├── renderers/
    │   ├── docx-renderer.ts
    │   ├── hwpx-renderer.ts
    │   ├── xlsx-renderer.ts
    │   ├── pptx-renderer.ts
    │   └── pdf-renderer.ts
    └── utils/
        ├── parse-sections.ts            ← ## / ### 섹션 파싱 유틸
        └── myers-diff.ts                ← Myers diff 알고리즘
```

**기술 스택:**
- Next.js 16 App Router, TypeScript, Tailwind CSS
- Supabase (PostgreSQL + RLS)
- OpenAI GPT-4o (문서 생성 · 댓글 반영 · diff 해석 · 품질 검수)
- 파일 렌더러: `docx`, `adm-zip`(HWPX), `exceljs`, `pptxgenjs`, `jspdf`
- diff: Myers 알고리즘 직접 구현 (`lib/utils/myers-diff.ts`)

---

## Document Flow [coverage: high -- 3 sources]

### AI 문서 생성 플로우

```
1. 사용자: 템플릿 선택 + 참조 파일 선택 + 작성 지시사항 + 출력 포맷 선택
2. POST /api/generate
   ├── source_file_ids 로 파일 청크 조회 (벡터 DB)
   ├── 사용자 정보 (name, position, department) 포함
   └── GPT-4o 로 문서 내용 생성 (마크다운 형식)
3. 생성된 문서 documents 테이블 INSERT (status: 'draft')
4. 전자서명 주입: users.signature_path 조회 → "(서명)/(인)" 마커 교체
5. 문서 목록 갱신 → 뷰어 페이지(/documents/[id])로 이동 가능
```

### 문서 상태

```typescript
type DocumentStatus = '초안' | '완료';  // DB: 'draft' | 'completed'
```

- `draft` (초안): 편집 가능. 목록에서 "편집" 버튼 → 편집 모달
- `completed` (완료): 읽기 전용. 목록에서 "보기" 버튼 → 뷰어 페이지(`/documents/[id]`)

### 파일 관리

- 최대 업로드 크기: **50MB**
- 파일명 NFC 정규화 (한글 파일명 호환성 보장)
- `scope: 'company' | 'department'` (기본값: `'department'`)
  - `company`: 로그인한 모든 사용자에게 표시
  - `department`: 같은 부서 사용자만 표시 (RLS 정책: migration 014)
- 텍스트 추출 지원 포맷: PDF(`pdf-parse`), DOCX(`mammoth`), XLSX(`xlsx`), HTML(`cheerio`)

### 출력 포맷

| 포맷 | 렌더러 파일 | 라이브러리 |
|------|------------|-----------|
| DOCX | `docx-renderer.ts` | `docx` |
| HWPX | `hwpx-renderer.ts` | `adm-zip` (XML 조작) |
| XLSX | `xlsx-renderer.ts` | `exceljs` |
| PPTX | `pptx-renderer.ts` | `pptxgenjs` |
| PDF  | `pdf-renderer.ts`  | `jspdf` |

### 문서 뷰어 레이아웃

경로: `src/app/(app)/documents/[id]/page.tsx`

```
/documents/[id]
├── 좌측 (flex-1): 헤더 바 + 스크롤 가능한 문서 본문 (max-w-3xl, 중앙 정렬)
└── 우측 (w-340px): DocumentCommentPanel (inline=true, 항상 노출)
```

**헤더 바 액션:** ← 뒤로 / 상태 배지 / 버전 배지(v2+) / 완료 처리(초안일 때) / 버전 패널 / 다운로드(DOCX) / 편집(초안일 때)

**본문 렌더링:**
- 마크다운 기반 문서: `# ## ###` → h1/h2/h3, `- *` → li, `1. 2.` → li.list-decimal, `---` → hr
- 파일 기반 문서(HWPX/DOCX): `isFileBased()` 판정(첫 줄 `[`로 시작 + 길이 < 200) → `GET /api/documents/[id]/download?inline=true` → Blob URL → iframe 표시
  - `versionNumber` 변경 시 iframe 자동 재fetch (apply-comments 반영 후 자동 갱신)
  - `renderAppendedSections()`: HWPX 원본 파일에 마크다운으로 추가된 섹션을 동일 스타일 HTML 테이블로 변환하여 iframe 내부 주입

### 문서 목록 스냅샷 필터링

`GET /api/documents`는 `.is('parent_id', null)` 조건으로 스냅샷 문서를 자동 제외한다. 문서 목록에는 항상 최신 루트 문서만 표시되며, 이전 버전은 VersionPanel에서 별도 조회한다.

---

## AI 댓글 반영 플로우 [coverage: high -- 3 sources]

### 개요

팀원이 문서에 댓글을 달고, 작성자가 반영할 댓글을 선택하면 GPT-4o가 문서에 통합한다. v6.4.0에서 두 가지 반영 모드가 추가되었다.

### 댓글 시스템

**컴포넌트:** `src/components/documents/DocumentCommentPanel.tsx`

```typescript
interface DocumentCommentPanelProps {
  documentId: string;
  onClose: () => void;
  onReflected?: () => void;       // 반영 완료 후 fetchDoc() 트리거
  inline?: boolean;               // true: 부모 컨테이너 채움
  documentContent?: string;       // 섹션 파싱용 (v6.4.0 추가)
}
```

기능: 댓글 목록(체크박스 선택) / 작성(Enter 제출, Shift+Enter 줄바꿈) / 본인 댓글 삭제 / 선택 댓글 AI 반영(CommentReflectModal 오픈)

**댓글 DB 스키마:**
```sql
CREATE TABLE document_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL CHECK (char_length(content) > 0),
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- RLS: SELECT — 인증된 모든 사용자 / INSERT·DELETE — 본인만
```

### CommentReflectModal (v6.4.0)

경로: `src/components/documents/CommentReflectModal.tsx`

3단계 Step UI:

| Step | 상태값 | 설명 |
|------|--------|------|
| 1 | `select` | 반영 모드 선택: "기존 섹션에 추가" vs "새 단락 만들기" |
| 2a | `insert` | 섹션 목록 제공 → 대상 섹션 선택 |
| 2b | `append` | 새 단락 이름 직접 입력 |

HWPX 파일 기반 문서는 `parseSections()`가 빈 배열을 반환하므로 `HWPX_SECTIONS` 고정값(`정보(자료) 출처`, `보고 내용과 의견`, `문제점`) + 이미 추가된 마크다운 섹션을 합쳐 제공한다.

### apply-comments API

`POST /api/documents/[id]/apply-comments` (`src/app/api/documents/[id]/apply-comments/route.ts`)

**공통 전처리 (모든 모드):**
```
apply 전에 현재 content를 별도 row로 INSERT (스냅샷 저장)
→ version_number 그대로, parent_id = rootId
→ 현재 문서: version_number += 1, content 업데이트
```

**모드 1 — insert (기존 섹션에 삽입):**
```typescript
// Request
{ mode: 'insert', selectedCommentIds: string[], targetSection: string }

// 서버 처리
// 1. extractSectionContent()로 대상 섹션 현재 내용 추출
//    └─ 섹션 없으면(HWPX 라벨 섹션 등) 새 섹션 생성 프롬프트로 전환
// 2. GPT-4o: temperature: 0.3 / max_tokens: 4000
//    - 섹션 있음: "기존 내용 유지하면서 댓글 통합"
//    - 섹션 없음: "새 섹션 내용 작성"
// 3. 섹션 있으면 replaceSectionContent(), 없으면 끝에 ## {targetSection} 추가
// 4. documents.content UPDATE + version_number += 1

// Response
{ success: boolean, updatedContent: string }
```

**모드 2 — append (새 단락 생성):**
```typescript
// Request
{ mode: 'append', selectedCommentIds: string[], newSectionTitle: string }

// 서버 처리
// 1. GPT-4o: "댓글들을 정리해 실무 문서 형식 단락 작성"
//    temperature: 0.3 / max_tokens: 4000
// 2. 새 단락 = ## {newSectionTitle}\n\n{생성내용}
// 3. documents.content 끝에 append + UPDATE + version_number += 1

// Response
{ success: boolean, updatedContent: string }
```

### 반영 플로우 전체

```
1. 댓글 체크박스 선택 → "반영 (N)" 버튼 클릭
2. CommentReflectModal 오픈
   ├── Step 1: 모드 선택
   ├── Step 2a (insert): 섹션 목록에서 선택
   └── Step 2b (append): 새 단락 이름 입력
3. POST /api/documents/[id]/apply-comments
4. onReflected() → fetchDoc() → 뷰어 최신 내용 표시
```

### apply-comments vs reflect 차이점

| 구분 | apply-comments | reflect |
|------|---------------|---------|
| 처리 범위 | 선택 섹션만 부분 수정 또는 새 단락 추가 | 전체 문서 GPT-4o 재생성 |
| 스냅샷 | 자동 저장 | 자동 저장 |
| version_number | +1 | +1 |
| 상태 | 주 API (v6.4.0~) | 레거시 (향후 제거 검토) |

### parse-sections 유틸

경로: `src/lib/utils/parse-sections.ts`

| 함수 | 기능 |
|------|------|
| `parseSections(content)` | `## / ###` 헤더 파싱 → 섹션 제목 배열 반환 |
| `extractSectionContent(content, sectionTitle)` | 특정 섹션의 본문만 추출 |
| `replaceSectionContent(content, sectionTitle, newContent)` | 특정 섹션 내용을 newContent로 교체한 전체 content 반환 |

---

## Diff & 버전 비교 [coverage: high -- 2 sources]

### 개요

Myers diff 알고리즘 기반으로 동일 문서의 두 버전을 비교하고, GPT-4o가 변경 맥락을 자연어로 해석해 주는 AI 강화 diff 뷰어. 계약서 타입일 경우 갑/을 유불리 조항 분류가 추가된다.

### Myers Diff 알고리즘

경로: `src/lib/utils/myers-diff.ts`

**처리 방식:**
1. 두 버전의 content를 `\n` 기준으로 줄 배열로 분할
2. Myers 알고리즘으로 최단 편집 경로(Shortest Edit Script) 계산
3. 각 줄을 `added / removed / unchanged`로 분류
4. 인접한 `removed + added` 쌍을 `modified`로 병합
5. `modified` 줄 내부에서 단어 단위 재귀 diff 실행 → `wordDiff` 생성

**핵심 타입:**
```typescript
type DiffLineType = 'added' | 'removed' | 'unchanged' | 'modified';

type DiffLine = {
  type: DiffLineType;
  oldLine?: number;
  newLine?: number;
  content: string;
  wordDiff?: WordDiff[];  // modified 타입일 때만 존재
};

type DiffResult = {
  lines: DiffLine[];
  stats: { added: number; removed: number; changed: number; unchanged: number };
};
```

**공개 API:**
- `computeDiff(oldText, newText): DiffResult` — 두 문자열을 행 단위 비교

**큰 문서 처리 전략:**

| 문서 크기 | 전략 |
|-----------|------|
| ~10,000자 | 전체 diff 즉시 계산 |
| 10,000~50,000자 | 섹션 단위 분할 후 순차 계산, 뷰포트 내 섹션만 렌더링 |
| 50,000자 초과 | 경고 배너 + 처음 50,000자만 diff 계산 |

### diff API

`POST /api/documents/[id]/diff` (`src/app/api/documents/[id]/diff/route.ts`)

```typescript
// Request Body
{ compareWith: string }  // 비교 대상 document ID

// Response
{
  lines: DiffLine[];
  stats: { added: number; removed: number; changed: number; unchanged: number };
  from: { id: string; versionNumber: number; createdAt: string; title: string };
  to:   { id: string; versionNumber: number; createdAt: string; title: string };
}
```

**처리 흐름:**
1. 두 문서 조회 (Admin 클라이언트)
2. 접근 권한 확인 (작성자 본인 또는 같은 조직)
3. 버전 체인 유효성 검증: `fromRoot !== toRoot` 이고 양쪽 ID가 서로의 root가 아닌 경우 400 반환
4. `computeDiff(fromDoc.content, toDoc.content)` 실행
5. DiffResult + 메타 정보 반환

**에러 코드:**
- `INVALID_VERSION_CHAIN` (400): 두 문서가 같은 버전 체인에 속하지 않음
- `FORBIDDEN` (403): 접근 권한 없음
- `NOT_FOUND` (404): 문서 없음

### diff/analyze API (AI 해석, SSE 스트리밍)

`POST /api/documents/[id]/diff/analyze` — DiffResult를 GPT-4o에 전달하여 변경 내용 해석을 SSE 스트리밍으로 반환.

```typescript
// Request
{
  diffResult: DiffResult;
  contractType?: string;           // 계약서 유형 (예: "용역계약서")
  perspective?: 'buyer' | 'seller'; // 갑/을 입장
}

// SSE 이벤트 형식
event: chunk  → data: {"text": "..."}
event: done   → data: {}
event: error  → data: {"message": "AI 해석에 실패했습니다. diff 뷰는 정상 동작합니다."}
```

계약서 타입이면 [변경 요약] / [변경 맥락] / [유불리 분석] / [법적 주의 사항] 순으로 분석. `unchanged` 줄은 프롬프트에서 제외하여 토큰 절약.

### diff 뷰어 컴포넌트

URL 패턴: `/documents/[id]/diff?compare=[compareWithId]`

| 컴포넌트 | 역할 |
|----------|------|
| `DiffViewer.tsx` | 전체 diff 뷰어 총괄 (Side-by-Side / Inline 토글, 변경 네비게이션, 통계 바) |
| `SideBySideView.tsx` | 구 버전(좌) / 신 버전(우) 나란히 렌더링. `removed`는 좌측, `added`는 우측에만 표시 |
| `InlineView.tsx` | 동일 줄에 삭제(취소선 빨강 `<del>`) + 추가(밑줄 초록 `<ins>`) 인라인 표시 |
| `DiffAnalysisPanel.tsx` | SSE 스트리밍 수신 → 점진적 마크다운 렌더링 |
| `VersionSelector.tsx` | `GET /api/documents/[id]/versions` 활용, 비교 가능 버전 드롭다운 |

**색상 시스템 (색약 대응: 거터 기호 병행):**

| 변경 유형 | 배경 | 거터 기호 |
|-----------|------|----------|
| added | `bg-green-50` | `+` |
| removed | `bg-red-50` | `-` |
| modified | `bg-yellow-50` | `~` |
| unchanged | 기본 | — |

**버전 체인:** 기존 `documents.parent_id` 체인을 그대로 활용. DB 변경 없음.

---

## 품질 검수 (Quality Check) [coverage: high -- 1 source]

### 개요

사용자 요청 시 GPT-4o가 "한국 공문서 전문 교정자" 역할로 맞춤법·공문서 규격·논리 흐름·누락 항목 4개 카테고리를 검수한다. 결과는 `document_quality_checks` 테이블에 저장되어 재열람 시 추가 AI 호출 없이 캐시로 즉시 반환된다.

### 검수 DB 스키마

```sql
CREATE TABLE document_quality_checks (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id   UUID        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  checked_by    UUID        NOT NULL REFERENCES users(id),
  overall_score INTEGER     CHECK (overall_score BETWEEN 0 AND 100),
  result_json   JSONB       NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- 마이그레이션: 010_document_quality_checks.sql
-- RLS: SELECT — 검수 요청자 본인 또는 해당 문서 작성자 / INSERT — 본인만 / UPDATE·DELETE — 불허
```

**인덱스:**
- `(document_id, created_at DESC)` — 문서별 최신 검수 결과 빠른 조회
- `(checked_by, created_at DESC)` — 사용자별 검수 이력 조회

### Quality Check API

`POST /api/quality-check` (`src/app/api/quality-check/route.ts`)

```typescript
// Request
{ document_id: string; force?: boolean }  // force=true: 기존 캐시 무시하고 재검수

// Response
{
  check_id: string;
  document_id: string;
  overall_score: number;       // 0~100
  items: QualityCheckItem[];
  summary: string;
  checked_at: string;
  from_cache: boolean;
}

interface QualityCheckItem {
  category: 'spelling' | 'format' | 'logic' | 'missing';
  severity: 'error' | 'warning' | 'suggestion';
  original: string;       // 원문 인용 (최대 100자)
  suggestion: string;
  description: string;
}
```

**처리 흐름:**
```
1. 세션 인증 확인
2. documents에서 content 조회 (없음 → 404, 타인 문서 → 403, content 비어있음 → 422)
3. force=false: 기존 캐시 조회 → 있으면 from_cache=true로 즉시 반환
4. GPT-4o 호출 (maxDuration: 60초, timeout: 15초, response_format: json_object)
5. QualityCheckResult 타입 검증 → document_quality_checks INSERT
6. from_cache=false로 클라이언트 반환
```

`GET /api/quality-check?document_id={id}` — 최신 저장 결과 조회 (없으면 `check_id: null`)

### 품질 검수 컴포넌트

| 파일 | 역할 |
|------|------|
| `QualityCheckPanel.tsx` | 검수 결과 패널 메인 UI (문서 뷰어에서 접근) |
| `QualityCheckBadge.tsx` | severity 배지 (error/warning/suggestion) |
| `QualityCheckItem.tsx` | 개별 검수 항목 카드 |
| `hooks/useQualityCheck.ts` | 검수 API 호출 + 상태 관리 훅 |
| `lib/api/qualityCheck.ts` | API 클라이언트 함수 |

---

## API Surface [coverage: high -- 3 sources]

### 문서 · 파일 API 전체 목록

| 경로 | 메서드 | 설명 |
|------|--------|------|
| `/api/files` | GET/POST | 파일 목록 / 업로드 |
| `/api/files/[id]` | DELETE/PATCH | 파일 삭제 / 공개범위 변경 |
| `/api/generate` | POST | AI 문서 생성 (GPT-4o) |
| `/api/documents` | GET | 문서 목록 (`parent_id IS NULL` 필터, 스냅샷 제외) |
| `/api/documents/[id]` | GET/PATCH | 문서 단건 조회 / 상태 변경 |
| `/api/documents/[id]/download` | GET | 문서 다운로드 (`?inline=true` 시 HTML 변환) |
| `/api/documents/[id]/versions` | GET | 버전 목록 (parent_id 체인 재귀 조회) |
| `/api/documents/[id]/comments` | GET/POST | 댓글 목록(작성자 이름 포함) / 댓글 작성 |
| `/api/documents/[id]/comments/[commentId]` | DELETE | 댓글 삭제 (본인만) |
| `/api/documents/[id]/apply-comments` | POST | 부분 반영: insert(섹션 삽입) / append(새 단락) 2모드 |
| `/api/documents/[id]/reflect` | POST | 전체 문서 GPT-4o 재생성 (레거시) |
| `/api/documents/[id]/diff` | POST | Myers diff 계산 + 메타 반환 |
| `/api/documents/[id]/diff/analyze` | POST | diff GPT-4o 해석 (SSE 스트리밍) |
| `/api/quality-check` | GET/POST | 품질 검수 결과 조회 / 검수 요청 |
| `/api/templates` | GET/POST | 템플릿 목록 / 생성 |
| `/api/transcribe` | POST | STT 회의록 (Whisper-1) |

### 공통 인증 패턴

모든 Route Handler는 `createServerSupabaseClient()` + `getAuthUserId()` 조합으로 세션 확인. DB 쓰기 작업은 `createAdminSupabaseClient()` (서비스 롤키)로 RLS 우회하여 처리.

### comments API 상세

```typescript
// GET /api/documents/[id]/comments
// Response
{ success: true, comments: Array<{ id, content, created_at, user_id, user_name }> }

// POST /api/documents/[id]/comments
// Request: { content: string }
// Response: { success: true, comment: { id, content, created_at, user_id, user_name } }
```

---

## Key Decisions [coverage: medium -- 3 sources]

1. **결재(approval) 시스템 제거 (v6.2.0):** 결재 워크플로우가 댓글 + AI 반영 시스템으로 전면 대체되었다. 결재선 설정, 결재 승인/반려 기능이 모두 제거됨.

2. **apply-comments가 reflect를 대체:** `reflect` API는 전체 문서를 GPT-4o로 재생성하여 의도치 않은 내용 변경 위험이 있었다. `apply-comments`는 선택 섹션만 부분 수정하거나 새 단락을 추가하여 정교한 반영이 가능하다. `reflect`는 레거시로 유지 중이며 향후 제거 검토.

3. **스냅샷 방식 버전 관리:** 반영 전 현재 content를 별도 row로 INSERT한 뒤 version_number를 증가시킨다. `parent_id IS NULL` 필터로 목록에서 스냅샷을 자동 제외하므로 별도 아카이브 테이블이 불필요하다.

4. **Myers diff — DB 변경 없음:** diff 기능은 기존 `documents.parent_id` 버전 체인을 그대로 활용한다. 별도 diff 저장 테이블을 만들지 않고 요청 시 실시간 계산하여 반환한다.

5. **품질 검수 캐싱:** `document_quality_checks` 테이블에 저장된 최신 결과를 재열람 시 반환(`from_cache=true`)하여 GPT-4o 중복 호출을 방지한다. `force=true`로만 재검수 가능.

6. **HWPX 파일 기반 문서의 섹션 파싱 한계:** HWPX 파일은 마크다운 헤더(`## ...`)가 없으므로 `parseSections()`가 빈 배열을 반환한다. `CommentReflectModal`은 `HWPX_SECTIONS` 고정값으로 폴백한다.

---

## Tech Debt [coverage: low -- 2 sources]

- **`reflect` API 레거시:** `POST /api/documents/[id]/reflect`는 `apply-comments` 도입 후 레거시 상태이나 아직 코드베이스에 존재한다. `DocumentCommentPanel`의 반영 버튼은 이미 `apply-comments`로 전환되었으나 `reflect` 제거는 미완.

- **diff/analyze API 구현 상태 미확인:** `clio-doc-diff.design.md`에 `POST /api/documents/[id]/diff/analyze`가 설계되었으나 실제 구현 파일의 존재 여부를 이 위키 컴파일 시점에서 직접 확인하지 못했다. `diff/route.ts`는 확인됨.

- **diff 뷰어 페이지 구현 상태:** `app/(main)/documents/[id]/diff/page.tsx` 및 `components/document-diff/` 컴포넌트들이 설계서에는 정의되어 있으나 실제 구현 완료 여부는 원본 파일 직접 확인 필요.

- **품질 검수 API 구현 상태:** `clio-doc-quality.design.md`가 Draft 상태이며 `src/app/api/quality-check/route.ts` 실제 구현 여부는 확인 필요. `documents/page.tsx`에서 `QualityCheckPanel` 컴포넌트는 import되어 있음.

- **diff 접근 권한 로직 불완전:** `diff/route.ts`에서 두 문서 중 하나만 본인 작성인 경우의 처리 로직에 의도치 않은 허용 케이스가 있을 수 있다 (74번째 줄 조건 검토 필요).

---

## Gotchas [coverage: medium -- 3 sources]

- **HWPX iframe 재fetch 트리거:** `versionNumber`가 변경될 때만 iframe이 재fetch된다. `apply-comments` 성공 후 `fetchDoc()`을 반드시 호출해야 한다. `onReflected` 콜백이 누락되면 뷰어가 갱신되지 않는다.

- **스냅샷 문서의 parent_id 체인:** `apply-comments` 실행 시 `rootId = doc.parent_id ?? documentId`로 계산한다. 루트 문서(parent_id가 null)에 적용하면 스냅샷의 parent_id는 자기 자신 id가 된다. 버전 체인이 올바르게 유지되려면 루트 문서 기준으로 반영해야 한다.

- **`parent_id` 업데이트 조건:** `apply-comments`에서 현재 문서를 UPDATE 할 때 `parent_id: rootId === documentId ? null : rootId` 처리로 루트 문서는 parent_id를 null로 유지한다.

- **섹션 없는 HWPX 문서에 insert 모드 사용:** `extractSectionContent()`가 빈 문자열을 반환하면 서버는 자동으로 "새 섹션 생성" 프롬프트로 전환하여 content 끝에 `## {targetSection}` 형태로 추가한다. 이 경우 원본 HWPX 파일은 수정되지 않고 마크다운 섹션만 content에 추가된다.

- **diff 버전 체인 검증 로직:** `fromRoot !== toRoot` 이더라도 `fromDoc.id === toRoot` 또는 `toDoc.id === fromRoot`인 경우 허용한다. 즉 한쪽이 다른 쪽의 직접 부모인 경우에도 비교 가능하다.

- **품질 검수 결과 수정 불허:** `document_quality_checks`는 UPDATE RLS가 없다. 재검수는 항상 새 행을 INSERT하는 방식이며, 최신 결과는 `created_at DESC LIMIT 1`로 조회한다.

- **출력 포맷 선택과 파일 기반 판정:** 생성 시 HWPX를 선택하면 `storage_path`가 채워지고 `isFileBased()`가 true를 반환한다. DOCX/PDF는 content에 마크다운으로 저장되어 마크다운 렌더러를 사용한다.

---

## Sources [coverage: high -- 10 sources]

- `/Users/watchers/Desktop/clio-project/src/app/(app)/documents/page.tsx`
- `/Users/watchers/Desktop/clio-project/src/app/(app)/documents/[id]/page.tsx`
- `/Users/watchers/Desktop/clio-project/src/app/api/documents/[id]/apply-comments/route.ts`
- `/Users/watchers/Desktop/clio-project/src/app/api/documents/[id]/comments/route.ts`
- `/Users/watchers/Desktop/clio-project/src/app/api/documents/[id]/diff/route.ts`
- `/Users/watchers/Desktop/clio-project/src/app/api/documents/[id]/reflect/route.ts`
- `/Users/watchers/Desktop/clio-project/src/components/documents/DocumentCommentPanel.tsx`
- `/Users/watchers/Desktop/clio-project/src/components/documents/CommentReflectModal.tsx`
- `/Users/watchers/Desktop/clio-project/src/lib/utils/parse-sections.ts`
- `/Users/watchers/Desktop/clio-project/docs/02-design/features/comment-reflect.design.md`
- `/Users/watchers/Desktop/clio-project/docs/02-design/features/clio-doc-diff.design.md`
- `/Users/watchers/Desktop/clio-project/docs/02-design/features/clio-doc-quality.design.md`
