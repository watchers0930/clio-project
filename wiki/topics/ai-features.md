# AI 기능

[coverage: high -- sources: clio-contract-risk.design.md, clio-recording-stt.design.md, clio-meeting-todo.design.md, clio-expiry-alert.design.md, contract-risk-analyzer.ts, extract-todos.ts, extract-expiry.ts, transcribe/route.ts, quality-check/route.ts]

---

## Purpose [coverage: high -- 9 sources]

CLIO의 AI 기능은 OpenAI GPT-4o / Whisper를 기반으로, 문서 관련 반복 수작업을 자동화한다. 주요 역할은 다음 다섯 가지다.

1. **STT 회의록**: 오디오 파일 또는 브라우저 직접 녹음 → Whisper-1 변환 → GPT-4o 요약 → 회의록 자동 생성
2. **할일 추출**: 회의록 텍스트에서 액션 아이템·담당자·기한을 GPT-4o로 구조화하여 `todos` 테이블에 등록
3. **계약서 리스크 분석**: DOCX/HWPX/PDF 계약서를 25개 항목으로 분류 분석, 리포트 생성 + DOCX 다운로드
4. **만료일 추출**: 파일 업로드 시 GPT-4o가 계약 만료일을 자동 추출 → `schedules` 테이블 등록 + 앱 진입 시 D-30 알림
5. **문서 품질 검수**: 공문서 맞춤법·규격·논리·누락 항목을 GPT-4o가 검수하여 점수 및 수정 제안 반환

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

## 벡터 검색 [coverage: medium -- 2 sources]

```
파일 업로드 파이프라인:
  extract-text.ts → chunk-text.ts → embeddings.ts
    → OpenAI text-embedding-3-small
    → file_chunks 테이블 (pgvector) 저장

검색:
  POST /api/search
    → 검색어 embedding 변환
    → match_file_chunks(query_embedding, match_count, match_threshold) DB 함수
    → 코사인 유사도 검색
    → 폴백: 텍스트 LIKE 검색
    → GPT-4o로 결과 요약 생성
```

- `match_threshold`: 유사도 임계값 (0~1)
- AI Q&A 채팅 (`POST /api/chat`): fileIds 있으면 해당 파일 범위, 없으면 전체 파일 대상 검색 → GPT-4o-mini 컨텍스트 기반 답변

---

## API Surface [coverage: high -- 9 sources]

전체 AI 관련 엔드포인트 요약.

| 메서드 | 경로 | 기능 | 모델 |
|--------|------|------|------|
| POST | `/api/transcribe` | STT + 요약 + 할일 추출 | Whisper-1 + GPT-4o-mini + GPT-4o |
| POST | `/api/contract-risk/analyze` | 계약서 25개 항목 리스크 분석 | GPT-4o |
| GET | `/api/contract-risk/history` | 분석 이력 조회 | — |
| GET | `/api/contract-risk/[id]` | 분석 결과 상세 | — |
| GET | `/api/contract-risk/[id]/download` | DOCX 리포트 다운로드 | — |
| POST | `/api/todos/extract` | 회의록 할일 재추출 + 등록 | GPT-4o |
| POST | `/api/files/[id]/extract-expiry` | 계약 만료일 추출 | GPT-4o |
| GET | `/api/dashboard/expiry-summary` | D-30 만료 문서 목록 | — |
| PATCH | `/api/files/[id]/expiry` | 만료일 수동 수정 | — |
| POST | `/api/quality-check` | 문서 품질 검수 | GPT-4o |
| GET | `/api/quality-check` | 검수 결과 캐시 조회 | — |
| POST | `/api/search` | 시맨틱 검색 | text-embedding-3-small + GPT-4o |
| POST | `/api/generate` | 문서 생성 | GPT-4o |
| POST | `/api/chat` | AI Q&A 채팅 | GPT-4o-mini |
| POST | `/api/documents/[id]/apply-comments` | 댓글 부분 반영 | GPT-4o |

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
