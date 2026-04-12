# AI 문서 품질 검수 설계서

> **요약**: GPT-4o를 활용하여 공문서를 맞춤법·규격·논리·누락 4개 항목으로 자동 검수하고, 결과를 패널 UI에 표시하며 DB에 저장하는 기능의 구현 명세
>
> **프로젝트**: CLIO
> **버전**: v5.6.0 → v5.1.0 목표 (이 기능)
> **작성자**: 크로미 (설계)
> **작성일**: 2026-04-12
> **상태**: Draft
> **계획서**: [clio-doc-quality.plan.md](../../01-plan/features/clio-doc-quality.plan.md)

---

## 관련 문서

| 구분 | 문서 | 상태 |
|------|------|------|
| 계획서 | `docs/01-plan/features/clio-doc-quality.plan.md` | Draft |
| 기존 문서 생성 API | `src/app/api/generate/route.ts` | 구현 완료 |
| 타입 정의 | `src/lib/supabase/types.ts` | 확장 필요 |

---

## 1. 개요

### 1-1. 기능 요약

CLIO가 생성한 공문서를 사용자 요청 시 GPT-4o에게 자동 검수 의뢰한다. GPT-4o는 "한국 공문서 전문 교정자" 역할로 맞춤법, 공문서 규격, 논리 흐름, 누락 항목 4개 카테고리에 걸쳐 구조화된 JSON을 반환한다. 결과는 문서 상세 화면 우측 패널에 표시되고, `document_quality_checks` 테이블에 저장되어 재열람 시 추가 API 호출 없이 즉시 표시된다.

### 1-2. 기술 스택

| 레이어 | 기술 |
|--------|------|
| 프론트엔드 | Next.js (App Router), TypeScript, Tailwind CSS |
| 백엔드 API | Next.js Route Handler (`src/app/api/`) |
| 데이터베이스 | Supabase (PostgreSQL), RLS |
| AI | OpenAI GPT-4o (`response_format: json_object`) |
| 인증 | Supabase 세션 쿠키 (서버 컴포넌트 패턴) |

---

## 2. 데이터베이스 설계

### 2-1. 신규 테이블: `document_quality_checks`

```sql
-- 마이그레이션 파일: supabase/migrations/010_document_quality_checks.sql

CREATE TABLE document_quality_checks (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id   UUID        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  checked_by    UUID        NOT NULL REFERENCES users(id),
  overall_score INTEGER     CHECK (overall_score BETWEEN 0 AND 100),
  result_json   JSONB       NOT NULL,   -- GPT-4o 응답 전체 (items 배열 + summary)
  created_at    TIMESTAMPTZ DEFAULT now() NOT NULL
);

COMMENT ON TABLE  document_quality_checks                IS 'AI 문서 품질 검수 결과 저장';
COMMENT ON COLUMN document_quality_checks.result_json    IS 'GPT-4o 응답 전체 구조 (QualityCheckResult 타입)';
COMMENT ON COLUMN document_quality_checks.overall_score  IS '종합 품질 점수 (0~100), GPT-4o 자체 평가';
```

### 2-2. RLS 정책

```sql
-- 검수 결과는 본인(checked_by) 또는 해당 문서 작성자만 조회 가능

ALTER TABLE document_quality_checks ENABLE ROW LEVEL SECURITY;

-- 조회: 검수 요청자 본인 또는 문서 작성자
CREATE POLICY "quality_checks_select"
  ON document_quality_checks FOR SELECT
  USING (
    checked_by = auth.uid()
    OR document_id IN (
      SELECT id FROM documents WHERE created_by = auth.uid()
    )
  );

-- 삽입: 인증된 사용자 (서버 사이드에서 checked_by = auth.uid() 강제)
CREATE POLICY "quality_checks_insert"
  ON document_quality_checks FOR INSERT
  WITH CHECK (checked_by = auth.uid());

-- 수정: 불허 (재검수는 새 행 삽입 방식)
-- 삭제: 불허 (이력 보존)
```

### 2-3. 인덱스

```sql
-- 문서별 최신 검수 결과 빠른 조회용
CREATE INDEX idx_quality_checks_document_created
  ON document_quality_checks (document_id, created_at DESC);

-- 사용자별 검수 이력 조회용
CREATE INDEX idx_quality_checks_checked_by
  ON document_quality_checks (checked_by, created_at DESC);
```

### 2-4. 마이그레이션 파일명

```
supabase/migrations/010_document_quality_checks.sql
```

> 기존 마이그레이션: 007(audit_logs), 008(approvals), 009(versions) — 010번 사용

---

## 3. API 설계

### 3-1. 엔드포인트 목록

| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|------|
| `POST` | `/api/quality-check` | 검수 요청 (GPT-4o 호출 + DB 저장) | Supabase 세션 필수 |
| `GET`  | `/api/quality-check?document_id={id}` | 최신 저장 결과 조회 | Supabase 세션 필수 |

### 3-2. POST /api/quality-check

**파일 경로**: `src/app/api/quality-check/route.ts`

#### Request Body

```typescript
interface QualityCheckRequest {
  document_id: string;   // documents 테이블 PK (UUID)
  force?: boolean;       // true = 기존 결과 무시하고 재검수 (기본값: false)
}
```

#### Response Body (성공)

```typescript
interface QualityCheckResponse {
  check_id: string;            // 저장된 document_quality_checks.id
  document_id: string;
  overall_score: number;       // 0~100
  items: QualityCheckItem[];   // 상세 검수 항목
  summary: string;             // GPT-4o 요약 문장
  checked_at: string;          // ISO 8601
  from_cache: boolean;         // true = DB 캐시에서 반환 (GPT-4o 미호출)
}

interface QualityCheckItem {
  category: 'spelling' | 'format' | 'logic' | 'missing';
  severity: 'error' | 'warning' | 'suggestion';
  original: string;       // 원문 인용 (최대 100자)
  suggestion: string;     // 수정 제안 텍스트
  description: string;    // 상세 설명
}
```

#### 에러 응답

```typescript
// 공통 에러 형식
interface ApiErrorResponse {
  error: string;          // 사람이 읽을 수 있는 메시지
  code?: string;          // 내부 에러 코드 (선택)
}

// HTTP 상태 코드
// 400 Bad Request  — document_id 미전달 또는 유효하지 않은 UUID
// 401 Unauthorized — 세션 없음
// 403 Forbidden    — 본인 문서가 아닌 경우
// 404 Not Found    — documents 테이블에 해당 ID 없음
// 408 Request Timeout — GPT-4o 15초 초과
// 422 Unprocessable — content 필드 비어있음
// 500 Internal Server Error — GPT-4o JSON 파싱 실패 등
```

#### 주요 처리 흐름

```
[POST /api/quality-check]

1. 세션 인증 확인 (getAuthUserId)
   └─ 실패 → 401

2. document_id 파라미터 검증 (UUID 형식)
   └─ 실패 → 400

3. documents 테이블에서 content 조회
   ├─ 없음 → 404
   ├─ created_by !== authUserId → 403
   └─ content가 비어있음 → 422

4. force=false 일 때: document_quality_checks에서 최신 결과 조회
   └─ 존재하면 from_cache=true 로 즉시 반환

5. GPT-4o 호출 (maxDuration: 60초, timeout: 15초)
   └─ 실패 → 에러 처리 (섹션 6 참조)

6. 응답 JSON 파싱 → QualityCheckResult 타입 검증
   └─ 파싱 실패 → 500

7. document_quality_checks 테이블 INSERT
   (document_id, checked_by=authUserId, overall_score, result_json)

8. 저장된 결과 → 클라이언트 반환 (from_cache=false)
```

### 3-3. GET /api/quality-check

**파일 경로**: `src/app/api/quality-check/route.ts` (같은 파일, `export async function GET`)

#### Query Parameters

```typescript
interface QualityCheckGetParams {
  document_id: string;   // required
}
```

#### Response Body (성공)

```typescript
// 결과 있음: QualityCheckResponse (from_cache: true 고정)
// 결과 없음: { check_id: null, document_id, from_cache: false }
```

#### 주요 처리 흐름

```
[GET /api/quality-check?document_id=xxx]

1. 세션 인증 확인
2. document_quality_checks에서 최신 1건 조회
   (ORDER BY created_at DESC LIMIT 1)
3. 결과 반환 (없으면 check_id: null)
```

---

## 4. 컴포넌트 설계

### 4-1. 신규 파일 목록

| 파일 경로 | 역할 |
|-----------|------|
| `src/components/documents/QualityCheckPanel.tsx` | 검수 결과 패널 (메인 UI) |
| `src/components/documents/QualityCheckBadge.tsx` | 심각도 배지 컴포넌트 |
| `src/components/documents/QualityCheckItem.tsx` | 개별 검수 항목 카드 |
| `src/hooks/useQualityCheck.ts` | 검수 API 호출 + 상태 관리 훅 |
| `src/lib/api/qualityCheck.ts` | API 클라이언트 함수 |

### 4-2. QualityCheckPanel.tsx

```typescript
// src/components/documents/QualityCheckPanel.tsx

interface QualityCheckPanelProps {
  documentId: string;
  documentContent: string;    // 검수 대상 문서 content (미리보기용)
  onClose?: () => void;       // 패널 닫기 콜백 (선택)
}
```

**주요 useState 목록**

```typescript
const [status, setStatus]
  = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

const [result, setResult]
  = useState<QualityCheckResponse | null>(null);

const [activeCategory, setActiveCategory]
  = useState<'all' | 'spelling' | 'format' | 'logic' | 'missing'>('all');

const [isRequesting, setIsRequesting]
  = useState<boolean>(false);   // 중복 클릭 방지
```

**핵심 UI 구조 (ASCII 와이어프레임)**

```
┌────────────────────────────────────────────────────┐
│  AI 품질 검수                         점수: [82]  X│
├────────────────────────────────────────────────────┤
│  [전체] [맞춤법] [공문서 규격] [논리] [누락]       │
├────────────────────────────────────────────────────┤
│                                                    │
│  ┌── 맞춤법 2건 ──────────────────── [error]───┐  │
│  │  "되었으므로써"                              │  │
│  │  → 되었으므로                               │  │
│  │  조사 '써'는 '으로써'(수단)에만 사용합니다. │  │
│  └──────────────────────────────────────────── ┘  │
│                                                    │
│  ┌── 공문서 규격 1건 ─────────────── [warning]─┐  │
│  │  "2026년 4월 12일"                           │  │
│  │  → 2026. 4. 12.                             │  │
│  │  공문서 날짜는 마침표(.) 구분 방식 사용.    │  │
│  └──────────────────────────────────────────── ┘  │
│                                                    │
│  ┌── 논리 흐름 ───────────────────── 문제없음 ─┐  │
│  └──────────────────────────────────────────── ┘  │
│                                                    │
│  ┌── 누락 항목 1건 ───────────────── [warning]─┐  │
│  │  첨부파일 목록 언급 없음                     │  │
│  └──────────────────────────────────────────── ┘  │
│                                                    │
│  ※ AI 검수는 참고용입니다. 최종 확인은 담당자가   │
│    직접 수행하세요.                                │
│                                                    │
│                          [재검수]  [AI 검수 요청]  │
└────────────────────────────────────────────────────┘
```

### 4-3. QualityCheckBadge.tsx

```typescript
// src/components/documents/QualityCheckBadge.tsx

type Severity = 'error' | 'warning' | 'suggestion';

interface QualityCheckBadgeProps {
  severity: Severity;
  label?: string;    // 기본값: severity 한글 매핑
}
```

**심각도별 색상 코드**

| 심각도 | 한글 표시 | Tailwind 클래스 | 배경 |
|--------|-----------|-----------------|------|
| `error` | 오류 | `text-red-600` | `bg-red-50` |
| `warning` | 경고 | `text-yellow-600` | `bg-yellow-50` |
| `suggestion` | 제안 | `text-blue-600` | `bg-blue-50` |

### 4-4. QualityCheckItem.tsx

```typescript
// src/components/documents/QualityCheckItem.tsx

interface QualityCheckItemProps {
  item: QualityCheckItem;    // API 응답 타입 (섹션 3-2 정의)
}
```

### 4-5. useQualityCheck.ts

```typescript
// src/hooks/useQualityCheck.ts

interface UseQualityCheckReturn {
  result: QualityCheckResponse | null;
  status: 'idle' | 'loading' | 'success' | 'error';
  errorMessage: string | null;
  requestCheck: (force?: boolean) => Promise<void>;
  loadCached: () => Promise<void>;
}

function useQualityCheck(documentId: string): UseQualityCheckReturn
```

**동작 규칙**:
- 컴포넌트 마운트 시 `loadCached()` 자동 호출 → 저장 결과 있으면 즉시 표시
- `requestCheck(force=false)` 호출 시 `isRequesting=true` 로 버튼 비활성화
- `requestCheck(force=true)` = 재검수 (이전 결과 무시)

---

## 5. AI 프롬프트 설계

### 5-1. System Prompt (전체)

```
당신은 대한민국 행정기관 공문서 전문 교정자입니다.
아래 기준에 따라 제출된 문서를 엄격하게 검토하고,
반드시 지정된 JSON 형식으로만 응답하십시오.

## 검토 기준

### 1. 맞춤법 및 어문 규범 (category: "spelling")
- 한글 맞춤법 위반: 띄어쓰기, 된소리, 사이시옷, 어미 오용
- 외래어 표기법 오류 (국립국어원 기준)
- 문장 부호 오용: 쌍점·마침표 위치, 따옴표 종류
- 높임말·평어 혼용 (공문서 내 경어 일관성)

### 2. 공문서 규격 준수 (category: "format")
- 행정업무운영규정 기반 공문서 양식 기준 적용
- 수신·경유·발신 기재 형식
- 제목 표기: 마침표 없이 끝내기
- 날짜 표기: "2026. 4. 12." 형식 (한글 날짜 표기 금지)
- 금액 표기: "금 1,000,000원정" 형식
- 문단 번호 체계: 1. → 가. → 1) → 가) 순서

### 3. 논리 흐름 및 문장 품질 (category: "logic")
- 문단 간 논리 연결 자연스러움
- 중복 표현 및 불필요한 수식어
- 능동·수동 표현 일관성
- 단일 문장 3줄 초과 여부
- 결론 없는 열거 구조

### 4. 누락 항목 검사 (category: "missing")
- 필수 필드 미기재: 수신기관, 발신일, 문서번호
- 서명·날인 안내 누락
- 첨부파일 언급 후 목록 없음
- 금액 기재 후 산출근거 누락
- 참조 조항 인용 후 조항 내용 미첨부

## 응답 규칙
- 문제가 없는 카테고리는 items 배열에서 제외하지 말고,
  해당 카테고리의 항목이 없음을 summary에 명시하십시오.
- overall_score: 100점 기준. 각 카테고리 미준수 시 가중치 차감.
  spelling(-5/건), format(-5/건), logic(-3/건), missing(-8/건)
- 문서가 매우 짧거나 내용이 없는 경우 overall_score: 0, items: []
```

### 5-2. User Prompt 구조

```
다음 공문서를 검토하십시오.

--- 문서 시작 ---
{document_content}
--- 문서 끝 ---

위 문서를 4개 카테고리(spelling, format, logic, missing)로 검토하고
JSON 형식으로 결과를 반환하십시오.
```

> `document_content`는 `documents.content` 컬럼에서 가져온 마크다운 문자열이며, 최대 10,000자로 잘라 전달한다.

### 5-3. 응답 JSON 스키마

```typescript
// GPT-4o가 반환해야 하는 전체 구조

interface QualityCheckResult {
  overall_score: number;           // 0~100 정수
  items: QualityCheckItem[];       // 문제 항목 배열 (문제 없으면 빈 배열)
  summary: string;                 // 전체 요약 1~2문장
}

interface QualityCheckItem {
  category: 'spelling' | 'format' | 'logic' | 'missing';
  severity: 'error' | 'warning' | 'suggestion';
  original: string;     // 원문에서 문제가 된 구절 인용 (없으면 빈 문자열)
  suggestion: string;   // 수정 제안 (없으면 빈 문자열)
  description: string;  // 위반 이유 설명 (1~2문장)
}
```

**GPT-4o 응답 예시**

```json
{
  "overall_score": 78,
  "items": [
    {
      "category": "spelling",
      "severity": "error",
      "original": "되었으므로써",
      "suggestion": "되었으므로",
      "description": "조사 '써'는 수단을 나타내는 '으로써'에만 사용합니다. 원인·이유를 나타낼 때는 '으로'를 씁니다."
    },
    {
      "category": "format",
      "severity": "warning",
      "original": "2026년 4월 12일",
      "suggestion": "2026. 4. 12.",
      "description": "공문서 날짜는 행정업무운영규정에 따라 마침표(.) 구분 방식을 사용합니다."
    },
    {
      "category": "missing",
      "severity": "warning",
      "original": "",
      "suggestion": "첨부: 1. 관련 서류 일체",
      "description": "본문에서 첨부파일을 언급했으나 '붙임' 항목에 첨부파일 목록이 없습니다."
    }
  ],
  "summary": "맞춤법 1건 오류, 날짜 표기 1건 경고, 첨부파일 목록 누락 1건이 발견되었습니다."
}
```

### 5-4. GPT-4o 호출 파라미터

```typescript
// src/app/api/quality-check/route.ts 내 OpenAI 호출부

const completion = await openai.chat.completions.create({
  model: 'gpt-4o',
  temperature: 0.1,          // 일관된 검수 결과를 위해 낮게 설정
  max_tokens: 2048,          // 검수 결과 출력 한도
  response_format: {
    type: 'json_object',     // JSON mode 강제 (파싱 실패 방지)
  },
  messages: [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ],
  timeout: 15000,            // 15초 타임아웃
});
```

### 5-5. 4종 항목별 프롬프트 지시 보완

System Prompt의 각 카테고리에 아래 세부 지시를 추가로 적용한다.

**spelling** (맞춤법)
```
- 맞춤법 오류가 없으면 items에 spelling 항목을 포함하지 마라.
- 오타(typo)와 어문 규범 위반을 모두 포함한다.
- severity 기준: 명백한 오탈자=error, 표기 관습 차이=warning, 더 나은 표현=suggestion
```

**format** (공문서 규격)
```
- 날짜: "YYYY년 MM월 DD일" 형식은 반드시 error로 분류한다.
- 제목에 마침표가 있으면 warning으로 분류한다.
- 문단 번호 순서 역전은 error로 분류한다.
```

**logic** (논리 흐름)
```
- 문단 수가 2개 미만이면 logic 항목은 생략 가능하다.
- 문장 길이(3줄 초과)는 suggestion으로 분류한다.
- 논리 단절·결론 부재는 warning으로 분류한다.
```

**missing** (누락 항목)
```
- 필수 필드(수신기관, 문서번호, 발신일) 누락은 error로 분류한다.
- 첨부파일 목록, 산출근거 누락은 warning으로 분류한다.
- 서명 안내 누락은 suggestion으로 분류한다.
```

---

## 6. 에러 처리 설계

### 6-1. 주요 에러 케이스

| 에러 상황 | HTTP 코드 | 처리 방식 | 사용자 표시 메시지 |
|-----------|-----------|-----------|-------------------|
| 세션 없음 / 만료 | 401 | 클라이언트 → 로그인 페이지 리다이렉트 | "로그인이 필요합니다." |
| document_id 미전달 | 400 | 에러 응답 반환 | "문서 ID가 필요합니다." |
| 문서 존재하지 않음 | 404 | 에러 응답 반환 | "문서를 찾을 수 없습니다." |
| 타인 문서 접근 | 403 | 에러 응답 반환 | "접근 권한이 없습니다." |
| content 비어있음 | 422 | 에러 응답 반환 | "문서 내용이 없어 검수할 수 없습니다." |
| GPT-4o 15초 초과 | 408 | AbortController로 중단, 에러 반환 | "검수 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요." |
| GPT-4o JSON 파싱 실패 | 500 | console.error + 에러 반환 | "AI 응답 처리 중 오류가 발생했습니다." |
| Supabase INSERT 실패 | 500 | console.error + 에러 반환 | "검수 결과 저장 중 오류가 발생했습니다." |
| OpenAI API 키 미설정 | 503 | 조기 반환 | "AI 검수 서비스가 설정되지 않았습니다." |

### 6-2. GPT-4o 타임아웃 처리 코드 패턴

```typescript
// AbortController를 이용한 15초 타임아웃 구현
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 15_000);

try {
  const completion = await openai.chat.completions.create(
    { ...params },
    { signal: controller.signal }
  );
  clearTimeout(timeoutId);
  // 정상 처리 계속
} catch (err) {
  clearTimeout(timeoutId);
  if (err instanceof Error && err.name === 'AbortError') {
    return NextResponse.json({ error: '검수 시간이 초과되었습니다.' }, { status: 408 });
  }
  throw err;  // 다른 에러는 상위 catch로 전파
}
```

### 6-3. JSON 파싱 실패 방어 코드 패턴

```typescript
let parsed: QualityCheckResult;
try {
  const raw = completion.choices[0].message.content ?? '{}';
  parsed = JSON.parse(raw) as QualityCheckResult;

  // 필수 필드 검증
  if (typeof parsed.overall_score !== 'number' || !Array.isArray(parsed.items)) {
    throw new Error('GPT-4o 응답 구조 불일치');
  }
} catch (parseErr) {
  console.error('[quality-check] JSON parse error:', parseErr);
  return NextResponse.json(
    { error: 'AI 응답 처리 중 오류가 발생했습니다.' },
    { status: 500 }
  );
}
```

### 6-4. 클라이언트 중복 요청 방지

```typescript
// useQualityCheck.ts 내부
const [isRequesting, setIsRequesting] = useState(false);

const requestCheck = async (force = false) => {
  if (isRequesting) return;           // 중복 호출 차단
  setIsRequesting(true);
  try {
    // API 호출 ...
  } finally {
    setIsRequesting(false);
  }
};
```

버튼 UI에서 `disabled={isRequesting}` 적용하여 버튼도 비활성화.

---

## 7. 구현 순서 (Phase별 체크리스트)

### Phase 1 — API 및 AI 연동 (P0 / 예상 3~4시간)

목표: GPT-4o 호출 → JSON 파싱 → 클라이언트 반환까지의 흐름 완성

- [ ] `src/app/api/quality-check/route.ts` 파일 생성
  - `export async function POST(request: NextRequest)` 구현
  - `export async function GET(request: NextRequest)` 구현
- [ ] `src/lib/supabase/types.ts`에 `QualityCheckResult`, `QualityCheckItem`, `DbDocumentQualityCheck` 타입 추가
- [ ] `getAuthUserId` 적용 (기존 `src/lib/auth-helper.ts` 재사용)
- [ ] `documents` 테이블 content 조회 로직 (소유권 확인 포함)
- [ ] GPT-4o System Prompt 상수 정의 (`QUALITY_CHECK_SYSTEM_PROMPT`)
- [ ] OpenAI client 초기화 (`openai` 인스턴스, `process.env.OPENAI_API_KEY` 확인)
- [ ] GPT-4o 호출 + `response_format: json_object` + 15초 타임아웃
- [ ] JSON 파싱 + 구조 검증 로직
- [ ] 에러 케이스 전체 처리 (섹션 6 참조)
- [ ] `export const maxDuration = 60;` 설정 (Vercel timeout 대응)

### Phase 2 — DB 및 저장 (P1 / 예상 1~2시간)

목표: 검수 결과 DB 저장 + 캐시 조회 로직 완성

- [ ] `supabase/migrations/010_document_quality_checks.sql` 작성
  - CREATE TABLE, COMMENT
  - RLS 정책 (SELECT, INSERT)
  - 인덱스 2개
- [ ] Supabase 대시보드에서 마이그레이션 실행 및 검증
- [ ] `route.ts` POST 핸들러에 `document_quality_checks` INSERT 로직 추가
- [ ] `force=false` 일 때 기존 결과 조회 후 `from_cache: true` 반환 로직
- [ ] GET 핸들러에 최신 결과 조회 로직 추가

### Phase 3 — UI 구현 (P0~P1 / 예상 2~3시간)

목표: 검수 패널 UI 완성 + 문서 상세 화면 연결

- [ ] `src/lib/api/qualityCheck.ts` API 클라이언트 함수 작성
  - `requestQualityCheck(documentId, force?)` → POST 호출
  - `fetchQualityCheck(documentId)` → GET 호출
- [ ] `src/hooks/useQualityCheck.ts` 커스텀 훅 작성
  - `loadCached()`, `requestCheck(force?)` 구현
  - 마운트 시 `loadCached()` 자동 호출
- [ ] `src/components/documents/QualityCheckBadge.tsx` 작성
  - severity → 색상 매핑 (섹션 4-3 참조)
- [ ] `src/components/documents/QualityCheckItem.tsx` 작성
  - 항목 카드: original → suggestion → description 구조
- [ ] `src/components/documents/QualityCheckPanel.tsx` 작성
  - 카테고리 탭 필터 (전체/맞춤법/공문서 규격/논리/누락)
  - 로딩 스피너 (`src/components/ui/spinner.tsx` 재사용)
  - "AI 검수는 참고용입니다." 안내 문구 필수 표시
  - "재검수" 버튼 (`force=true` 호출)
- [ ] `src/app/(app)/documents/[id]/page.tsx`에 QualityCheckPanel 통합
  - "AI 검수" 버튼 추가 (다운로드 버튼 옆 위치)
  - 패널 표시/숨김 토글 상태 (`showQualityPanel`)
  - 버튼 클릭 → `requestCheck()` 호출 + 패널 열기

### Phase 4 — 종합 점수 및 심각도 색상 (P2 / 예상 1시간)

목표: 시각적 완성도 향상

- [ ] QualityCheckPanel 상단 종합 점수 표시
  - 90점 이상: 초록색 (`text-green-600`)
  - 70~89점: 노랑색 (`text-yellow-600`)
  - 69점 이하: 빨강색 (`text-red-600`)
- [ ] 카테고리 탭에 건수 배지 표시 (예: "맞춤법 [2]")
- [ ] overall_score 기반 종합 의견 한 줄 표시
  - 90점 이상: "품질 기준을 충족합니다."
  - 70~89점: "일부 개선이 필요합니다."
  - 69점 이하: "전반적인 검토가 필요합니다."

---

## 8. 타입 정의 확장 (types.ts)

```typescript
// src/lib/supabase/types.ts 에 추가

/** 검수 항목 카테고리 */
export type QualityCategory = 'spelling' | 'format' | 'logic' | 'missing';

/** 검수 항목 심각도 */
export type QualitySeverity = 'error' | 'warning' | 'suggestion';

/** 검수 항목 단건 */
export interface QualityCheckItem {
  category: QualityCategory;
  severity: QualitySeverity;
  original: string;
  suggestion: string;
  description: string;
}

/** GPT-4o 전체 응답 구조 */
export interface QualityCheckResult {
  overall_score: number;
  items: QualityCheckItem[];
  summary: string;
}

/** document_quality_checks DB Row */
export interface DbDocumentQualityCheck {
  id: string;
  document_id: string;
  checked_by: string;
  overall_score: number;
  result_json: QualityCheckResult;
  created_at: string;
}
```

---

## 9. 레이어 구조 (Clean Architecture 적용)

| 컴포넌트/파일 | 레이어 | 역할 |
|--------------|--------|------|
| `QualityCheckPanel.tsx` | Presentation | UI 렌더링, 사용자 인터랙션 |
| `QualityCheckItem.tsx` | Presentation | 개별 항목 카드 렌더링 |
| `QualityCheckBadge.tsx` | Presentation | 심각도 배지 렌더링 |
| `useQualityCheck.ts` | Application | API 호출 조율, 상태 관리 |
| `src/lib/api/qualityCheck.ts` | Infrastructure | fetch 호출, API 응답 정규화 |
| `src/app/api/quality-check/route.ts` | Infrastructure | GPT-4o 호출, DB 저장 |
| `QualityCheckResult`, `QualityCheckItem` 타입 | Domain | 순수 타입 정의 |

---

## 10. 버전 이력

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 0.1 | 2026-04-12 | 최초 작성 | 크로미 (설계) |
