# HWP/Word 자동채우기 (Autofill) 계획서

> **Summary**: DOCX/HWPX/HWP 양식 문서를 업로드하면 AI가 빈 필드를 분석·자동 매핑하고 사용자 입력을 보조하여 완성 문서를 생성하는 기능
>
> **Project**: CLIO
> **Version**: v6.4.0 → v6.6.0 (타겟)
> **Author**: Product Manager
> **Date**: 2026-04-15
> **Status**: Draft

---

## 1. Overview

### 1.1 Purpose

기존 CLIO의 "문서 생성" 기능은 빈 템플릿에 AI가 전체 내용을 작성하는 방식이다.
그러나 실무에서는 이미 절반 이상 작성된 양식 문서(결재서류, 계약서, 보고서 등)에서
비어 있는 특정 필드만 채워야 하는 상황이 훨씬 많다.

본 기능은 **이미 내용이 반쯤 채워진 양식 문서의 나머지 빈 필드를 AI가 식별하고 자동 채움**으로써,
반복적인 수동 입력 작업을 제거하고 문서 완성 속도를 높이는 것을 목표로 한다.

### 1.2 Background

- CLIO v5.0.0에서 "템플릿 자가등록" 기능이 도입되어 DOCX/HWPX 파일의 빈칸 감지 로직(`analyze-template.ts`)이 이미 존재한다.
- 기존 렌더러(`lib/renderers/docx.ts`, HWPX ZIP+XML 파싱)와 치환 엔진(`contract-renderer.ts`)을 재활용할 수 있다.
- `users`, `departments` 테이블에 이름·직급·부서 등 자동 매핑 소스가 구축되어 있다.
- GPT-4o를 이미 문서 생성 파이프라인(`/api/generate`)에서 사용 중이다.

### 1.3 기존 기능과의 차이점

| 구분 | 문서 생성 (기존) | 자동채우기 (신규) |
|------|-----------------|-----------------|
| 시작점 | 빈 템플릿 | 반쯤 채워진 양식 파일 |
| AI 역할 | 전체 내용 작성 | 빈 필드 식별 + 값 추론/제안 |
| 사용자 개입 | 프롬프트 입력 | 미매핑 필드 수동 입력 확인 |
| 출력 | 새 문서 생성 | 원본 양식 위에 채움 |

### 1.4 Related Documents

- 기존 템플릿 분석 코드: `app/api/analyze-template/route.ts`
- DOCX 렌더러: `lib/renderers/docx.ts`
- HWPX 파싱 참고: `app/api/generate/route.ts` (HWPX 분기)
- 계약서 치환 엔진: `lib/contract-renderer.ts`

---

## 2. Scope

### 2.1 In Scope

- [ ] DOCX 파일 업로드 및 빈 필드 감지
- [ ] HWPX 파일 업로드 및 빈 필드 감지
- [ ] HWP (바이너리) 파일 업로드 지원 (제한적 — 아래 주의사항 참조)
- [ ] DB 자동 매핑: `users`(이름/직급), `departments`(부서명), 날짜, 회사명
- [ ] 미매핑 필드 수동 입력 UI (Step 2 폼)
- [ ] GPT-4o 기반 필드명 추론 및 값 제안
- [ ] 감지 신뢰도 표시 (High/Medium/Low)
- [ ] 채워진 내용 미리보기 (Step 3)
- [ ] 완성 문서 다운로드 (DOCX/HWPX 원본 포맷 유지)
- [ ] `autofill_sessions` DB 테이블 및 이력 관리
- [ ] 파일 관리 페이지 "자동채우기" 버튼 (해당 파일 타입에만 노출)
- [ ] AutofillModal 3단계 UI 흐름

### 2.2 Out of Scope

- PDF 파일 자동채우기 (PDF는 편집 구조 상이, 별도 기능으로 분리)
- HWP5 이하 구버전 완전 파싱 (node-hwp 지원 범위 내에서만)
- 이미지/표 안 텍스트 OCR 기반 필드 감지
- 완성 문서의 HWPX → DOCX 포맷 변환
- 서명/날인 삽입 자동화

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | 요구사항 | 우선순위 | 상태 |
|----|---------|---------|------|
| FR-01 | DOCX 파일 업로드 후 빈 필드 자동 감지 (`w:tbl` 빈 `w:tc`, `___`, `( )`, `〔　〕` 패턴) | P0 | Pending |
| FR-02 | HWPX 파일 업로드 후 빈 필드 자동 감지 (`hp:tbl` 빈 `hp:tc`, placeholder 텍스트) | P0 | Pending |
| FR-03 | HWP 바이너리 파일 업로드 후 node-hwp 기반 필드 감지 (신뢰도 표시 필수) | P1 | Pending |
| FR-04 | GPT-4o로 빈 필드 컨텍스트 분석 → 필드명(예: "작성자", "부서명") 추론 | P0 | Pending |
| FR-05 | `users` 테이블에서 name, position 자동 매핑 | P0 | Pending |
| FR-06 | `departments` 테이블에서 부서명 자동 매핑 | P0 | Pending |
| FR-07 | 현재 날짜 및 회사명(설정값) 자동 매핑 | P0 | Pending |
| FR-08 | 자동 매핑 불가 필드 → 수동 입력 폼 표시 | P0 | Pending |
| FR-09 | 각 감지 필드에 신뢰도(High/Medium/Low) 표시 | P0 | Pending |
| FR-10 | GPT-4o가 미입력 필드에 대해 컨텍스트 기반 값 제안 | P1 | Pending |
| FR-11 | 채워진 내용 미리보기 화면 제공 | P0 | Pending |
| FR-12 | 완성 문서 다운로드 (원본 포맷: DOCX/HWPX) | P0 | Pending |
| FR-13 | `autofill_sessions` 테이블에 세션 이력 저장 | P1 | Pending |
| FR-14 | 파일 관리 페이지에서 DOCX/HWPX/HWP 파일에만 "자동채우기" 버튼 노출 | P0 | Pending |
| FR-15 | AutofillModal 3단계 흐름 (분석 중 → 필드 입력 → 미리보기+다운로드) | P0 | Pending |

### 3.2 Non-Functional Requirements

| 카테고리 | 기준 | 측정 방법 |
|---------|------|---------|
| 성능 | 파일 분석(Analyze) 완료 < 10초 (5MB 이하 파일 기준) | 실제 파일로 측정 |
| 성능 | GPT-4o 필드명 추론 < 15초 | API 응답 시간 측정 |
| 보안 | 업로드 파일은 Supabase Storage에만 저장, 처리 후 임시 파일 삭제 | 코드 리뷰 |
| 신뢰성 | 감지 실패 시 사용자에게 명확한 오류 메시지 + 수동 입력 fallback | 시나리오 테스트 |
| 접근성 | 모달 내 Tab 키 이동 및 키보드 조작 지원 | 수동 테스트 |

---

## 4. 기능 상세 설계

### 4.1 분석 알고리즘

#### DOCX 분석 (`/api/autofill/analyze`)

```
1. PizZip으로 .docx 압축 해제
2. word/document.xml 파싱
3. <w:tbl> 내 <w:tc> 순회:
   - <w:t> 텍스트가 비어있거나 "___" 패턴 → 빈 필드로 마킹
   - 인접 셀 텍스트를 label로 수집
4. 일반 단락(<w:p>) 내 패턴 매칭:
   - "____", "( )", "〔　〕", "${...}", "{{...}}" 등
5. 감지된 필드 목록 → GPT-4o로 필드명 추론 요청
```

기존 `analyze-template.ts`의 감지 로직을 **재사용**하되,
출력 형식을 `autofill` 전용 구조체로 확장한다.

#### HWPX 분석

```
1. ZIP 압축 해제 → content.hpf 내 section XML 추출
2. <hp:tbl> 내 <hp:tc> 순회:
   - <hp:t> 텍스트 없는 셀 → 빈 필드 마킹
   - 인접 <hp:t> 컨텍스트 수집
3. 패턴 매칭: "____", "( )", 빈 문자열
4. 감지 필드 → GPT-4o 추론
```

#### HWP (바이너리) 분석

```
1. node-hwp 라이브러리로 파싱
2. 텍스트 추출 후 패턴 매칭만 수행 (구조 파싱 제한적)
3. 신뢰도 자동으로 "Low" 설정
4. 사용자에게 "HWP 바이너리 파일은 필드 감지 정확도가 낮을 수 있습니다" 안내
```

#### GPT-4o 필드명 추론 프롬프트 전략

```
인접 텍스트 컨텍스트(좌측 셀, 상단 셀, 단락 앞 텍스트)를 함께 전달하여:
- 필드 의미 판단: "이 빈칸은 무엇을 채우는 칸인가?"
- 자동 매핑 가능 여부: DB 소스와 매칭 가능한지 판단
- 신뢰도: 컨텍스트 명확성에 따라 High/Medium/Low 반환
```

### 4.2 자동 매핑 소스

| 매핑 키 | 소스 | 예시 필드명 |
|---------|------|-----------|
| `user.name` | `users.name` | 작성자, 신청인, 성명 |
| `user.position` | `users.position` | 직위, 직급 |
| `user.department` | `departments.name` (JOIN) | 부서, 소속 |
| `date.today` | `new Date()` | 작성일, 날짜, 일자 |
| `company.name` | 설정 테이블 또는 env | 회사명, 기관명 |

### 4.3 API 설계

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/api/autofill/analyze` | POST | 파일 분석 → 빈 필드 목록 + 자동 매핑 결과 반환 |
| `/api/autofill/generate` | POST | 필드값 적용 → 완성 문서 생성 → Storage 업로드 |
| `/api/autofill/sessions` | GET | 세션 이력 목록 조회 |
| `/api/autofill/sessions/[id]` | GET | 특정 세션 상세 조회 |

#### `/api/autofill/analyze` 요청/응답

```typescript
// Request
{
  fileId: string;       // Supabase Storage 파일 ID
  fileType: "docx" | "hwpx" | "hwp";
}

// Response
{
  sessionId: string;
  fields: {
    id: string;
    label: string;           // GPT-4o 추론 필드명
    position: object;        // 문서 내 위치 정보
    autoMapped: boolean;
    mappedSource?: string;   // "user.name" 등
    mappedValue?: string;    // 실제 값
    confidence: "High" | "Medium" | "Low";
    userInputRequired: boolean;
  }[];
  fileType: string;
  analyzedAt: string;
}
```

#### `/api/autofill/generate` 요청/응답

```typescript
// Request
{
  sessionId: string;
  fieldValues: Record<string, string>; // fieldId → 입력값
}

// Response
{
  downloadUrl: string;    // 완성 문서 임시 다운로드 URL
  outputPath: string;     // Storage 경로
  expiresAt: string;
}
```

### 4.4 DB 스키마

```sql
CREATE TABLE autofill_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id),
  file_id       TEXT NOT NULL,              -- Supabase Storage 파일 경로
  file_type     TEXT NOT NULL,              -- 'docx' | 'hwpx' | 'hwp'
  detected_fields JSONB NOT NULL DEFAULT '[]',  -- 감지된 필드 목록
  filled_values JSONB NOT NULL DEFAULT '{}',    -- 최종 입력값
  status        TEXT NOT NULL DEFAULT 'analyzing',
                -- 'analyzing' | 'awaiting_input' | 'generating' | 'completed' | 'failed'
  output_path   TEXT,                       -- 완성 문서 Storage 경로
  error_message TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: 본인 세션만 조회/수정 가능
ALTER TABLE autofill_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own autofill sessions"
  ON autofill_sessions
  FOR ALL
  USING (auth.uid() = user_id);
```

### 4.5 UI 흐름

#### 파일 관리 페이지

```
파일 목록 → DOCX/HWPX/HWP 파일 행에만 "자동채우기" 버튼 표시
→ 클릭 시 AutofillModal 열림
```

#### AutofillModal 3단계

```
Step 1: 분석 중
├── 로딩 스피너 + "AI가 문서를 분석하고 있습니다..."
├── /api/autofill/analyze 호출
└── 성공 시 Step 2로 이동

Step 2: 필드 확인 및 입력
├── 자동 매핑된 필드 목록 (읽기 전용 + 신뢰도 뱃지)
│   예) [성명] 홍길동 [High] ✓ 자동입력
├── 수동 입력 필요 필드 (입력폼)
│   예) [사유] ________ (GPT 제안: "업무 협력 요청")
├── GPT 제안값 적용/무시 버튼
└── "완성 문서 생성" 버튼 → Step 3

Step 3: 미리보기 + 다운로드
├── 채워진 필드 요약 테이블
├── "다운로드" 버튼 → /api/autofill/generate 호출
└── 완성 파일 다운로드
```

---

## 5. MoSCoW 우선순위

| 우선순위 | 항목 |
|---------|------|
| **Must (P0)** | DOCX 빈 필드 감지, HWPX 빈 필드 감지, GPT-4o 필드명 추론, DB 자동 매핑(이름/부서/날짜), 수동 입력 폼, 신뢰도 표시, AutofillModal 3단계 UI, 완성 문서 다운로드 |
| **Should (P1)** | HWP 바이너리 지원, GPT-4o 값 제안, autofill_sessions 이력 저장 |
| **Could (P2)** | 이력 페이지 UI, 세션별 다시 사용 기능, 미리보기 문서 렌더링(DocxPreview) |
| **Won't** | PDF 자동채우기, 포맷 변환(HWPX→DOCX), 서명/날인 삽입 |

---

## 6. 성공 기준 (Definition of Done)

### 6.1 기능 완료 기준

- [ ] DOCX 파일(빈 셀 + 패턴) 필드 감지 정확도 80% 이상 (테스트 문서 5종 기준)
- [ ] HWPX 파일 필드 감지 정확도 75% 이상
- [ ] 자동 매핑 정확도: 매핑 소스가 명확한 경우 100%
- [ ] 완성 문서 다운로드 정상 동작 (DOCX/HWPX 각 1종 이상)
- [ ] AutofillModal 3단계 전환 오류 없음
- [ ] `autofill_sessions` RLS 정상 적용 확인

### 6.2 GAP 분석 체크리스트

| 검증 항목 | 기준 | 확인 방법 |
|---------|------|---------|
| API 라우트 존재 | `/api/autofill/analyze`, `/api/autofill/generate` | 코드 탐색 |
| DB 스키마 적용 | `autofill_sessions` 테이블 존재 + RLS 정책 | Supabase 대시보드 |
| 신뢰도 표시 | 모든 감지 필드에 High/Medium/Low 표시 | UI 확인 |
| HWP 경고 메시지 | HWP 업로드 시 정확도 경고 노출 | 시나리오 테스트 |
| 자동 매핑 소스 | users + departments 테이블 JOIN 정상 동작 | API 응답 확인 |
| 다운로드 URL 만료 | expiresAt 이후 접근 불가 | 만료 후 요청 테스트 |
| 기존 코드 재사용 | analyze-template.ts 로직 중복 없이 import 활용 | 코드 리뷰 |

---

## 7. 리스크 및 대응 방안

| 리스크 | 영향도 | 발생가능성 | 대응 방안 |
|-------|--------|----------|---------|
| HWP 바이너리 파싱 한계 | High | High | node-hwp 지원 범위 명시, 신뢰도 Low 강제 표시, 사용자 경고 안내 |
| GPT-4o 필드명 추론 오류 | Medium | Medium | 신뢰도 뱃지로 사용자가 직접 확인 후 수정 가능하도록 설계 |
| 대용량 파일 타임아웃 | Medium | Low | 파일 크기 제한 (10MB), 분석 API 타임아웃 30초 설정 |
| HWPX 구조 다양성 | Medium | Medium | 최소 3종 이상 실제 문서로 사전 검증 후 릴리스 |
| 기존 analyze-template.ts 충돌 | Low | Low | 함수 단위 import, 인터페이스 분리로 사이드이펙트 방지 |
| Supabase Storage 임시 파일 누적 | Low | Medium | 완성 문서 생성 후 24시간 내 자동 삭제 정책 적용 |

---

## 8. 구현 시 주의사항

### 8.1 HWP 바이너리 파싱 한계

- HWP(`.hwp`) 형식은 Microsoft OLE Compound Document 기반 독점 바이너리 포맷이다.
- `node-hwp` 라이브러리는 일부 버전의 HWP만 지원하며, 파싱 실패 시 오류가 발생할 수 있다.
- **구현 원칙**: HWP 파일은 패턴 매칭 방식(텍스트 추출 후 `___` 등 탐지)으로만 처리하고, 반드시 신뢰도를 `Low`로 고정하여 사용자에게 표시한다.
- HWP 대신 HWPX 저장을 권장하는 안내 문구를 UI에 포함한다.

### 8.2 필드 감지 신뢰도 표시 필수

- 모든 감지 필드에는 반드시 `confidence: "High" | "Medium" | "Low"` 뱃지를 표시한다.
- **신뢰도 없는 자동 채움 금지**: 신뢰도 표시 없이 자동 값을 적용하면 사용자가 오류를 인지하지 못할 위험이 있다.
- Low 신뢰도 필드는 수동 입력 폼을 기본으로 보여주고, 자동 매핑 값은 "제안"으로만 표시한다.

### 8.3 기존 코드 재사용 원칙

- `analyze-template.ts`의 XML 파싱 함수를 **직접 import**하여 사용한다. 동일 로직 중복 작성 금지.
- `lib/renderers/docx.ts` (PizZip + docxtemplater)를 활용하여 필드 치환 후 파일 생성.
- `contract-renderer.ts`의 `indexOf` 기반 치환은 autofill에서는 **직접 사용하지 않는다** (위치 기반 치환이 필요하기 때문).

### 8.4 API-DB-RLS 전체 흐름 검증

- `autofill_sessions` 테이블 접근 시 항상 `auth.uid() = user_id` RLS 정책 적용 여부 확인.
- `/api/autofill/generate` 에서 Storage 다운로드 URL 생성 시 서명된 URL(Signed URL) 사용, 만료 시간 설정 필수.

---

## 9. 버전 계획

| 버전 | 내용 | 조건 |
|------|------|------|
| v6.5.0 | P0 기능 완료: DOCX/HWPX 분석 + 자동 매핑 + UI 3단계 + 다운로드 | GAP 분석 80% 이상 |
| v6.6.0 | P1 기능 완료: HWP 지원 + GPT 값 제안 + 세션 이력 | GAP 분석 90% 이상 |

---

## 10. Architecture Considerations

### 10.1 Project Level

CLIO는 **Dynamic** 레벨 — Feature 모듈 기반, Supabase BaaS 통합.

### 10.2 신규 파일/폴더 구조

```
app/
├── api/
│   └── autofill/
│       ├── analyze/route.ts      # 파일 분석 API
│       ├── generate/route.ts     # 문서 생성 API
│       └── sessions/
│           ├── route.ts          # 세션 목록
│           └── [id]/route.ts     # 세션 상세
components/
└── autofill/
    ├── AutofillModal.tsx         # 3단계 모달
    ├── FieldList.tsx             # 감지 필드 목록 + 신뢰도 뱃지
    ├── ManualInputForm.tsx       # 수동 입력 폼
    └── PreviewStep.tsx           # 미리보기 + 다운로드
lib/
└── autofill/
    ├── docx-analyzer.ts          # DOCX 빈 필드 감지 (analyze-template.ts 재활용)
    ├── hwpx-analyzer.ts          # HWPX 빈 필드 감지
    ├── hwp-analyzer.ts           # HWP 바이너리 (node-hwp)
    ├── field-mapper.ts           # DB 자동 매핑 로직
    └── document-filler.ts        # 완성 문서 생성 (docx.ts 렌더러 활용)
```

### 10.3 Key Architectural Decisions

| 결정 | 선택 | 근거 |
|------|------|------|
| 상태 관리 | React useState + SWR | 기존 CLIO 패턴 유지 |
| 파일 파싱 | PizZip (기존) + node-hwp (신규) | 기존 코드 재활용 극대화 |
| AI 연동 | GPT-4o via 기존 `/api/generate` 패턴 | 일관성 |
| Storage | Supabase Storage (기존) | 기존 인프라 활용 |

---

## 11. Next Steps

1. [ ] CTO(대장)에게 계획서 검토 및 승인 요청
2. [ ] 설계 문서 작성 (`clio-autofill.design.md`)
3. [ ] node-hwp 라이브러리 사전 검증 (실제 HWP 파일 파싱 테스트)
4. [ ] Supabase 마이그레이션 스크립트 준비 (`autofill_sessions` 테이블)
5. [ ] 구현 시작 → GAP 분석 → v6.5.0 릴리스

---

## Version History

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|---------|------|
| 0.1 | 2026-04-15 | 최초 작성 | Product Manager |
