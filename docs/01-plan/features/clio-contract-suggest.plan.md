# 법령 기반 계약 조항 수정 제안 (Contract Suggest) 계획서

> **Summary**: 계약 리스크 분석 결과(A/B/C 등급)의 위험 조항에 대해 법령 RAG 검색 + GPT-4o 수정 제안문 생성, 원본 파일 직접 적용 및 인쇄 리포트 기능
>
> **Project**: CLIO
> **Version**: v6.4.0 → v6.7.0 (타겟)
> **Author**: Product Manager
> **Date**: 2026-04-16
> **Status**: Draft

---

## 1. Overview

### 1.1 Purpose

기존 CLIO의 계약 리스크 분석 기능(`/contract-risk/[id]`)은 계약서를 25개 항목에 대해 A/B/C 등급으로 평가한다.
그러나 현재 기능은 **"이 조항이 위험하다"는 진단만 제공**할 뿐, 실제로 어떻게 수정해야 하는지 구체적인 대안을 제시하지 않는다.

본 기능은 **실제 법령 조문을 RAG(Retrieval-Augmented Generation)로 검색**하여 위험 조항의 법적 근거를 파악하고,
GPT-4o가 **법령 준수 관점의 수정 제안문을 생성**하며, 사용자가 승인한 수정안을 **원본 계약서 파일에 직접 적용**하는
완결된 계약서 수정 워크플로우를 구현하는 것을 목표로 한다.

### 1.2 Background

- CLIO v6.0.0부터 계약 리스크 분석(`/contract-risk/[id]`) 기능이 운영 중이다. 25개 항목 A/B/C 등급 분류 및 위험 조항 목록 제공.
- 기존 DOCX/HWPX 파싱 파이프라인(`lib/renderers/docx.ts`, HWPX ZIP+XML)과 계약서 치환 엔진(`lib/contract-renderer.ts`)이 구축되어 있다.
- Supabase에 pgvector 확장이 사용 가능하다 (기존 문서 임베딩 파이프라인 참조).
- GPT-4o는 기존 `/api/generate`, `/api/contract-risk` 파이프라인에서 이미 활용 중이다.
- 사용자 피드백: "위험 등급을 알아도 어떻게 고쳐야 할지 모르겠다"는 니즈가 지속적으로 수집됨.

### 1.3 기존 기능과의 차이점

| 구분 | 계약 리스크 분석 (기존) | 수정 제안 (신규) |
|------|----------------------|----------------|
| 출력 | 위험 조항 등급(A/B/C) | 법령 근거 + 수정 제안문 |
| AI 역할 | 리스크 분류 | RAG 검색 + 수정문 생성 |
| 법령 활용 | 없음 (GPT 내부 지식) | pgvector RAG (실제 법령 조문) |
| 사용자 액션 | 리포트 확인 | 수정안 선택 → 파일 적용 |
| 파일 변경 | 없음 | 원본 파일 재생성 |

### 1.4 Related Documents

- 계약 리스크 분석 API: `app/api/contract-risk/[id]/route.ts`
- DOCX 렌더러: `lib/renderers/docx.ts`
- 계약서 치환 엔진: `lib/contract-renderer.ts`
- 기존 리스크 분석 페이지: `app/contract-risk/[id]/page.tsx`
- Autofill 계획서 (파싱 전략 참고): `docs/01-plan/features/clio-autofill.plan.md`

---

## 2. Scope

### 2.1 In Scope

- [ ] pgvector 기반 `law_chunks` 테이블 생성 및 법령 시드 데이터 주입
- [ ] 수록 법령 5종 텍스트 사전 임베딩 (민법 채권편, 하도급법, SW진흥법, 개인정보보호법, 전자문서법)
- [ ] 위험 조항별 RAG 검색 (pgvector cosine similarity)
- [ ] GPT-4o 수정 제안문 생성 API (`/api/contract-risk/[id]/suggest`)
- [ ] `/contract-risk/[id]` 페이지 UI 전면 재구성 (좌측 조항 목록 + 우측 3탭 패널)
- [ ] 원본 파일 파싱: DOCX(PizZip), HWPX(ZIP+XML), PDF 텍스트 레이어(pdf-parse), PDF 스캔본(GPT-4o Vision OCR), HWP(node-hwp)
- [ ] 선택 조항 수정 적용 → 파일 재생성 API (`/api/contract-risk/[id]/apply`)
- [ ] PDF/HWP 원본은 DOCX로 재생성 (형식 변환 명시 안내)
- [ ] 수정 제안 리포트 인쇄 (`@media print` CSS)
- [ ] 법령 시드 주입 관리자 API (`/api/laws/seed`)

### 2.2 Out of Scope

- 법령 실시간 크롤링 또는 법제처 OpenAPI 연동 (초기 버전에서는 사전 임베딩된 시드만 사용)
- 한글(HWP) 원본 포맷 그대로 재생성 (DOCX로 변환 후 제공)
- 계약서 내 모든 조항 일괄 자동 수정 (사용자가 조항별로 선택 후 적용)
- 수정 이력 버전 관리 (파일 히스토리 diff 뷰)
- 법령 해석 법률 자문 보증 (AI 제안임을 명시, 법률 전문가 검토 권고 안내 필수)

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | 요구사항 | 우선순위 | 상태 |
|----|---------|---------|------|
| FR-01 | `law_chunks` 테이블 생성: id, law_name, article_no, clause_no, content, embedding vector(1536), category | P0 | Pending |
| FR-02 | 법령 시드 5종 임베딩 후 `law_chunks`에 저장 (`/api/laws/seed` 1회성 관리자 API) | P0 | Pending |
| FR-03 | 위험 조항 원문 → OpenAI text-embedding-3-small 임베딩 → pgvector cosine similarity 상위 5개 법령 조문 검색 | P0 | Pending |
| FR-04 | GPT-4o에 [위험 조항 원문 + 관련 법령 조문 + 등급/리스크 사유] 전달 → 수정 제안문 생성 | P0 | Pending |
| FR-05 | `/api/contract-risk/[id]/suggest` POST: 조항 ID 수신 → RAG 검색 + GPT 수정 제안 반환 | P0 | Pending |
| FR-06 | `/contract-risk/[id]` 페이지 좌측 패널: 위험 조항 목록 (등급 뱃지, 선택 시 우측 패널 갱신) | P0 | Pending |
| FR-07 | 우측 패널 3탭: [원문] 조항 원문 / [법령] 관련 법령 조문 카드 / [수정 제안] GPT 생성 수정문 | P0 | Pending |
| FR-08 | 수정 제안 탭에서 "이 수정안 적용" 버튼 → 해당 조항만 선택적 적용 가능 | P0 | Pending |
| FR-09 | DOCX 원본 파싱: PizZip + XML 텍스트 추출 → 위험 조항 텍스트 위치 특정 → 수정안으로 교체 → 재생성 | P0 | Pending |
| FR-10 | HWPX 원본 파싱: ZIP + section XML 파싱 → 조항 텍스트 치환 → 재생성 | P0 | Pending |
| FR-11 | PDF(텍스트 레이어) 파싱: pdf-parse 라이브러리로 텍스트 추출 → 수정 후 DOCX 재생성 | P0 | Pending |
| FR-12 | PDF(스캔본) 파싱: GPT-4o Vision OCR → 텍스트 추출 → 수정 후 DOCX 재생성 | P1 | Pending |
| FR-13 | HWP 파싱: node-hwp 텍스트 추출 → 수정 후 DOCX 재생성 | P1 | Pending |
| FR-14 | `/api/contract-risk/[id]/apply` POST: 선택 조항 수정안 배열 수신 → 파일 재생성 → Storage 업로드 → 다운로드 URL 반환 | P0 | Pending |
| FR-15 | PDF/HWP 원본 적용 시 "DOCX로 재생성됩니다" 사용자 안내 표시 | P0 | Pending |
| FR-16 | 수정 제안 리포트 인쇄 버튼 → `@media print` CSS로 조항별 원문/수정안/법령 근거 인쇄 레이아웃 | P1 | Pending |
| FR-17 | 모든 수정 제안에 "AI 생성 제안입니다. 법률 전문가 검토를 권장합니다" 면책 고지 표시 | P0 | Pending |

### 3.2 Non-Functional Requirements

| 카테고리 | 기준 | 측정 방법 |
|---------|------|---------|
| 성능 | RAG 검색(pgvector) + GPT 수정 제안 완료 < 20초/조항 | 실제 API 응답 시간 측정 |
| 성능 | 파일 적용(apply) 완료 < 15초 (10MB 이하 파일 기준) | 실제 파일로 측정 |
| 보안 | 법령 시드 API (`/api/laws/seed`)는 관리자 권한만 접근 가능 | RLS + middleware 검증 |
| 보안 | 생성된 수정 파일은 Supabase Storage Signed URL 제공, 24시간 만료 | 코드 리뷰 |
| 신뢰성 | RAG 검색 결과 없을 때 "관련 법령 조문을 찾지 못했습니다" 명시 + GPT 일반 제안으로 fallback | 시나리오 테스트 |
| 법적 고지 | 모든 수정 제안 화면에 AI 생성 및 법률 전문가 검토 권고 안내 필수 포함 | UI 확인 |
| 접근성 | 좌측/우측 패널 키보드 탐색 지원, Tab 이동 정상 동작 | 수동 테스트 |

---

## 4. 기능 상세 설계

### 4.1 RAG 인프라

#### 법령 청크 전략

```
각 법령 조문(조, 항, 호) 단위로 청크 분할:
- law_name: "민법", "하도급거래 공정화에 관한 법률" 등
- article_no: "제390조", "제13조" 등
- clause_no: "제1항", "제2항" (항이 없으면 NULL)
- content: 해당 조문 원문 텍스트
- category: "손해배상" | "지체상금" | "해제/해지" | "개인정보" | "전자서명" 등
- embedding: text-embedding-3-small (1536차원) 벡터
```

#### 수록 법령 5종 초기 시드

| 법령 | 대상 범위 | 관련 계약 리스크 항목 |
|------|---------|-------------------|
| 민법 제3편 채권 (제527조~제733조) | 계약 성립, 채무불이행, 손해배상, 해제·해지 | 손해배상 한도, 계약 해제 조항 |
| 하도급거래 공정화에 관한 법률 | 지체상금, 선급금, 대금 지급, 부당 특약 | 지체상금율, 대금 지급 기한 |
| 소프트웨어 진흥법 | SW 사업 계약 분쟁 기준, 과업 변경 | SW 과업 범위, 유지보수 조항 |
| 개인정보 보호법 | 개인정보 처리·위탁·제3자 제공 조항 | 개인정보 처리 조항 |
| 전자문서 및 전자거래 기본법 | 전자서명 효력, 전자문서 법적 효력 | 전자계약 효력 조항 |

#### RAG 검색 플로우

```
1. 위험 조항 원문 → text-embedding-3-small 임베딩
2. law_chunks 테이블에서 cosine similarity 상위 5개 조문 검색
   (pgvector: <=> 연산자 사용)
3. 검색된 조문을 GPT-4o 프롬프트에 컨텍스트로 포함
4. 검색 결과가 0개이면 → GPT-4o 단독 생성 + "법령 근거 없음" 표시
```

#### GPT-4o 수정 제안 프롬프트 전략

```
역할: 법무 검토 어시스턴트
입력:
  - 위험 조항 원문
  - 리스크 등급 및 사유 (기존 분석 결과)
  - 관련 법령 조문 (RAG 검색 결과)
출력 형식:
  {
    "suggested_text": "수정 제안 조항 원문",
    "reason": "수정 근거 (법령 조문 인용 포함)",
    "law_references": ["민법 제390조", ...],
    "risk_reduction": "High/Medium"  // 수정 후 예상 리스크 감소
  }
```

### 4.2 UI 전면 재구성

#### 기존 `/contract-risk/[id]` 페이지 → 신규 레이아웃

```
┌─────────────────────────────────────────────────────────┐
│ 헤더: 계약서명 + 종합 리스크 등급 + [인쇄] 버튼          │
├──────────────────┬──────────────────────────────────────┤
│ 좌측 패널        │ 우측 패널                             │
│ (조항 목록)      │ (탭 전환: 원문 / 법령 / 수정 제안)    │
│                  │                                       │
│ [A] 제3조 손해배상│ [원문] [법령] [수정 제안]             │
│ [B] 제7조 지체상금│                                       │
│ [C] 제12조 해제  │ ← 선택된 조항 상세 표시               │
│ ...              │                                       │
│                  │ [이 수정안 적용] 버튼                  │
├──────────────────┴──────────────────────────────────────┤
│ 하단: [선택한 수정안 모두 적용 → 파일 다운로드] 버튼     │
└─────────────────────────────────────────────────────────┘
```

#### 우측 패널 탭 상세

```
[원문] 탭
- 해당 조항 원문 텍스트 표시 (하이라이트)
- 리스크 등급 뱃지 + 기존 분석 사유

[법령] 탭
- RAG 검색된 관련 법령 조문 카드 (최대 5개)
- 카드 구성: 법령명 + 조문번호 + 조문 원문
- 검색 결과 없을 때: "관련 법령 조문을 찾지 못했습니다" 안내

[수정 제안] 탭
- GPT-4o 생성 수정 제안문 (박스 하이라이트)
- 수정 근거 설명 (법령 인용 포함)
- 수정 후 예상 리스크 감소 표시
- "이 수정안 적용" 체크박스 + 버튼
- AI 면책 고지 문구 (항상 표시)
```

### 4.3 파일 파싱 및 재작성 전략

| 파일 타입 | 파싱 방법 | 재작성 방법 | 비고 |
|---------|---------|----------|----|
| DOCX | PizZip + word/document.xml XML 파싱 | 기존 `contract-renderer.ts` + `lib/renderers/docx.ts` 재활용 | 원본 포맷 유지 |
| HWPX | ZIP 압축 해제 + section XML 파싱 | HWPX 기존 파이프라인 재활용 | 원본 포맷 유지 |
| PDF (텍스트 레이어) | pdf-parse 라이브러리 | DOCX로 재생성 (변환 안내 필수) | 포맷 변경 발생 |
| PDF (스캔본) | GPT-4o Vision OCR | DOCX로 재생성 (변환 안내 필수) | 포맷 변경 발생 |
| HWP | node-hwp 텍스트 추출 | DOCX로 재생성 (변환 안내 필수) | 포맷 변경 발생 |

#### 조항 텍스트 위치 특정 전략

```
DOCX:
1. word/document.xml 내 <w:p> 단락 순회
2. 기존 리스크 분석에서 추출한 조항 원문(substring)으로 매칭
3. 해당 <w:p> 블록의 <w:t> 텍스트를 수정안으로 교체
4. 멀티 단락 조항: 시작 단락~끝 단락 범위 교체

HWPX:
1. section XML 내 <hp:p> 단락 순회
2. 동일 substring 매칭 전략
3. 해당 <hp:t> 텍스트 교체

PDF/HWP:
1. 전체 텍스트 추출 → 조항 텍스트 str.replace()
2. 수정된 전체 텍스트로 DOCX 신규 생성 (docxtemplater 활용)
```

### 4.4 API 설계

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/api/contract-risk/[id]/suggest` | POST | 조항 ID → RAG 검색 + GPT 수정 제안 반환 |
| `/api/contract-risk/[id]/apply` | POST | 선택 조항 수정안 적용 → 파일 재생성 → 다운로드 URL |
| `/api/laws/seed` | POST | 법령 시드 데이터 주입 (관리자 전용, 1회성) |

#### `/api/contract-risk/[id]/suggest` 요청/응답

```typescript
// Request
{
  clauseId: string;       // 위험 조항 ID (기존 리스크 분석 결과의 조항 식별자)
  clauseText: string;     // 조항 원문 (RAG 임베딩 입력)
  riskGrade: "A" | "B" | "C";
  riskReason: string;     // 기존 분석 사유
}

// Response
{
  clauseId: string;
  suggestedText: string;        // 수정 제안 조항문
  reason: string;               // 수정 근거 (법령 인용 포함)
  lawReferences: {
    lawName: string;            // "민법"
    articleNo: string;          // "제390조"
    clauseNo: string | null;    // "제1항"
    content: string;            // 법령 조문 원문
  }[];
  riskReduction: "High" | "Medium" | "None";
  generatedAt: string;
}
```

#### `/api/contract-risk/[id]/apply` 요청/응답

```typescript
// Request
{
  contractId: string;
  appliedClauses: {
    clauseId: string;
    originalText: string;    // 교체 대상 원문
    suggestedText: string;   // 수정안
  }[];
}

// Response
{
  downloadUrl: string;     // Supabase Storage Signed URL (24시간 만료)
  outputPath: string;      // Storage 경로
  outputFormat: "docx" | "hwpx";  // 재생성 포맷
  convertedFrom?: string;  // 변환된 경우 원본 포맷 명시 ("pdf" | "hwp")
  expiresAt: string;
}
```

#### `/api/laws/seed` 요청/응답

```typescript
// Request
{
  adminKey: string;       // 관리자 시크릿 키
  laws: {
    lawName: string;
    articleNo: string;
    clauseNo?: string;
    content: string;
    category: string;
  }[];
}

// Response
{
  inserted: number;       // 삽입된 청크 수
  skipped: number;        // 중복으로 건너뛴 청크 수
  errors: string[];
}
```

### 4.5 DB 스키마

```sql
-- pgvector 확장 활성화 (기존에 없을 경우)
CREATE EXTENSION IF NOT EXISTS vector;

-- 법령 청크 테이블
CREATE TABLE law_chunks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  law_name    TEXT NOT NULL,        -- "민법", "하도급거래 공정화에 관한 법률" 등
  article_no  TEXT NOT NULL,        -- "제390조"
  clause_no   TEXT,                 -- "제1항" (없으면 NULL)
  content     TEXT NOT NULL,        -- 법령 조문 원문
  embedding   vector(1536),         -- text-embedding-3-small 벡터
  category    TEXT NOT NULL,        -- "손해배상" | "지체상금" | "개인정보" 등
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- pgvector 인덱스 (cosine similarity 최적화)
CREATE INDEX ON law_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- 법령 조문은 공개 정보이므로 RLS 불필요 (읽기 전용 공개 테이블)
-- 쓰기는 관리자 API 키로만 가능 (RLS 없이 서비스 롤로 접근)
```

### 4.6 인쇄 기능 (`@media print`)

```
인쇄 레이아웃:
┌─────────────────────────────────────┐
│ CLIO 계약서 수정 제안 리포트         │
│ 계약서명: [계약서명] | 생성일: [날짜]│
├─────────────────────────────────────┤
│ [조항 1: 제3조 손해배상]             │
│ 리스크 등급: A                       │
│                                     │
│ 원문:                               │
│ "갑이 을에게 지급할 손해배상..."     │
│                                     │
│ 관련 법령: 민법 제390조 (채무불이행) │
│ "[조문 원문]"                        │
│                                     │
│ 수정 제안:                           │
│ "갑이 을에게 지급할 손해배상은..."   │
│                                     │
│ 수정 근거: 민법 제390조에 따르면...  │
├─────────────────────────────────────┤
│ * 본 리포트는 AI 생성 결과로...      │
└─────────────────────────────────────┘

@media print 적용:
- 좌측 패널(조항 목록) 숨김
- 우측 패널 전체 너비 표시
- 각 조항마다 페이지 구분 (page-break-after)
- 면책 고지 문구 하단 고정
```

---

## 5. MoSCoW 우선순위

| 우선순위 | 항목 |
|---------|------|
| **Must (P0)** | `law_chunks` 테이블 + pgvector 인덱스, 법령 시드 5종 임베딩, RAG 검색 + GPT 수정 제안 API, `/contract-risk/[id]` 페이지 좌우 패널 UI 재구성, DOCX/HWPX 파싱 + 수정 적용 + 파일 재생성, 면책 고지 표시 |
| **Should (P1)** | PDF 스캔본 GPT-4o Vision OCR, HWP 파싱 지원, 수정 제안 리포트 인쇄 (`@media print`) |
| **Could (P2)** | 법령 조문 즐겨찾기/북마크, 수정 이력 저장(세션 기록), 리스크 감소 시뮬레이션 수치 표시 |
| **Won't** | 법제처 OpenAPI 실시간 연동, HWP 원본 포맷 재생성, 법률 전문가 연결 서비스, 계약서 일괄 자동 수정 |

---

## 6. 성공 기준 (Definition of Done)

### 6.1 기능 완료 기준

- [ ] `law_chunks` 테이블 생성 + 법령 5종 시드 데이터 삽입 완료 (최소 500개 청크)
- [ ] pgvector RAG 검색: 위험 조항 입력 시 관련 법령 조문 1개 이상 반환 (5종 법령 중 해당 영역에서)
- [ ] GPT-4o 수정 제안 생성 정상 동작 (조항당 응답 시간 20초 이내)
- [ ] 좌/우측 패널 UI: 조항 선택 시 우측 3탭 정상 전환
- [ ] DOCX 파일 수정 적용 후 다운로드 정상 동작
- [ ] HWPX 파일 수정 적용 후 다운로드 정상 동작
- [ ] PDF 텍스트 레이어 파싱 후 DOCX 재생성 정상 동작
- [ ] 면책 고지 문구 모든 수정 제안 화면에 표시 확인
- [ ] 관리자 외 `/api/laws/seed` 접근 차단 확인

### 6.2 GAP 분석 체크리스트

| 검증 항목 | 기준 | 확인 방법 |
|---------|------|---------|
| API 라우트 존재 | `/api/contract-risk/[id]/suggest`, `/api/contract-risk/[id]/apply`, `/api/laws/seed` | 코드 탐색 |
| DB 스키마 적용 | `law_chunks` 테이블 존재 + vector(1536) 컬럼 + ivfflat 인덱스 | Supabase 대시보드 |
| pgvector 검색 동작 | 테스트 조항 입력 시 법령 조문 반환 (SQL 직접 확인) | Supabase SQL Editor |
| 면책 고지 표시 | 수정 제안 탭 내 AI 고지 문구 렌더링 | UI 확인 |
| 관리자 API 보호 | 비관리자 키로 `/api/laws/seed` 요청 시 403 반환 | API 테스트 |
| 파일 재생성 포맷 | DOCX/HWPX 재생성 파일 정상 열람 가능 | 실제 파일 열기 |
| PDF/HWP 변환 안내 | PDF/HWP 파일 적용 시 "DOCX로 재생성" 안내 UI 표시 | 시나리오 테스트 |
| Signed URL 만료 | 24시간 후 다운로드 URL 접근 불가 | 만료 후 요청 테스트 |
| 기존 리스크 분석 무결성 | 신규 UI 도입 후 기존 분석 결과 데이터 정상 표시 | 회귀 테스트 |

---

## 7. 리스크 및 대응 방안

| 리스크 | 영향도 | 발생가능성 | 대응 방안 |
|-------|--------|----------|---------|
| GPT-4o 수정 제안 법적 오류 | High | Medium | 면책 고지 필수 표시, "AI 제안 / 법률 전문가 검토 필요" 명시. 오류 책임 사용자에게 귀속 |
| pgvector 확장 미설치 | High | Low | Supabase 프로젝트 설정에서 vector 확장 활성화 선행 확인 후 시작 |
| 법령 시드 청크 품질 저하 | Medium | Medium | 청크 단위를 조문(조/항/호) 기준으로 엄격히 분할, 시드 삽입 전 내용 검수 |
| 조항 원문 매칭 실패 (substring 불일치) | Medium | High | 정규화 함수 적용 (공백/특수문자 정규화), 유사도 기반 매칭 fallback 고려 |
| 대용량 계약서 파싱 타임아웃 | Medium | Medium | 파일 크기 제한 20MB, 타임아웃 30초, 진행 상태 스피너 표시 |
| PDF 스캔본 OCR 정확도 | Medium | High | GPT-4o Vision OCR 결과 사용자 확인 단계 추가, 낮은 신뢰도 경고 표시 |
| HWP 파싱 실패 | Medium | High | node-hwp 지원 범위 명시, 실패 시 "DOCX/HWPX로 변환 후 업로드" 안내 |
| 기존 리스크 분석 UI 회귀 | Low | Medium | 페이지 전면 재구성 전 기존 데이터/API 호환성 사전 검증 |

---

## 8. 구현 시 주의사항

### 8.1 법적 면책 고지 필수

- 모든 수정 제안 화면에 "본 수정 제안은 AI가 생성한 참고용 결과입니다. 실제 계약서 적용 전 반드시 법률 전문가의 검토를 받으시기 바랍니다." 문구를 항상 표시한다.
- **면책 고지 없는 수정 제안 화면 배포 금지.**

### 8.2 조항 텍스트 매칭 안전성

- 원본 파일에서 조항 텍스트를 찾을 때 완전 일치(exact match)가 실패하는 경우를 반드시 처리해야 한다.
- 공백·줄바꿈·특수문자 정규화 후 매칭 재시도 로직을 포함한다.
- 매칭 실패 시: "해당 조항을 파일에서 찾지 못했습니다. 수동으로 수정 후 저장해 주세요" 안내 제공.

### 8.3 pgvector RAG 검색 품질

- `text-embedding-3-small` 사용 (비용 절감 + 1536차원 호환).
- cosine similarity 임계값 0.75 이상인 결과만 반환. 임계값 미달 시 "관련 법령 조문 없음" 표시.
- 법령 시드 데이터는 법령 원문 그대로 사용하며, 요약하거나 변형하지 않는다.

### 8.4 기존 기능 무결성 보호

- `/contract-risk/[id]` 페이지 UI 전면 재구성 시, 기존 25개 항목 분석 결과 데이터 표시 기능이 정상 동작하는지 회귀 테스트 필수.
- 기존 리스크 분석 API(`/api/contract-risk/[id]`)는 수정하지 않고, 신규 API를 별도 라우트로 추가한다.

### 8.5 API-DB-RLS 전체 흐름 검증

- `law_chunks` 테이블은 공개 읽기(SELECT)는 허용, 쓰기(INSERT)는 서비스 롤 전용으로 설정.
- `/api/laws/seed`는 미들웨어에서 관리자 키 검증 후 서비스 롤 Supabase 클라이언트 사용.
- `/api/contract-risk/[id]/apply`에서 생성된 Signed URL은 반드시 만료 시간(24시간) 설정.

---

## 9. 버전 계획

| 버전 | 내용 | 포함 단계 | 조건 |
|------|------|---------|------|
| v6.6.0 | RAG 인프라 + 수정 제안 + UI 재구성 | 1단계(법령 시드) + 2단계(suggest API) + 3단계(UI) | GAP 분석 80% 이상 |
| v6.7.0 | 원본 파일 적용 + 인쇄 기능 | 4단계(apply API) + 5단계(인쇄) | GAP 분석 90% 이상 |

### 구현 단계별 상세

| 단계 | 내용 | 산출물 |
|------|------|--------|
| 1단계 | `law_chunks` 테이블 + pgvector 인덱스 + `/api/laws/seed` + 법령 5종 시드 데이터 삽입 | DB 마이그레이션 파일 + 시드 스크립트 |
| 2단계 | RAG 검색 함수 + GPT-4o 수정 제안 + `/api/contract-risk/[id]/suggest` API | API 라우트 파일 |
| 3단계 | `/contract-risk/[id]` 페이지 좌우 패널 UI + 3탭 컴포넌트 | 컴포넌트 파일들 |
| 4단계 | 파일 타입별 파싱 모듈 + `/api/contract-risk/[id]/apply` API | 파싱 라이브러리 + API 라우트 |
| 5단계 | `@media print` CSS + 인쇄 버튼 컴포넌트 | 스타일 파일 + 버튼 컴포넌트 |

---

## 10. Architecture Considerations

### 10.1 Project Level

CLIO는 **Dynamic** 레벨 — Feature 모듈 기반, Supabase BaaS 통합.

### 10.2 신규 파일/폴더 구조

```
app/
├── api/
│   ├── contract-risk/
│   │   └── [id]/
│   │       ├── suggest/route.ts      # RAG 검색 + GPT 수정 제안
│   │       └── apply/route.ts        # 조항 수정 적용 + 파일 재생성
│   └── laws/
│       └── seed/route.ts             # 법령 시드 주입 (관리자 전용)
├── contract-risk/
│   └── [id]/
│       └── page.tsx                  # UI 전면 재구성 (좌우 패널)
components/
└── contract-suggest/
    ├── ClauseList.tsx                 # 좌측: 위험 조항 목록 (등급 뱃지)
    ├── SuggestPanel.tsx               # 우측: 3탭 패널 컨테이너
    ├── OriginalTab.tsx                # 원문 탭
    ├── LawTab.tsx                     # 법령 조문 카드 탭
    ├── SuggestTab.tsx                 # 수정 제안 탭 + 적용 버튼
    ├── PrintReport.tsx                # 인쇄 리포트 레이아웃
    └── DisclaimerBanner.tsx           # AI 면책 고지 배너
lib/
└── contract-suggest/
    ├── rag-search.ts                  # pgvector RAG 검색 함수
    ├── gpt-suggest.ts                 # GPT-4o 수정 제안 생성
    ├── docx-patcher.ts               # DOCX 조항 텍스트 교체
    ├── hwpx-patcher.ts               # HWPX 조항 텍스트 교체
    ├── pdf-extractor.ts              # PDF 텍스트 추출 (pdf-parse)
    ├── pdf-ocr.ts                    # PDF 스캔본 GPT-4o Vision OCR
    └── hwp-extractor.ts              # HWP 텍스트 추출 (node-hwp)
scripts/
└── seed-laws.ts                      # 법령 시드 데이터 삽입 스크립트
```

### 10.3 Key Architectural Decisions

| 결정 | 선택 | 근거 |
|------|------|------|
| 임베딩 모델 | text-embedding-3-small | 비용 효율 + 1536차원 pgvector 호환 |
| 벡터 DB | Supabase pgvector | 기존 인프라 재활용, 별도 벡터 DB 불필요 |
| pgvector 인덱스 | ivfflat (cosine) | 중소 규모 법령 청크에 적합 |
| 파일 파싱 | 기존 파이프라인 재활용 + 신규 모듈 분리 | 중복 코드 방지 |
| 상태 관리 | React useState + SWR | 기존 CLIO 패턴 유지 |
| PDF 재작성 | DOCX 변환 (docxtemplater) | PDF 직접 편집 라이브러리 복잡도 회피 |

---

## 11. Next Steps

1. [ ] CTO(대장)에게 계획서 검토 및 승인 요청
2. [ ] Supabase 프로젝트 pgvector 확장 활성화 여부 사전 확인
3. [ ] 설계 문서 작성 (`clio-contract-suggest.design.md`)
4. [ ] 법령 시드 텍스트 원문 수집 및 청크 분할 스크립트 준비
5. [ ] 1단계 구현 시작 (DB 마이그레이션 → 법령 시드 삽입)
6. [ ] GAP 분석 → v6.6.0 릴리스 후 v6.7.0 진입

---

## Version History

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|---------|------|
| 0.1 | 2026-04-16 | 최초 작성 | Product Manager |
