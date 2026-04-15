# 법령 기반 계약 조항 수정 제안 (legal-contract-fix) 계획서

> **Summary**: 기존 리스크 분석 결과의 위험 조항을 국가법령정보공단 OpenAPI로 조회한 법령에 근거해 AI가 수정 문구를 제안하고, 사용자가 인라인으로 채택·편집·거부할 수 있게 한다.
>
> **Project**: CLIO
> **Version**: v6.5.0 (타겟)
> **Author**: Product Manager
> **Date**: 2026-04-15
> **Status**: Draft

---

## 1. 맥락기술서 (Context)

### 1.1 기존 기능과의 연결 관계

CLIO는 현재 아래 계약서 처리 파이프라인을 보유하고 있다.

```
[계약서 입력폼]
 contract-fields.ts / 시스템구축계약서 스키마
        ↓
[계약서 직접 치환 렌더러]
 contract-renderer.ts (indexOf 기반)
        ↓
[계약서 리스크 분석] ← 현재 종착점
 API: /api/contract-risk/analyze
 API: /api/contract-risk/[id]
 DB:  contract_risk_analyses
 페이지: /contract-risk, /contract-risk/[id]
 - 25개 항목 A(고위험)/B(중위험)/C(저위험) 카테고리
 - GPT-4o 분석, DOCX 리포트 다운로드
        ↓
[법령 기반 조항 수정 제안] ← 이번 신규 기능 (v6.5.0)
 기존 분석 결과를 입력으로 받아 법적 근거 있는 수정안 생성
```

이번 기능은 분석 결과에서 끝나던 흐름을 "수정 → 재다운로드"까지 연장하는 **파이프라인 완성 단계**다.

### 1.2 배경 및 목적

기존 리스크 분석은 위험 조항을 식별하고 설명하는 데 그쳤다. 사용자가 실제로 조항을 어떻게 고쳐야 하는지는 알려주지 않는다. 본 기능은 국가법령정보공단 OpenAPI를 통해 법적 근거를 제시하고, AI가 법에 부합하는 수정 문구를 생성함으로써 계약 실무 담당자의 수작업 부담을 줄인다.

### 1.3 관련 문서

- 리스크 분석 계획서: `docs/01-plan/features/clio-contract-risk.plan.md`
- 기술스택: Next.js 16 + TypeScript + Tailwind CSS + Supabase + OpenAI GPT-4o

---

## 2. 범위 (Scope)

### 2.1 포함 범위

- [ ] 국가법령정보공단 OpenAPI 연동 (`/api/legal-search`)
- [ ] 위험 조항별 관련 법령 자동 검색 (키워드 기반)
- [ ] GPT-4o를 이용한 법령 참조 수정 문구 생성 (`/api/contract-fix/suggest`)
- [ ] 수정 제안 수락(accepted) / 직접편집(modified) / 거부(rejected) 인라인 UI
- [ ] 수정 이력 DB 저장 (`contract_clause_fixes` 테이블)
- [ ] 최종 수정된 계약서 DOCX/HWPX 재다운로드
- [ ] 법령 면책조항(Disclaimer) UI 필수 표시
- [ ] 기존 `/contract-risk/[id]` 페이지에 "조항 수정 제안" 진입점 추가

### 2.2 제외 범위

- 법령 데이터 자체 DB 저장 (법령은 API 실시간 조회만 사용)
- 법률 자문 또는 법적 책임 보장 기능 (AI 제안은 참고용임을 명시)
- HWPX 자체 파싱 엔진 신규 개발 (기존 DOCX 흐름 재활용)
- 새로운 계약서 유형 스키마 추가 (기존 스키마 범위 내 동작)

---

## 3. 기능 상세 설계

### 3.1 핵심 흐름 (User Flow)

```
1. /contract-risk/[id] 페이지 접근
2. "조항 수정 제안" 버튼 클릭
        ↓
3. HIGH/MEDIUM 위험 조항 목록 표시 (ClauseFixModal 오픈)
        ↓
4. 조항 선택 → 국가법령정보공단 API 키워드 검색
        ↓
5. 관련 법령 조문 표시 (법령명, 조문번호, 시행일)
        ↓
6. [수정 제안 생성] 클릭
   → GPT-4o: [원문 조항 + 법령 조문] → 수정 제안 텍스트 생성
        ↓
7. 사용자 선택:
   ┌─ [수락] → status: accepted, final_text = suggested_fix
   ├─ [편집 후 수락] → status: modified, final_text = 사용자 입력
   └─ [거부] → status: rejected
        ↓
8. 전체 조항 처리 완료 후 [계약서 재생성] 클릭
   → final_text 반영된 DOCX/HWPX 재다운로드
```

### 3.2 API 설계

#### 3.2.1 법령 검색

```
GET /api/legal-search?keyword={키워드}&display=10
```

| 항목 | 내용 |
|------|------|
| 외부 API | `https://www.law.go.kr/DRF/lawSearch.do` |
| 인증 | 국가법령정보공단 API 키 (서버사이드 환경변수) |
| 응답 | 법령명, 조문번호, 조문내용, 시행일 (JSON 변환) |
| 캐시 | 동일 키워드 5분 인메모리 캐시 (중복 호출 방지) |

**Response 예시**:
```json
{
  "laws": [
    {
      "lawName": "하도급거래 공정화에 관한 법률",
      "articleNo": "제13조",
      "content": "원사업자는 목적물 등의 수령일부터 60일 이내...",
      "enforcedDate": "2023-07-04"
    }
  ]
}
```

#### 3.2.2 수정 제안 생성

```
POST /api/contract-fix/suggest
```

**Request Body**:
```json
{
  "analysisId": "uuid",
  "clauseText": "원문 조항 내용",
  "lawReferences": [
    {
      "lawName": "...",
      "articleNo": "...",
      "content": "..."
    }
  ]
}
```

**Response**:
```json
{
  "fixId": "uuid",
  "suggestedFix": "AI 생성 수정 문구",
  "reasoning": "수정 이유 설명 (법령 근거 포함)"
}
```

#### 3.2.3 수정 결과 저장

```
PATCH /api/contract-fix/[fixId]
```

**Request Body**:
```json
{
  "status": "accepted | modified | rejected",
  "finalText": "최종 채택 문구 (accepted/modified 시)"
}
```

#### 3.2.4 계약서 재생성

```
POST /api/contract-fix/regenerate
```

**Request Body**:
```json
{
  "analysisId": "uuid"
}
```

**Response**: DOCX/HWPX 파일 스트림 (기존 DOCX 생성 로직 재활용)

### 3.3 DB 스키마

#### 신규 테이블: `contract_clause_fixes`

```sql
CREATE TABLE contract_clause_fixes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id     UUID NOT NULL REFERENCES contract_risk_analyses(id) ON DELETE CASCADE,
  clause_text     TEXT NOT NULL,              -- 원문 조항
  law_references  JSONB DEFAULT '[]',         -- 참조 법령 배열
  suggested_fix   TEXT,                       -- AI 수정 제안
  reasoning       TEXT,                       -- 수정 이유 (법령 근거)
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','accepted','rejected','modified')),
  final_text      TEXT,                       -- 최종 채택 문구
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- RLS: 본인 분석 건만 접근 가능
ALTER TABLE contract_clause_fixes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contract_clause_fixes_owner_only"
  ON contract_clause_fixes
  USING (
    analysis_id IN (
      SELECT id FROM contract_risk_analyses
      WHERE user_id = auth.uid()
    )
  );

CREATE INDEX idx_clause_fixes_analysis_id ON contract_clause_fixes(analysis_id);
```

### 3.4 UI 구성

#### 진입점
- `/contract-risk/[id]` 페이지 우측 상단 또는 위험 조항 목록 헤더에 "조항 수정 제안" 버튼 추가
- 버튼 노출 조건: HIGH 또는 MEDIUM 위험 조항이 1개 이상 존재할 때

#### ClauseFixModal 구성

```
┌─────────────────────────────────────────────────────┐
│ 조항 수정 제안                              [X 닫기] │
├─────────────────────────────────────────────────────┤
│ 위험 조항 목록 (HIGH: 3건 / MEDIUM: 5건)            │
│ ┌──────────────────────────────────────────────────┐ │
│ │ [HIGH] 제10조 지체상금 조항              [선택 ▼]│ │
│ └──────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────┤
│ 원문                                                 │
│ "지체 1일당 계약금액의 1/1000을 징수한다."           │
├─────────────────────────────────────────────────────┤
│ 관련 법령                         [법령 재검색]      │
│ • 하도급거래 공정화에 관한 법률 제13조               │
│   "원사업자는 목적물 등의 수령일부터 60일 이내..."   │
│   (시행: 2023-07-04)                                 │
├─────────────────────────────────────────────────────┤
│ AI 수정 제안                      [제안 재생성]      │
│ ┌──────────────────────────────────────────────────┐ │
│ │ "지체 1일당 계약금액의 1/1000을 징수하되,        │ │
│ │  총 지체상금은 계약금액의 10%를 초과할 수 없다." │ │
│ └──────────────────────────────────────────────────┘ │
│ 근거: 하도급법 제13조에 따라 상한 규정 추가 필요     │
├─────────────────────────────────────────────────────┤
│ ⚠ 이 제안은 법적 자문을 대체하지 않습니다.          │
│   실제 계약 체결 전 전문 법률가의 검토를 받으세요.  │
├─────────────────────────────────────────────────────┤
│ [수락]     [편집 후 수락]     [이 조항 건너뛰기]    │
└─────────────────────────────────────────────────────┘
```

#### 재다운로드
- 모든 조항 처리 완료 후 하단에 "수정된 계약서 다운로드 (DOCX)" 버튼 활성화
- final_text가 accepted/modified인 조항만 반영; rejected는 원문 유지

---

## 4. 우선순위 (MoSCoW)

| 우선순위 | 항목 | 비고 |
|----------|------|------|
| **P0 (Must)** | 국가법령정보공단 API 연동 | 핵심 차별화 요소 |
| **P0 (Must)** | GPT-4o 수정 제안 생성 | 메인 기능 |
| **P0 (Must)** | ClauseFixModal UI (선택 → 법령 → 제안 흐름) | 사용자 경험 핵심 |
| **P0 (Must)** | `contract_clause_fixes` DB 저장 | 이력 관리 필수 |
| **P0 (Must)** | 법령 면책조항 UI 표시 | 법적 리스크 관리 |
| **P1 (Should)** | DOCX 재다운로드 (수정 반영) | 실무 활용 완성 |
| **P1 (Should)** | 법령 키워드 자동 추출 (조항 텍스트에서) | UX 개선 |
| **P1 (Should)** | 수정 제안 재생성 버튼 | 사용자 제어권 |
| **P2 (Could)** | HWPX 재다운로드 지원 | 국내 공공기관 대응 |
| **P2 (Could)** | 수정 이력 타임라인 뷰 | 감사 추적 |
| **Won't (v6.5)** | 실시간 법령 개정 알림 | 다음 버전 검토 |
| **Won't (v6.5)** | 법률 자문사 연결 서비스 | 파트너십 필요, 별도 기획 |

---

## 5. 검증 계획 (GAP 분석 체크리스트)

### 5.1 기능 검증 항목

| 항목 | 검증 방법 | 합격 기준 |
|------|----------|----------|
| 법령 API 연동 | 실제 키워드로 검색 결과 반환 확인 | 응답 200, laws 배열 1건 이상 |
| GPT-4o 제안 생성 | 원문+법령 입력 시 제안 텍스트 반환 | 500자 이내, 법령 근거 포함 |
| status 전환 | accepted/modified/rejected 각각 저장 확인 | DB 컬럼 정합성 |
| DOCX 재생성 | final_text 반영 여부 확인 | 원문 vs 수정본 diff 존재 |
| RLS 정책 | 타 사용자 analysis_id로 접근 시 차단 | 403 반환 |
| 면책조항 표시 | 모달 내 항상 노출 | DOM 요소 존재 확인 |

### 5.2 비기능 검증 항목

| 항목 | 기준 |
|------|------|
| 법령 API 응답 시간 | 3초 이내 (타임아웃 설정 필수) |
| GPT-4o 응답 시간 | 10초 이내 (스트리밍 고려) |
| 법령 API 오류 시 폴백 | 오류 메시지 표시 후 수동 법령 입력 가능 |
| 동시 요청 처리 | 동일 analysis_id에 중복 요청 시 debounce |

### 5.3 GAP 분석 ★ 등급 기준

| 등급 | 조건 | 조치 |
|------|------|------|
| ★★★ 긴급 | P0 항목 미구현 | 즉시 수정 후 재검증 |
| ★★ 중요 | P1 항목 미구현 또는 면책조항 누락 | 배포 전 해결 |
| ★ 권고 | P2 항목 미구현, UX 개선 사항 | 다음 이터레이션 |

---

## 6. 버전 계획

| 버전 | 내용 | 기준 |
|------|------|------|
| **v6.4.0** | 현재 (댓글 반영 고도화) | 배포 완료 |
| **v6.5.0** | 법령 기반 계약 조항 수정 제안 | 본 계획서 전체 범위 (P0+P1) |
| v6.5.x | 버그 수정 | 소수점 둘째 자리 |
| v6.6.0 | P2 항목 (HWPX, 이력 타임라인 등) | 별도 계획서 |

---

## 7. 구현 시 주의사항

### 7.1 법령 API 키 관리

- 국가법령정보공단 API 키는 **서버사이드 환경변수**로만 관리 (`LAW_API_KEY`)
- 클라이언트에 절대 노출 금지 (`NEXT_PUBLIC_` 접두어 사용 불가)
- `.env.local` 및 Vercel 환경변수에 등록 필요
- API 키 발급: https://www.law.go.kr/LSW/openApi/openApiInfo.do (무료, 회원가입 필요)
- 일일 호출 한도 확인 후 캐시 전략 설계

### 7.2 법령 정보 면책조항 필수 표시

모든 법령 조회 결과 및 AI 수정 제안 UI에 아래 문구를 반드시 표시해야 한다.

```
⚠ 이 수정 제안은 AI와 국가법령정보공단 데이터를 기반으로 한 참고 자료입니다.
  법적 효력을 보장하지 않으며, 실제 계약 체결 전 반드시 전문 법률가의 검토를 받으세요.
  법령은 개정될 수 있으며, 최신 법령은 국가법령정보센터(law.go.kr)에서 확인하세요.
```

- 이 문구는 ClauseFixModal 하단 고정 영역에 항상 표시 (스크롤해도 숨겨지지 않아야 함)
- DOCX 재다운로드 파일 내 첫 페이지 또는 말미에도 동일 면책조항 삽입

### 7.3 기존 코드와의 충돌 방지

- `contract-renderer.ts` (indexOf 기반 치환)는 변경하지 않음. 재생성 로직은 별도 `contract-regenerator.ts` 파일로 분리
- `contract_risk_analyses` 테이블 스키마 변경 금지. FK만 추가 (신규 테이블 생성)
- `/contract-risk/[id]` 페이지에 버튼 추가 시 기존 레이아웃 깨지지 않도록 조건부 렌더링

### 7.4 GPT-4o 프롬프트 설계 원칙

- 역할 지정: "당신은 대한민국 법률 전문가이며, 계약서 검토 보조 AI입니다."
- 출력 형식: 수정 문구(plain text) + 수정 이유(법령 근거 포함) 분리 응답
- 환각(Hallucination) 방지: 제공된 법령 조문만 근거로 사용하도록 명시 ("제공된 법령 외의 정보를 근거로 삼지 마세요")
- 토큰 제한: 수정 문구 500자, 이유 200자 이내 제한

### 7.5 전체 흐름 검증 (API → DB → RLS)

구현 전 반드시 아래 흐름 확인:

```
프론트 (ClauseFixModal)
  → /api/legal-search (서버: LAW_API_KEY 사용)
  → /api/contract-fix/suggest (서버: OpenAI API 키 사용)
  → Supabase (contract_clause_fixes 테이블 INSERT)
     → RLS: auth.uid() == contract_risk_analyses.user_id 확인
  → /api/contract-fix/regenerate
     → contract_clause_fixes SELECT (RLS 통과)
     → DOCX 재생성 (final_text 반영)
```

---

## 8. 아키텍처 고려사항

### 8.1 프로젝트 레벨

**Dynamic** 레벨 유지 (기존 CLIO 구조 준수)

### 8.2 신규 파일/폴더 구조

```
src/
├── app/
│   ├── api/
│   │   ├── legal-search/
│   │   │   └── route.ts              # 국가법령정보공단 API 프록시
│   │   └── contract-fix/
│   │       ├── suggest/route.ts      # GPT-4o 수정 제안 생성
│   │       ├── [fixId]/route.ts      # 수정 결과 저장 (PATCH)
│   │       └── regenerate/route.ts   # 계약서 재생성
│   └── contract-risk/
│       └── [id]/
│           └── page.tsx              # 기존 파일 — "조항 수정 제안" 버튼 추가
├── components/
│   └── contract-fix/
│       ├── ClauseFixModal.tsx        # 메인 모달
│       ├── LawSearchResult.tsx       # 법령 검색 결과 표시
│       ├── ClauseSuggestion.tsx      # AI 수정 제안 + 수락/편집/거부 UI
│       └── LegalDisclaimer.tsx       # 면책조항 고정 영역
└── lib/
    ├── law-api.ts                    # 국가법령정보공단 API 클라이언트
    └── contract-regenerator.ts       # 수정 반영 DOCX 재생성 로직
```

### 8.3 환경변수

| 변수명 | 목적 | 범위 |
|--------|------|------|
| `LAW_API_KEY` | 국가법령정보공단 OpenAPI 인증 키 | 서버 전용 |
| `OPENAI_API_KEY` | GPT-4o 호출 (기존 변수 재사용) | 서버 전용 |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL (기존 재사용) | 클라이언트 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 서버사이드 RLS 우회 (재생성 시) | 서버 전용 |

---

## 9. 성공 기준 (Definition of Done)

- [ ] P0 기능 전체 구현 및 동작 확인
- [ ] `contract_clause_fixes` 테이블 생성 및 RLS 적용
- [ ] 법령 면책조항 모달 내 항상 표시 확인
- [ ] DOCX 재다운로드 시 수락된 조항 반영 확인
- [ ] 타 사용자 데이터 접근 차단 (RLS 테스트)
- [ ] 법령 API 오류 시 폴백 동작 확인
- [ ] GAP 분석 ★★ 이상 항목 0건
- [ ] v6.5.0 버전 태깅 및 배포

---

## 10. 다음 단계

1. [ ] 국가법령정보공단 API 키 발급 (대장 직접 진행 필요)
2. [ ] 설계 문서 작성 (`clio-legal-contract-fix.design.md`)
3. [ ] CTO(팀장) 계획서 승인
4. [ ] 구현 시작 (`/pdca do clio-legal-contract-fix`)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-15 | Initial draft | Product Manager |
