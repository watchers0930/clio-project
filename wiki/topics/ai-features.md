# AI 기능

[coverage: high -- sources: clio-contract-risk.design.md, clio-contract-suggest.design.md, clio-recording-stt.design.md, clio-meeting-todo.design.md, clio-expiry-alert.design.md, contract-risk-analyzer.ts, extract-todos.ts, extract-expiry.ts, transcribe/route.ts, quality-check/route.ts, suggest/route.ts, apply/route.ts, clause-extractor.ts, clause-replacer.ts, memo-insight.plan.md, memo-graph.plan.md, memo-clustering.ts, memos/graph/route.ts, memos/groups/route.ts, memos/groups/suggest/route.ts, memos/[id]/embed/route.ts, memos/[id]/related/route.ts, embed-document.ts, 022_document_embeddings.sql, search/route.ts, documents/route.ts, documents/[id]/route.ts, documents/embed-all/route.ts]

---

## Purpose [coverage: high -- 9 sources]

CLIO의 AI 기능은 OpenAI GPT-4o / Whisper를 기반으로, 문서 관련 반복 수작업을 자동화한다. 주요 역할은 다음 다섯 가지다.

1. **STT 회의록**: 오디오 파일 또는 브라우저 직접 녹음 → Whisper-1 변환 → GPT-4o 요약 → 회의록 자동 생성
2. **할일 추출**: 회의록 텍스트에서 액션 아이템·담당자·기한을 GPT-4o로 구조화하여 `todos` 테이블에 등록
3. **계약서 리스크 분석**: DOCX/HWPX/PDF 계약서를 25개 항목으로 분류 분석, 리포트 생성 + DOCX 다운로드
4. **법령 기반 수정 제안** (v6.5.0): 리스크 항목 선택 → RAG로 관련 법령 검색 → GPT-4o 수정 조항 생성 → DOCX/HWPX 파일에 적용 후 다운로드
5. **만료일 추출**: 파일 업로드 시 GPT-4o가 계약 만료일을 자동 추출 → `schedules` 테이블 등록 + 앱 진입 시 D-30 알림
6. **문서 품질 검수**: 공문서 맞춤법·규격·논리·누락 항목을 GPT-4o가 검수하여 점수 및 수정 제안 반환

부차 기능으로 벡터 임베딩 기반 시맨틱 검색, 문서 생성(generate), AI Q&A 채팅, 댓글 부분 반영도 포함된다.

---

## AI 파이프라인 전체 구조 [coverage: high -- 9 sources]

```
src/lib/ai/
├── transcribe.ts          Whisper-1 STT (오디오 → 텍스트)
├── summarize.ts           GPT-4o-mini 회의록 요약
├── extract-todos.ts       GPT-4o 할일 추출 + todos INSERT
├── extract-expiry.ts      GPT-4o 계약 만료일 추출
├── contract-risk-analyzer.ts  GPT-4o 계약서 25개 항목 리스크 분석
├── generate-document.ts   GPT-4o 문서 생성
├── embeddings.ts          text-embedding-3-small 벡터화 → file_chunks
├── embed-document.ts      text-embedding-3-small 벡터화 → document_embeddings (AI 생성 문서용)
├── chunk-text.ts          텍스트 청킹
├── extract-text.ts        파일에서 텍스트 추출 (PDF/DOCX/XLSX/HTML)
└── analyze-template.ts    템플릿 플레이스홀더 분석
```

**모델 할당 요약**

| 기능 | 모델 | SDK |
|------|------|-----|
| STT 변환 | `whisper-1` | OpenAI SDK 직접 |
| 회의록 요약 | `gpt-4o-mini` | Vercel AI SDK |
| 할일 추출 | `gpt-4o` | Vercel AI SDK (`generateText`) |
| 만료일 추출 | `gpt-4o` | Vercel AI SDK (`generateText`) |
| 계약서 리스크 분석 | `gpt-4o` | OpenAI SDK (`response_format: json_object`) |
| 문서 품질 검수 | `gpt-4o` | OpenAI SDK (`response_format: json_object`) |
| 문서 생성 | `gpt-4o` | Vercel AI SDK |
| 벡터 임베딩 | `text-embedding-3-small` | OpenAI SDK |
| AI Q&A 채팅 | `gpt-4o-mini` | Vercel AI SDK |
| 댓글 부분 반영 | `gpt-4o` | Vercel AI SDK |

---

## 문서 생성 AI [coverage: high -- 2 sources]

```
POST /api/generate
  ├── 입력: template_id, source_file_ids, instructions
  ├── source_file_ids의 청크 내용 수집 (벡터 검색 or 직접 조회)
  ├── 사용자 정보(name, position, department) 컨텍스트 포함
  └── GPT-4o 프롬프트 구성 → 문서 내용 생성 → 선택 포맷 렌더링
```

- `userData?.position` 이 `undefined`이면 직급 누락 → migration 006으로 수정됨
- 댓글 부분 반영 (`/api/documents/[id]/apply-comments`): `insert`(섹션 수정) / `append`(새 단락 추가) 두 가지 모드, model=`gpt-4o`, temperature=`0.3`, max_tokens=`4000`

---

## 계약서 리스크 분석 [coverage: high -- 3 sources]

### 개요

계약서 파일(DOCX / HWPX / PDF, 최대 20MB)을 업로드하면 GPT-4o가 **25개 항목**을 분석하여 리스크 수준(상/중/하)별로 분류된 리포트를 반환한다. 결과는 `contract_risk_analyses` 테이블(JSONB)에 저장되며 DOCX로 다운로드할 수 있다.

### 분석 항목 구조 (`src/lib/contract-risk-items.ts`)

총 25개 항목이 3개 카테고리로 분류된다.

| 카테고리 | ID 범위 | 설명 |
|----------|---------|------|
| `unfavorable` (불리한 조항) | A-01 ~ A-10 | 일방적 해지권, 손해배상 무제한, 지체상금 과다, 지식재산권 전량 이전 등 |
| `missing` (필수 항목 누락) | B-01 ~ B-10 | 계약 목적물 명세 누락, 납기 기준 미정의, 검수 기준 미정의, 지식재산권 귀속 누락 등 |
| `ambiguous` (모호한 표현) | C-01 ~ C-05 | "성실히 이행한다" 같은 정량화 미비 표현, 협의 불발 처리 기준 없음 등 |

기본 리스크 등급 `high`인 항목: A-02(손해배상 무제한), A-06(지식재산권 전량 이전), B-01(계약 목적물 누락), B-02(납기 기준 누락), B-04(대금 지급 조건 누락), B-09(지식재산권 귀속 누락), C-04(금액/기간 별도 문서 참조인데 첨부 없음).

### 핵심 구현 (`src/lib/ai/contract-risk-analyzer.ts`)

- 입력 텍스트 최대 60,000자 (`MAX_TEXT_CHARS`) — 초과 시 truncate
- GPT-4o 호출: temperature=`0.2`, max_tokens=`8000`, `response_format: json_object`
- 타임아웃: 55초 (`AbortController`)
- 응답 구조: `{ items: RiskItem[], summary: string }` — 25개 전체 항목 필수 반환
- `found=true` 항목만 risk_count에 집계 (high/medium/low 카운트)

### API Surface

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/contract-risk/analyze` | 파일 업로드 + GPT-4o 분석 실행 |
| GET | `/api/contract-risk/history` | 분석 이력 목록 (최신순, 페이지네이션) |
| GET | `/api/contract-risk/[id]` | 분석 결과 상세 |
| GET | `/api/contract-risk/[id]/download` | DOCX 리포트 다운로드 |

### DB 스키마 (`contract_risk_analyses`)

```sql
id, user_id, file_name, file_type (docx|hwpx|pdf),
contract_type (system|maintenance|software|general),
perspective (seller_side|buyer_side),
raw_text, risk_result (JSONB), risk_count (JSONB),
status (pending|processing|done|error),
created_at, updated_at
```

RLS: 본인 데이터(`user_id = auth.uid()`)만 SELECT/INSERT/UPDATE/DELETE.

---

## 법령 기반 계약 수정 제안 (v6.5.0) [coverage: high -- 4 sources]

### 개요

계약서 리스크 분석 완료 후, 사용자가 수정이 필요한 항목을 선택하면 RAG로 관련 법령을 검색하고 GPT-4o가 수정 조항을 생성한다. 수정 내용은 원본 파일(DOCX/HWPX)에 직접 적용 후 다운로드할 수 있다.

### 전체 흐름

```
1. 계약서 리스크 분석 (`/api/contract-risk/analyze`)
   → GPT-4o 25개 항목 분석 → DB 저장
   → 원본 파일 Supabase Storage 업로드 (v6.5.1 추가)
      버킷: files, 경로: contract-risk/{userId}/{file_name}

2. 수정 제안 생성 (`POST /api/contract-risk/[id]/suggest`)
   → 선택된 item_keys[] 순회
   → 각 항목별:
     a. clause-extractor.ts: 원문 텍스트에서 해당 조항 발췌
     b. law-embedder.ts: OpenAI 임베딩 → law_chunks 테이블 pgvector 검색 (상위 3개)
     c. GPT-4o: 관련 법령 + 원문 컨텍스트로 수정 조항 생성 + 이유 설명
   → SuggestionItem[] 반환 (streaming 없음, 전체 완료 후 JSON)

3. 수정 적용 다운로드 (`POST /api/contract-risk/[id]/apply`)
   → Supabase Storage에서 원본 파일 다운로드
      버킷: files, 경로: contract-risk/{userId}/{file_name}
   → clause-replacer.ts: accepted 상태 항목의 original → revised 텍스트 교체
   → outputFormat(docx|hwpx)으로 렌더링
   → 응답 binary (Content-Disposition: attachment)
```

### DB 스키마 추가: `law_chunks` 테이블

```sql
id uuid PRIMARY KEY,
law_name text,        -- 법령명 (예: '근로기준법')
article_no text,      -- 조 번호 (예: '제17조')
clause_no text,       -- 항 번호 (예: '제1항', null 가능)
content text,         -- 법령 조문 내용
category law_category, -- 'payment'|'penalty'|'termination'|'privacy'|'general'
embedding vector(1536) -- text-embedding-3-small
```

RLS: 미적용 — 공개 데이터. 전체 사용자가 SELECT 가능.

시드: `POST /api/laws/seed` → `src/lib/laws/law-seed-data.ts`에서 데이터 로드 → 임베딩 생성 → INSERT.

### 핵심 모듈

| 파일 | 역할 |
|------|------|
| `src/lib/contract-suggest/clause-extractor.ts` | 계약서 원문에서 리스크 항목에 해당하는 조항 발췌 |
| `src/lib/contract-suggest/clause-replacer.ts` | 수정 제안 적용: original→revised 치환 후 DOCX/HWPX 생성 |
| `src/lib/laws/law-embedder.ts` | 쿼리 임베딩 → law_chunks pgvector 유사도 검색 (코사인) |
| `src/lib/laws/law-seed-data.ts` | 법령 시드 데이터 (근로기준법, 하도급법, 민법 등) |

### UI 구조 (2컬럼 suggest 모드)

```
/contract-risk/[id] 페이지 — suggest 모드 활성화 시:

┌─────────────────────┬────────────────────────────────┐
│  RiskItemSidebar    │  SuggestionPanel               │
│  (240px 고정)       │  (나머지 flex)                  │
│                     │                                 │
│  [체크박스] 항목목록 │  [선택 항목 상세]               │
│  - 리스크 아이콘    │  - 원문 조항                    │
│  - 항목 ID/이름     │  - 관련 법령 (LawReferenceCard) │
│  - 적용됨/건너뜀    │  - 수정 제안 (RevisedClauseBox) │
│                     │  - 수정 이유                    │
│  [수정 제안 받기]   │  - 건너뜀/이 조항 적용 버튼    │
└─────────────────────┴────────────────────────────────┘
```

컴포넌트 파일:
- `src/components/contract-risk/RiskItemSidebar.tsx` — 좌측 항목 목록, 체크박스, 결정 상태 표시
- `src/components/contract-risk/SuggestionPanel.tsx` — 우측 패널, 로딩 스켈레톤, accept/skip 액션
- `src/components/contract-risk/LawReferenceCard.tsx` — 유사도 % 표시, 150자 이상 시 펼치기
- `src/components/contract-risk/RevisedClauseBox.tsx` — 수정 제안 텍스트 + 복사 버튼

### Gotchas

- **Storage 경로**: `files` 버킷 + `contract-risk/{userId}/{file_name}` — `contract-files` 버킷은 존재하지 않음 (v6.5.1 수정)
- **v6.5.1 이전 분석 레코드**: analyze 당시 Storage 업로드가 없었으므로 apply 다운로드 불가 — 재분석 필요
- **suggest API는 스트리밍 없음**: 모든 항목 처리 완료 후 JSON 일괄 반환. 항목이 많으면 응답 지연 가능
- **법령 시드**: `POST /api/laws/seed`를 최초 1회 실행해야 `law_chunks` 테이블에 데이터가 채워짐. 미실행 시 법령 검색 결과 없음 (suggest는 동작하지만 laws: [] 반환)

### API Surface

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/contract-risk/[id]/suggest` | 선택 항목 RAG+GPT 수정 제안 생성 |
| POST | `/api/contract-risk/[id]/apply` | 수정 적용 후 DOCX/HWPX 다운로드 |
| GET | `/api/contract-risk/[id]/download` | 리스크 분석 DOCX 리포트 다운로드 |
| POST | `/api/laws/seed` | 법령 시드 데이터 임베딩 후 INSERT |
| POST | `/api/legal-search` | 법령 검색 (keyword → 유사도 검색) |

---

## STT 회의록 생성 [coverage: high -- 3 sources]

### 파이프라인 (`POST /api/transcribe`)

```
1. 파일 크기 검증 (최대 25MB)
2. Whisper-1 STT → transcript 텍스트
3. GPT-4o-mini summarizeTranscript() → { summary, keyPoints, actionItems }
4. documents 테이블에 회의록 자동 INSERT (template: '회의록')
5. extractTodosFromText(transcript) → extractedTodos 배열
6. audit_logs INSERT
7. 응답: { transcript, summary, document, extractedTodos }
```

- 빈 transcript 시 422 반환
- 요약 실패 시 fallback: `summary = transcript.slice(0, 500)`, `keyPoints/actionItems = []`
- 할일 추출 실패는 조용히 무시 — `extractedTodos: []` 반환, 회의록 생성 중단 없음

### 브라우저 직접 녹음 (v5.11.0 설계 — `clio-recording-stt.design.md`)

- `MediaRecorder API` 기반, 라이브러리 없음
- Chrome: `audio/webm;codecs=opus`, Safari: `audio/mp4` (Whisper 양쪽 지원)
- 최대 녹음 시간: 600초(10분) — Vercel 4.5MB 요청 제한 대응
- 완성 Blob을 기존 `/api/transcribe`에 FormData로 전송 (서버 변경 없음)
- 신규 훅: `src/hooks/useAudioRecorder.ts`, 신규 컴포넌트: `src/components/common/AudioRecorder.tsx`

### 오디오 포맷

| 포맷 | MIME | 지원 브라우저 |
|------|------|-------------|
| WebM (Opus) | `audio/webm;codecs=opus` | Chrome, Edge |
| MP4 | `audio/mp4` | Safari |

---

## 할일 추출 (Todo Extract) [coverage: high -- 3 sources]

### 동작 흐름

회의록 텍스트(최대 15,000자)를 GPT-4o로 분석하여 액션 아이템·담당자·기한을 JSON으로 추출하고, 사용자가 `TodoExtractModal`에서 선택한 항목만 `todos` 테이블에 INSERT한다.

```
extractTodosFromText(transcript)
  → GPT-4o (temperature=0.1, maxTokens=2000)
  → JSON 파싱: { todos: ExtractedTodo[] }
  → 빈 title 필터링
  → 반환 (실패 시 [] 반환, 예외 throw 없음)

insertExtractedTodos(selectedTodos, docTitle, requestUserId)
  → 각 todo마다 resolveAssigneeUserId() 호출
      → users 테이블 ilike 조회 → 미일치 시 requestUserId fallback
  → admin 클라이언트로 todos INSERT (RLS bypass, user_id 직접 지정)
  → TodoInsertResult { inserted, skipped, todos } 반환

saveTodoExtractionHistory(documentId, extractedBy, todoIds)
  → todo_extractions 테이블 INSERT (FR-10 중복 방지 추적)
```

### ExtractedTodo 타입 (`src/lib/ai/extract-todos.ts`)

```typescript
interface ExtractedTodo {
  title: string;           // 필수, 빈 문자열 불허
  assigneeName: string;    // 담당자 이름 텍스트 (빈 문자열 가능)
  dueDate: string | null;  // ISO 날짜 YYYY-MM-DD 또는 null
  priority: 'high' | 'medium' | 'low';
}
```

### 프롬프트 특이사항

- 상대적 날짜 표현("다음 주", "3일 후")은 오늘 날짜 기준으로 계산하도록 오늘 날짜를 user prompt에 삽입
- priority 판단: "긴급/오늘까지/내일까지" → high, "여유/나중에/검토해보면" → low, 그 외 → medium

### DB 관련

- `todos` 테이블: 기존 스키마 그대로 활용 (마이그레이션 없음)
- `todo_extractions` 테이블: `010_meeting_todos.sql`로 신규 생성 (P2) — document_id별 추출 이력 추적
- RLS: `extracted_by = auth.uid()` 조건으로 본인 이력만 조회/입력 가능

### API Surface

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/transcribe` | STT + 요약 + 할일 추출 통합 (기존 수정) |
| POST | `/api/todos/extract` | 기존 document_id 기반 재추출 + 선택 등록 |

---

## 만료일 추출 [coverage: medium -- 3 sources]

### 동작 흐름

파일 업로드 후처리 파이프라인에서 비동기로 `POST /api/files/[id]/extract-expiry`를 호출한다. GPT-4o가 파일 텍스트 앞 8,000자(`MAX_CHARS`)에서 만료일을 추출하고, confidence가 `none`이 아닌 경우만 `schedules` 테이블에 INSERT한다.

```
extractExpiryFromText(text)  [src/lib/ai/extract-expiry.ts]
  → 텍스트 최대 8,000자 truncate
  → GPT-4o (temperature=0.1, maxOutputTokens=500)
  → JSON 파싱: ExpiryExtractResult
  → 날짜 형식 검증 (YYYY-MM-DD regex)
  → 실패 시 { confidence: 'none' } 반환 (예외 throw 없음)
```

### ExpiryExtractResult 타입

```typescript
interface ExpiryExtractResult {
  expiry_date: string | null;      // 'YYYY-MM-DD'
  contract_period: string | null;  // 'YYYY-MM-DD ~ YYYY-MM-DD'
  document_type: string;           // 감지된 문서 유형
  confidence: 'high' | 'low' | 'none';
  reason: string;
}
```

- confidence `high`: 계약 종료일/만료일/유효기간 종료일이 명시된 경우
- confidence `low`: 날짜는 있지만 만료일 여부가 불확실한 경우
- confidence `none`: 날짜 정보 없거나 추출 불가 → schedules INSERT 생략

### DB 관련

- `schedules` 테이블에 컬럼 3개 추가 (`012_schedules_expiry.sql`): `source_type`, `source_id`, `expiry_confidence`
- `source_type = 'document_expiry'`로 AI 자동 추출 일정 구분
- 기존 RLS (`user_id = auth.uid()`) 그대로 적용

### 앱 진입 시 알림

- `ExpiryAlertProvider` (React Context)가 앱 마운트 시 `GET /api/dashboard/expiry-summary` 호출
- D-30 이내 만료 문서가 있으면 `ExpiryAlertModal` 팝업 표시
- "오늘 다시 보지 않기" 상태는 `localStorage`(`expiry_modal_suppressed_date`)에서만 관리 — 외부 알림 서비스 없음

### API Surface

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/files/[id]/extract-expiry` | AI 만료일 추출 + schedules 등록 |
| GET | `/api/dashboard/expiry-summary` | D-30 이내 만료 문서 목록 |
| PATCH | `/api/files/[id]/expiry` | 만료일 수동 수정 |

---

## 문서 품질 검수 [coverage: medium -- 2 sources]

### 동작 흐름 (`/api/quality-check`)

```
POST /api/quality-check { document_id, force? }
  1. documents 테이블에서 content 조회 (admin 클라이언트, RLS bypass)
  2. created_by !== authUserId → 403
  3. force=false이면 document_quality_checks에서 캐시 조회 → 있으면 즉시 반환
  4. GPT-4o 호출 (temperature=0.1, max_tokens=2048, response_format: json_object)
     → 문서 내용 최대 10,000자 truncate
     → 타임아웃: 15초
  5. 결과 document_quality_checks 테이블에 INSERT
  6. QualityCheckResponse 반환

GET /api/quality-check?document_id={id}
  → 최신 캐시 조회 후 반환
```

### 검수 카테고리 4종

| 카테고리 | 차감 점수 | 주요 검사 항목 |
|----------|----------|--------------|
| `spelling` | -5점/건 | 한글 맞춤법, 외래어 표기, 높임말 혼용 |
| `format` | -5점/건 | 날짜 표기("2026. 4. 12."), 금액 표기, 문단 번호 체계 |
| `logic` | -3점/건 | 논리 흐름, 중복 표현, 결론 없는 열거 |
| `missing` | -8점/건 | 수신기관/발신일/문서번호 누락, 첨부파일 목록 누락 |

`overall_score`: 0~100, 각 항목 차감 방식. `severity`: `error` / `warning` / `suggestion`.

---

## 문서 자동채우기 (Autofill, v6.7.0+) [coverage: medium -- 1 source]

### 개요

DOCX/HWPX/HWP 파일의 빈 필드를 자동 감지하고 GPT-4o로 필드명을 추론한 뒤, 사용자 DB 정보(이름/직급/부서/날짜)를 자동 매핑해 채워진 파일을 다운로드할 수 있다.

### 전체 흐름

```
1. POST /api/autofill/analyze
   → 파일 업로드 (최대 20MB, docx/hwpx/hwp)
   → analyzeDocumentStructure(): 빈칸/언더라인/대괄호/플레이스홀더 감지
   → GPT-4o로 각 필드명 추론 + confidence 분류 (high/medium/low)
   → 이름/직급/부서/날짜 키워드 매칭으로 DB 값 자동 매핑 (autoMapped=true)
   → autofill_sessions 레코드 생성 → 세션 ID 반환

2. POST /api/autofill/generate { session_id, filled_values }
   → autofill_sessions에서 detected_fields 조회
   → filled_values를 파일에 치환
   → 채워진 파일 바이너리 반환 (Content-Disposition: attachment)
```

### DetectedField 타입

```typescript
interface DetectedField {
  key: string;
  label: string;
  type: 'blank' | 'placeholder' | 'underline' | 'bracket';
  location: string;
  context?: string;
  inferredName?: string;    // GPT-4o 추론 필드명
  confidence: 'high' | 'medium' | 'low';
  autoMapped?: boolean;     // 이름/직급/부서/날짜 자동 매핑됨
  autoValue?: string;       // 자동 매핑된 값
}
```

### 자동 매핑 키워드

| 타입 | 키워드 |
|------|--------|
| 날짜 | 날짜, 일자, 일시, 작성일, 계약일, 체결일, 기준일, 신청일, 등록일 |
| 이름 | 이름, 성명, 작성자, 담당자, 신청자, 대표자 |
| 직급 | 직급, 직위, 직책, 직함 |
| 부서 | 부서, 소속, 팀, 부서명, 소속팀 |

날짜는 `{연도}년 {월}월 {일}일` 형식으로 오늘 날짜 자동 입력.

### DB 스키마 (`autofill_sessions`, migration 017)

```
id, user_id, file_name, file_type (docx|hwpx|hwp),
detected_fields JSONB,  -- DetectedField[]
filled_values JSONB,    -- key→value 최종 매핑
status (pending|analyzed|completed|error),
output_path
```

RLS: 본인 세션만 접근.

### API Surface

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/autofill/analyze` | 파일 분석 + 세션 생성 | 
| POST | `/api/autofill/generate` | 채워진 파일 다운로드 |

---

## 벡터 검색 [coverage: high -- 4 sources]

### 파이프라인 개요 (v7.7.0 통합 검색)

**파일 임베딩 파이프라인** (기존):
```
extract-text.ts → chunk-text.ts → embeddings.ts
  → OpenAI text-embedding-3-small
  → file_chunks 테이블 (pgvector) 저장
```

**문서 임베딩 파이프라인** (v7.7.0 신규):
```
embed-document.ts
  → content 최대 8,000자 truncate
  → OpenAI text-embedding-3-small → vector(1536)
  → document_embeddings 테이블 UPSERT (onConflict: document_id)
  → admin 클라이언트 사용 (RLS bypass)

트리거:
  POST /api/documents       (신규 문서 생성 후 fire-and-forget)
  PATCH /api/documents/[id] (content 변경 시에만 재임베딩)
```

### 통합 검색 (`POST /api/search`) — v7.7.0

```
1. Promise.all 병렬 조회:
   ├── documents: title.ilike.%keyword%  (admin 클라이언트)
   ├── work_logs: done/plan/note/log_date 필드 매칭  (admin 클라이언트)
   ├── file_chunks: name.ilike.%keyword%  (텍스트 폴백)
   └── document_embeddings: match_document_embeddings RPC

2. 벡터 검색:
   ├── file_chunks     → match_file_chunks RPC     threshold: 0.3
   └── document_embeddings → match_document_embeddings RPC  threshold: 0.15

3. 결과 병합 → GPT-4o 요약 생성
```

**검색 소스별 세부 사항**

| 소스 | 텍스트 검색 방식 | 벡터 검색 | fileType |
|------|-----------------|----------|---------|
| 파일 (`file_chunks`) | `name.ilike` | `match_file_chunks` (0.3) | 확장자 기반 |
| 문서 (`documents`) | `title.ilike` only — content 제외 | `match_document_embeddings` (0.15) | 문서 유형 |
| 업무일지 (`work_logs`) | `done`, `plan`, `note`, `log_date` | — | `'업무일지'` |

- **title-only 텍스트 검색**: 이전 버전은 `content.ilike`도 포함하여 보고서 검색 시 회의록이 오탐되는 문제 발생 → v7.7.0에서 title만 검색하도록 수정
- **문서 벡터 threshold 0.15**: 문서는 파일 청크보다 내용이 압축적 — 광범위한 키워드의 유사도 상한이 ~0.29 수준이므로 0.3으로 설정하면 결과가 없음. 0.15 사용
- **work_log ID**: 검색 결과에서 `id = "wl-{id}"` 형태로 prefix 처리 (문서 ID와 충돌 방지)
- **admin 클라이언트**: `documents` RLS가 동일 부서만 SELECT 허용 → 검색은 전 부서 대상이므로 service_role 클라이언트로 bypass. work_logs도 동일
- AI Q&A 채팅 (`POST /api/chat`): fileIds 있으면 해당 파일 범위, 없으면 전체 파일 대상 검색 → GPT-4o-mini 컨텍스트 기반 답변

### DB 스키마 (`document_embeddings`, migration 022)

```sql
document_id UUID UNIQUE,   -- documents.id 참조
embedding   vector(1536)   -- text-embedding-3-small
```

RLS:
- SELECT: `authenticated` 역할 허용
- INSERT / UPDATE / DELETE: `service_role` 전용

ivfflat 인덱스: **의도적으로 주석 처리** — 행 수가 적을 때 인덱스 생성 시 오류 발생. 데이터가 충분히 쌓인 후 수동 생성 필요.

RPC `match_document_embeddings`: `document_id` + `similarity` (코사인) 반환.

### 백필 API (`POST /api/documents/embed-all`)

기존 문서에 임베딩이 없는 경우를 위한 일회성 백필 엔드포인트.

- 헤더 `x-internal-secret` 필수 (미포함 시 401)
- 임베딩 없는 문서 조회 → 200ms 딜레이를 두며 순차 임베딩
- 운영 안정성을 위해 병렬 처리 아닌 순차 처리 사용

---

## 메모 인사이트 (Memo Insight, v7.4.0+) [coverage: high -- 6 sources]

### 개요 (현재 아키텍처)

메모 저장 시 `text-embedding-3-small`으로 임베딩을 생성하고, 이를 활용해 (1) 그래프 시각화 + 멀티셀렉트, (2) 선택 메모 기반 AI 아이디어 생성(SSE), (3) 아이디어에서 할일 자동 추출, (4) 연관 메모 추천을 제공한다.

**v7.3.0 변경**: groups API 제거, 클러스터링 라이브러리 제거. 아이디어 생성은 memoIds[] 직접 전달 방식으로 단순화.

### 임베딩 파이프라인

```
POST /api/memos/[id]/embed
  1. 인증 + 메모 소유권 확인
  2. title + "\n" + content → text-embedding-3-small → vector(1536)
  3. memo_embeddings UPSERT (onConflict: memo_id)
```

- fire-and-forget. 임베딩 없는 메모는 semantic 링크 없음 (title/content 링크는 가능)

### 아이디어 생성 (POST /api/memos/idea)

```
요청: { memoIds: ["uuid1", "uuid2", ...] }   // 최소 2개
  → 소유자 일치 필터
  → 각 메모 title + content 수집
  → GPT-4o streaming (temperature=0.7, max_tokens=1000)
     출력: ## 💡 제목 / ## 핵심 개념 / ## 실행 방안 / ## 기대 효과
  → SSE: data: {"text":"..."} ... data: [DONE]
```

### 연관 메모 추천

```
GET /api/memos/[id]/related
  → match_memo_embeddings RPC (threshold=0.75, count=3)
  → 임베딩 없으면 [] 반환 (에러 없음)
```

### 메모 그래프 뷰

```
GET /api/memos/graph
  → 전체 메모 + 임베딩 조회
  → N×N 쌍 비교, 링크 생성 (우선순위 순):
      title:    제목 단어 일치율 ≥ 0.15  (실선)
      content:  제목 단어가 상대 내용에 포함 ≥ 0.20  (점선)
      semantic: 코사인 유사도 ≥ 0.78  (점선, 파란색)
  → { nodes, links } 반환
```

- react-force-graph-2d, Canvas 기반
- SSR 불가: `dynamic(() => import(...), { ssr: false })` 필수

### 모델 할당

| 기능 | 모델 | SDK |
|------|------|-----|
| 메모 임베딩 생성 | `text-embedding-3-small` | OpenAI SDK |
| 아이디어 생성 SSE | `gpt-4o` | OpenAI SDK (streaming) |
| 할일 추출 from idea | `gpt-4o` | OpenAI SDK (json_object) |

### API Surface (메모 AI — 현재)

| 메서드 | 경로 | 기능 | 모델 |
|--------|------|------|------|
| POST | `/api/memos/[id]/embed` | 임베딩 생성·갱신 | text-embedding-3-small |
| GET | `/api/memos/[id]/related` | 연관 메모 상위 3개 | — (RPC) |
| GET | `/api/memos/graph` | 그래프 노드+링크 (3종 타입) | — (서버 계산) |
| POST | `/api/memos/idea` | memoIds[] → 아이디어 SSE | gpt-4o |
| POST | `/api/todos/from-idea` | ideaText → 할일 3~7개 추출+등록 | gpt-4o |

**제거됨**: ~~GET /api/memos/groups~~, ~~POST /api/memos/groups/suggest~~ (v7.3.0)

---

## API Surface [coverage: high -- 9 sources]

전체 AI 관련 엔드포인트 요약.

| 메서드 | 경로 | 기능 | 모델 |
|--------|------|------|------|
| POST | `/api/transcribe` | STT + 요약 + 할일 추출 | Whisper-1 + GPT-4o-mini + GPT-4o |
| POST | `/api/contract-risk/analyze` | 계약서 25개 항목 리스크 분석 + Storage 업로드(v6.5.1) | GPT-4o |
| GET | `/api/contract-risk/history` | 분석 이력 조회 | — |
| GET | `/api/contract-risk/[id]` | 분석 결과 상세 | — |
| GET | `/api/contract-risk/[id]/download` | DOCX 리포트 다운로드 | — |
| POST | `/api/contract-risk/[id]/suggest` | RAG 법령 검색 + GPT-4o 수정 제안 생성 | GPT-4o + text-embedding-3-small |
| POST | `/api/contract-risk/[id]/apply` | 수정 적용 + DOCX/HWPX 다운로드 | — |
| POST | `/api/laws/seed` | 법령 시드 데이터 임베딩 INSERT | text-embedding-3-small |
| POST | `/api/legal-search` | 법령 키워드 유사도 검색 | text-embedding-3-small |
| POST | `/api/todos/extract` | 회의록 할일 재추출 + 등록 | GPT-4o |
| POST | `/api/files/[id]/extract-expiry` | 계약 만료일 추출 | GPT-4o |
| GET | `/api/dashboard/expiry-summary` | D-30 만료 문서 목록 | — |
| PATCH | `/api/files/[id]/expiry` | 만료일 수동 수정 | — |
| POST | `/api/quality-check` | 문서 품질 검수 | GPT-4o |
| GET | `/api/quality-check` | 검수 결과 캐시 조회 | — |
| POST | `/api/search` | 통합 시맨틱 검색 (파일+문서+업무일지, title-only 텍스트, 병렬 조회, admin client) | text-embedding-3-small + GPT-4o |
| POST | `/api/documents/embed-all` | 기존 문서 임베딩 일회성 백필 (x-internal-secret 필수) | text-embedding-3-small |
| POST | `/api/generate` | 문서 생성 | GPT-4o |
| POST | `/api/chat` | AI Q&A 채팅 | GPT-4o-mini |
| POST | `/api/documents/[id]/apply-comments` | 댓글 부분 반영 | GPT-4o |
| POST | `/api/autofill/analyze` | DOCX/HWPX 빈 필드 감지 + GPT-4o 추론 + 자동 매핑 | GPT-4o |
| POST | `/api/autofill/generate` | 채워진 파일 다운로드 | — |
| POST | `/api/memos/[id]/embed` | 메모 임베딩 생성·갱신 | text-embedding-3-small |
| GET | `/api/memos/[id]/related` | 연관 메모 상위 3개 | — (RPC) |
| GET | `/api/memos/graph` | 그래프 노드+링크 (3종 타입) | — (서버 계산) |
| POST | `/api/memos/idea` | memoIds[] → 아이디어 SSE | gpt-4o |
| POST | `/api/todos/from-idea` | 아이디어 텍스트 → 할일 추출+등록 | gpt-4o |

**환경 변수**: `OPENAI_API_KEY` (모든 AI 기능 필수)

---

## Key Decisions [coverage: medium -- 9 sources]

| 결정 | 이유 |
|------|------|
| 할일 추출 실패 시 예외 throw 금지 | STT 회의록 생성 자체가 중단되면 안 됨. `extractedTodos: []` fallback으로 graceful degradation |
| 만료일 추출 실패 시도 업로드 파이프라인 계속 | try/catch 격리. 업로드 성공이 우선 |
| 품질 검수 캐시 (`force=false`) | GPT-4o 호출 비용 절감. `document_quality_checks` 테이블에 최신 결과 보관 |
| 계약서 리스크 55초 타임아웃 | 25개 항목 분석은 처리 시간이 길 수 있음. Vercel 함수 타임아웃(60초) 이내로 설정 |
| 만료일 알림에 notifications 테이블 없음 | 외부 서비스 의존도 제로. 클라이언트가 앱 진입 시 API 직접 호출 + localStorage로 "오늘 다시 보지 않기" 관리 |
| 계약서 리스크 입력 60,000자 제한 | GPT-4o 안전 입력 한도(약 15K 토큰) 기준. 초과 시 truncate + "[이하 생략]" 표시 |
| 할일 추출 입력 15,000자 제한 | 회의록은 계약서보다 짧고 액션 아이템 추출에 앞부분이 중요. maxTokens=2000으로 충분 |
| 담당자 이름 users 매핑 실패 시 요청자 fallback | 이름 오표기·퇴직자 등 매핑 불가 케이스에서 할일 자체가 누락되지 않도록 |
| MediaRecorder + 서버 변경 없음 | 브라우저 직접 녹음 Blob과 파일 업로드 Blob을 FormData로 동일하게 처리 가능 |
| 메모 그래프 링크 3종 방식 | 임베딩 없는 메모도 title/content 링크로 포함. orphan 노드 최소화 |
| groups API 제거 → memoIds 직접 전달 | 서버 클러스터 캐시 없이 그래프에서 직접 선택. 단순성·유연성 향상 |
| 아이디어 제안 SSE 방식 | GPT-4o 응답 대기 시간이 길므로 스트리밍으로 UX 개선 |
| todos/from-idea 즉시 INSERT | 아이디어 텍스트에서 할일 추출 후 바로 DB 저장. UI에서 결과 표시 후 완료 안내 |
| 문서 벡터 threshold 0.15 | 문서 임베딩은 파일 청크보다 내용이 압축적 — 광범위한 키워드의 유사도 상한이 ~0.29. 0.3 사용 시 결과 없음 |
| title-only 텍스트 검색 | content.ilike 포함 시 보고서 검색에 회의록이 오탐됨. v7.7.0에서 title 필드만 검색으로 수정 |
| 검색에 admin 클라이언트 사용 | documents RLS가 동일 부서만 허용하나 검색은 전 부서 대상이어야 함 → service_role 클라이언트로 bypass |

---

## Gotchas [coverage: medium -- 9 sources]

- **Whisper 파일 크기 제한**: `/api/transcribe`는 25MB 제한 체크를 서버에서 수행. Vercel 요청 제한(4.5MB)과 별개 — 브라우저 직접 녹음 시 Blob 전송 전 클라이언트에서도 4MB 체크 필요
- **계약서 리스크 응답 구조 검증**: GPT-4o가 `items` 배열을 반환하지 않으면 `Error('GPT-4o 응답 구조 불일치')` throw — API에서 502 반환
- **만료일 날짜 형식 검증**: `YYYY-MM-DD` regex 불일치 시 `expiry_date = null`, `confidence = 'low'`로 강제 보정
- **품질 검수 15초 타임아웃**: AbortError 발생 시 408 반환. 긴 문서는 10,000자 truncate 후 전송
- **할일 extractedTodos는 UI 선택 후 등록**: `/api/transcribe` 응답에 포함된 extractedTodos는 아직 DB에 저장되지 않음 — TodoExtractModal에서 사용자가 선택 후 `/api/todos/extract` 호출 시 INSERT
- **계약서 리스크 분석 `found=false` 항목도 포함**: 25개 전체가 응답에 있어야 함. `found=false` 항목은 risk_count에 집계되지 않음
- **admin 클라이언트 사용 위치**: 할일 INSERT(담당자 user_id 직접 지정), 품질 검수 문서 조회(RLS bypass) — 의도적 패턴
- **만료일 D-30 기준은 `schedules.end_date`**: `source_type = 'document_expiry'` 필터링 필수. 수동 일정과 혼용 방지
- **Safari 녹음 포맷**: `MediaRecorder.isTypeSupported('audio/webm;codecs=opus')` 런타임 감지로 webm/mp4 분기. 파일명 확장자 명시 필수(Whisper MIME 감지용)
- **ivfflat 인덱스 주석 처리**: `document_embeddings` 테이블의 ivfflat 인덱스는 의도적으로 주석 처리되어 있음 — 행 수가 적을 때 `CREATE INDEX ... USING ivfflat` 실행 시 오류 발생. 프로덕션에서 데이터가 충분히 쌓인 후 수동으로 인덱스 생성 필요
- **embed-all 백필 API 인증**: `POST /api/documents/embed-all`는 `x-internal-secret` 헤더가 없으면 401 반환. 일회성 백필 목적이므로 일반 auth 미사용
- **문서 재임베딩 조건**: `PATCH /api/documents/[id]`에서 content가 변경된 경우에만 재임베딩 호출 — title만 바뀌면 임베딩 갱신 없음

---

## Sources [coverage: high -- 9 sources]

- `/Users/watchers/Desktop/clio-project/docs/02-design/features/clio-contract-risk.design.md`
- `/Users/watchers/Desktop/clio-project/docs/02-design/features/clio-recording-stt.design.md`
- `/Users/watchers/Desktop/clio-project/docs/02-design/features/clio-meeting-todo.design.md`
- `/Users/watchers/Desktop/clio-project/docs/02-design/features/clio-expiry-alert.design.md`
- `/Users/watchers/Desktop/clio-project/src/lib/ai/contract-risk-analyzer.ts`
- `/Users/watchers/Desktop/clio-project/src/lib/ai/extract-todos.ts`
- `/Users/watchers/Desktop/clio-project/src/lib/ai/extract-expiry.ts`
- `/Users/watchers/Desktop/clio-project/src/app/api/transcribe/route.ts`
- `/Users/watchers/Desktop/clio-project/src/app/api/quality-check/route.ts`
- `/Users/watchers/Desktop/clio-project/src/lib/contract-risk-items.ts`
- `/Users/watchers/Desktop/clio-project/docs/01-plan/features/clio.plan.md`
- `/Users/watchers/Desktop/clio-project/docs/01-plan/features/memo-insight.plan.md`
- `/Users/watchers/Desktop/clio-project/docs/01-plan/features/memo-graph.plan.md`
- `/Users/watchers/Desktop/clio-project/src/app/api/memos/graph/route.ts`
- `/Users/watchers/Desktop/clio-project/src/app/api/memos/idea/route.ts`
- `/Users/watchers/Desktop/clio-project/src/app/api/memos/[id]/embed/route.ts`
- `/Users/watchers/Desktop/clio-project/src/app/api/memos/[id]/related/route.ts`
- `/Users/watchers/Desktop/clio-project/src/app/api/todos/from-idea/route.ts`
