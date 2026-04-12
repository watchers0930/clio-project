# clio-contract-risk 설계서

> **요약**: 계약서 파일(DOCX/HWPX/PDF)을 업로드하면 GPT-4o가 25개 항목을 분석하여 리스크를 상/중/하로 분류하고 시각적 리포트와 DOCX 다운로드를 제공하는 기능
>
> **프로젝트**: CLIO
> **버전**: v5.3.0 (목표)
> **작성자**: 크로미 (Design Agent)
> **작성일**: 2026-04-12
> **상태**: Draft
> **계획서**: [clio-contract-risk.plan.md](../01-plan/features/clio-contract-risk.plan.md)

---

## 1. 개요

### 1-1. 기능 요약

법무팀이 없는 중소 IT 기업의 영업/PM 담당자가 계약서를 업로드하면, CLIO가 한국 IT 업계 표준 25개 분석 항목을 기준으로 GPT-4o를 통해 불리한 조항, 누락된 필수 항목, 모호한 표현을 자동 탐지하고 리스크 수준(상/중/하)별로 분류된 시각적 리포트를 제공한다. 분석 결과는 DB에 저장되어 이력 관리가 가능하며 DOCX 형식으로 다운로드할 수 있다.

### 1-2. 기술 스택

| 구분 | 기술 |
|------|------|
| 프레임워크 | Next.js 16 (App Router) |
| 언어 | TypeScript |
| 인증/DB | Supabase Auth + PostgreSQL |
| AI 엔진 | OpenAI GPT-4o (`response_format: json_object`) |
| 파일 추출 | 기존 `lib/extractors/` (DOCX/HWPX/PDF) |
| 문서 생성 | 기존 `lib/generators/docx-generator.ts` |
| UI 스타일 | Tailwind CSS (기존 CLIO 스타일 시스템 준수) |

---

## 2. 데이터베이스 설계

### 2-1. contract_risk_analyses 테이블

```sql
-- 마이그레이션 파일: supabase/migrations/011_contract_risk.sql

CREATE TABLE contract_risk_analyses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  file_name     TEXT NOT NULL,
  file_type     TEXT NOT NULL,         -- 'docx' | 'hwpx' | 'pdf'
  contract_type TEXT NOT NULL,         -- 'system' | 'maintenance' | 'software' | 'general'
  perspective   TEXT NOT NULL DEFAULT 'seller_side',  -- 'seller_side' | 'buyer_side'
  raw_text      TEXT,                  -- 추출된 원문 텍스트
  risk_result   JSONB NOT NULL,        -- RiskResult JSON (items 배열)
  risk_count    JSONB NOT NULL,        -- { high: N, medium: N, low: N }
  status        TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'processing' | 'done' | 'error'
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
```

### 2-2. RLS 정책

```sql
-- RLS 활성화
ALTER TABLE contract_risk_analyses ENABLE ROW LEVEL SECURITY;

-- 본인 데이터만 SELECT 허용
CREATE POLICY "contract_risk_select_own"
  ON contract_risk_analyses
  FOR SELECT
  USING (auth.uid() = user_id);

-- 본인 데이터만 INSERT 허용
CREATE POLICY "contract_risk_insert_own"
  ON contract_risk_analyses
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 본인 데이터만 UPDATE 허용 (status, risk_result 갱신용)
CREATE POLICY "contract_risk_update_own"
  ON contract_risk_analyses
  FOR UPDATE
  USING (auth.uid() = user_id);

-- 본인 데이터만 DELETE 허용
CREATE POLICY "contract_risk_delete_own"
  ON contract_risk_analyses
  FOR DELETE
  USING (auth.uid() = user_id);
```

### 2-3. 인덱스

```sql
-- 사용자별 이력 조회 성능
CREATE INDEX idx_contract_risk_user_id
  ON contract_risk_analyses (user_id, created_at DESC);

-- 상태별 조회 (처리 중 건 모니터링)
CREATE INDEX idx_contract_risk_status
  ON contract_risk_analyses (status)
  WHERE status IN ('pending', 'processing');

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_contract_risk_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_contract_risk_updated_at
  BEFORE UPDATE ON contract_risk_analyses
  FOR EACH ROW EXECUTE FUNCTION update_contract_risk_updated_at();
```

### 2-4. JSONB 스키마 예시

`risk_result` 컬럼에 저장되는 JSON 구조:

```json
{
  "items": [
    {
      "id": "A-02",
      "found": true,
      "risk_level": "high",
      "excerpt": "...모든 손해에 대하여 제한 없이 배상하여야 한다.",
      "explanation": "공급자의 손해배상 책임에 상한선이 없어 계약금액을 초과하는 손해배상이 청구될 수 있습니다.",
      "recommendation": "\"배상액은 계약금액을 초과하지 않는다\"는 책임한도 조항 추가를 요청하십시오."
    }
  ],
  "summary": "총 14건의 리스크 항목이 탐지되었습니다. 특히 손해배상 무제한 책임(A-02)과 지식재산권 전량 이전(A-06) 조항은 계약 체결 전 반드시 협상이 필요합니다."
}
```

`risk_count` 컬럼에 저장되는 JSON 구조:

```json
{
  "high": 3,
  "medium": 7,
  "low": 4
}
```

---

## 3. TypeScript 타입 정의

파일 위치: `lib/types/contract-risk.ts`

```typescript
// 리스크 수준
export type RiskLevel = 'high' | 'medium' | 'low';

// 분석 카테고리
export type Category = 'unfavorable' | 'missing' | 'ambiguous';

// 계약서 유형
export type ContractType = 'system' | 'maintenance' | 'software' | 'general';

// 분석 입장
export type Perspective = 'seller_side' | 'buyer_side';

// 분석 상태
export type AnalysisStatus = 'pending' | 'processing' | 'done' | 'error';

// 개별 리스크 항목
export interface RiskItem {
  id: string;           // 'A-01', 'B-03', 'C-02' 등
  found: boolean;       // 해당 리스크가 계약서에서 탐지되었는지 여부
  risk_level: RiskLevel;
  excerpt: string;      // 원문 발췌 (최대 200자, 미탐지 시 빈 문자열)
  explanation: string;  // AI 분석 설명
  recommendation: string; // 권고사항
}

// 전체 분석 결과
export interface RiskResult {
  items: RiskItem[];
  summary: string;      // 전체 요약 문장
}

// 리스크 건수 요약
export interface RiskCount {
  high: number;
  medium: number;
  low: number;
}

// DB 레코드 (contract_risk_analyses 테이블 매핑)
export interface ContractRiskAnalysis {
  id: string;
  user_id: string;
  file_name: string;
  file_type: 'docx' | 'hwpx' | 'pdf';
  contract_type: ContractType;
  perspective: Perspective;
  raw_text: string | null;
  risk_result: RiskResult;
  risk_count: RiskCount;
  status: AnalysisStatus;
  created_at: string;
  updated_at: string;
}

// 분석 항목 정의 (lib/contract-risk-items.ts 에서 사용)
export interface RiskItemDefinition {
  id: string;
  category: Category;
  name: string;
  default_risk_level: RiskLevel;
  description: string;
}

// 필터 상태
export interface RiskFilterState {
  level: RiskLevel | 'all';
  category: Category | 'all';
}
```

---

## 4. API 설계

### 4-1. 엔드포인트 목록

| 메서드 | 경로 | 설명 | 인증 | 스트리밍 |
|--------|------|------|------|---------|
| POST | `/api/contract-risk/analyze` | 파일 업로드 + GPT-4o 분석 실행 | 필수 | 없음 (폴링) |
| GET | `/api/contract-risk/history` | 분석 이력 목록 조회 | 필수 | 없음 |
| GET | `/api/contract-risk/[id]` | 분석 결과 상세 조회 | 필수 | 없음 |
| GET | `/api/contract-risk/[id]/download` | DOCX 리포트 다운로드 | 필수 | 없음 |

---

### 4-2. POST /api/contract-risk/analyze

계약서 파일을 업로드하고 GPT-4o 분석을 실행한다. 처리 시간이 길 수 있으므로 DB에 레코드를 `pending` 상태로 먼저 생성 후, 분석 완료 시 `done`으로 갱신하는 방식으로 동작한다.

**Request** (multipart/form-data):

```
file          File    계약서 파일 (DOCX/HWPX/PDF, 최대 20MB)
contract_type string  'system' | 'maintenance' | 'software' | 'general'
perspective   string  'seller_side' | 'buyer_side' (기본값: seller_side)
```

**Response (200 OK)**:

```typescript
{
  id: string;           // 생성된 분석 레코드 UUID
  status: 'done';
  risk_count: RiskCount;
  risk_result: RiskResult;
}
```

**처리 흐름**:

```
1. 인증 확인 (Supabase session)
2. 파일 유효성 검사 (확장자, 크기 20MB 이하)
3. DB에 status='pending' 레코드 INSERT
4. lib/extractors/ 호출하여 텍스트 추출
   └─ 추출 실패(스캔 PDF 등) → status='error', 400 반환
5. 텍스트 길이 확인:
   └─ 80,000 토큰 초과 시 청크 분할 (4-5항 참조)
6. GPT-4o 호출 (contract-risk-analyzer.ts)
7. 응답 JSON 파싱 → RiskResult, RiskCount 생성
8. DB 레코드 UPDATE: status='done', risk_result, risk_count
9. 클라이언트에 결과 반환
```

**에러 응답**:

```typescript
// 400: 파일 형식 오류
{ error: 'INVALID_FILE_TYPE', message: '지원하지 않는 파일 형식입니다. DOCX, HWPX, PDF만 가능합니다.' }

// 400: 텍스트 추출 실패
{ error: 'TEXT_EXTRACTION_FAILED', message: '텍스트를 추출할 수 없습니다. 스캔 이미지 PDF는 지원하지 않습니다.' }

// 413: 파일 크기 초과
{ error: 'FILE_TOO_LARGE', message: '파일 크기가 20MB를 초과합니다.' }

// 502: GPT-4o API 오류
{ error: 'AI_ANALYSIS_FAILED', message: 'AI 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }
```

---

### 4-3. GET /api/contract-risk/history

현재 사용자의 분석 이력 목록을 최신순으로 반환한다.

**Query Parameters**:

```
page    number  페이지 번호 (기본값: 1)
limit   number  페이지당 건수 (기본값: 20, 최대: 50)
```

**Response (200 OK)**:

```typescript
{
  data: Array<{
    id: string;
    file_name: string;
    file_type: string;
    contract_type: ContractType;
    perspective: Perspective;
    risk_count: RiskCount;
    status: AnalysisStatus;
    created_at: string;
  }>;
  total: number;
  page: number;
  limit: number;
}
```

**처리 흐름**:

```
1. 인증 확인
2. Supabase에서 user_id 기준 SELECT (RLS 적용)
   - raw_text, risk_result 제외 (목록에 불필요한 대용량 컬럼)
   - ORDER BY created_at DESC
   - LIMIT/OFFSET 적용
3. 결과 반환
```

---

### 4-4. GET /api/contract-risk/[id]

특정 분석 결과의 전체 상세 데이터를 반환한다.

**Response (200 OK)**:

```typescript
{
  data: ContractRiskAnalysis;  // raw_text 포함 전체 레코드
}
```

**에러 응답**:

```typescript
// 404: 존재하지 않거나 타인의 레코드
{ error: 'NOT_FOUND', message: '분석 결과를 찾을 수 없습니다.' }
```

---

### 4-5. GET /api/contract-risk/[id]/download

분석 결과를 DOCX 리포트 파일로 생성하여 다운로드 스트림으로 반환한다.

**Response**: `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

```
Content-Disposition: attachment; filename="risk-report-{id}.docx"
```

**처리 흐름**:

```
1. 인증 확인 + 레코드 조회 (RLS 적용)
2. contract-risk-report.ts 호출하여 DOCX 생성
3. Buffer를 Response로 스트리밍 반환
```

---

## 5. 컴포넌트 설계

### 5-1. 컴포넌트 목록

| 컴포넌트 | 경로 | 역할 |
|----------|------|------|
| 업로드 페이지 | `app/(main)/contract-risk/page.tsx` | 파일 업로드 + 계약서 유형/입장 선택 |
| 분석 결과 페이지 | `app/(main)/contract-risk/[id]/page.tsx` | 분석 리포트 전체 표시 |
| RiskSummary | `components/contract-risk/RiskSummary.tsx` | 리스크 건수 요약 배지 |
| RiskCard | `components/contract-risk/RiskCard.tsx` | 개별 리스크 항목 카드 |
| RiskFilter | `components/contract-risk/RiskFilter.tsx` | 수준/카테고리 필터 바 |
| AnalysisHistory | `components/contract-risk/AnalysisHistory.tsx` | 이력 목록 테이블 |

---

### 5-2. 업로드 페이지 (page.tsx)

**Props**: 없음 (Server Component + Client 하위 컴포넌트)

**주요 클라이언트 상태**:

```typescript
const [file, setFile] = useState<File | null>(null);
const [contractType, setContractType] = useState<ContractType>('system');
const [perspective, setPerspective] = useState<Perspective>('seller_side');
const [isAnalyzing, setIsAnalyzing] = useState(false);
const [error, setError] = useState<string | null>(null);
```

**사용자 흐름**:

```
파일 드래그&드롭 또는 파일 선택
  → 계약서 유형 선택 (시스템구축 / 유지보수 / 소프트웨어개발 / 범용)
  → 입장 선택 (을(공급자) / 갑(발주자)) [기본: 을]
  → "분석 시작" 버튼 클릭
  → POST /api/contract-risk/analyze 호출
  → 로딩 스피너 표시 (분석 중)
  → 완료 시 /contract-risk/[id] 로 이동
```

---

### 5-3. 분석 결과 페이지 ([id]/page.tsx)

**주요 클라이언트 상태**:

```typescript
const [filter, setFilter] = useState<RiskFilterState>({
  level: 'all',
  category: 'all',
});
```

**필터링 로직** (클라이언트 사이드):

```typescript
const filteredItems = analysis.risk_result.items.filter((item) => {
  const levelMatch = filter.level === 'all' || item.risk_level === filter.level;
  const categoryMatch =
    filter.category === 'all' || getCategoryFromId(item.id) === filter.category;
  return item.found && levelMatch && categoryMatch;
});
```

---

### 5-4. RiskSummary 컴포넌트

```typescript
interface RiskSummaryProps {
  risk_count: RiskCount;
  file_name: string;
  contract_type: ContractType;
  perspective: Perspective;
  created_at: string;
}
```

표시 예시:

```
파일명: 시스템구축계약서_ABC사.docx  |  유형: 시스템구축  |  입장: 을(공급자)  |  분석일: 2026-04-12

[🔴 상위 리스크 3건]  [🟡 중위 리스크 7건]  [🟢 하위 리스크 4건]
```

---

### 5-5. RiskCard 컴포넌트

```typescript
interface RiskCardProps {
  item: RiskItem;
  definition: RiskItemDefinition;  // lib/contract-risk-items.ts 에서 매핑
}
```

카드 구성 요소:
- 리스크 수준 배지 (🔴 상 / 🟡 중 / 🟢 하)
- 항목 ID + 항목명 (예: `A-02 손해배상 무제한 책임`)
- 카테고리 태그 (불리한 조항 / 누락 항목 / 모호한 표현)
- 원문 발췌 박스 (회색 배경, 최대 200자)
- AI 분석 설명 텍스트
- 권고사항 텍스트 (파란색 강조)
- 복사 버튼 (권고사항 클립보드 복사)

---

### 5-6. RiskFilter 컴포넌트

```typescript
interface RiskFilterProps {
  filter: RiskFilterState;
  onFilterChange: (filter: RiskFilterState) => void;
  totalCount: number;
  filteredCount: number;
}
```

필터 버튼 구성:

```
[전체 N건] [🔴 상 N건] [🟡 중 N건] [🟢 하 N건]  |  [불리한 조항] [누락 항목] [모호한 표현]
```

---

### 5-7. 분석 결과 페이지 와이어프레임 (ASCII)

```
┌─────────────────────────────────────────────────────────────────┐
│  CLIO  >  계약서 리스크 분석  >  시스템구축계약서_ABC사.docx      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  계약서 AI 리스크 분석 리포트                    [DOCX 다운로드] │
│  시스템구축계약서_ABC사_20260401.docx                            │
│  유형: 시스템구축계약서  |  입장: 을(공급자)  |  2026-04-12      │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   [🔴 상위 리스크  3건]   [🟡 중위 리스크  7건]  [🟢 하위  4건]  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  [전체 14건] [🔴 상 3건] [🟡 중 7건] [🟢 하 4건]                │
│  [불리한 조항] [누락 항목] [모호한 표현]                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🔴 상  |  A-02  손해배상 무제한 책임  |  [불리한 조항]           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ "...모든 손해에 대하여 제한 없이 배상하여야 한다."       │   │
│  └─────────────────────────────────────────────────────────┘   │
│  [AI 분석] 공급자의 손해배상 책임에 상한선이 없어...            │
│  [권고사항] "배상액은 계약금액을 초과하지 않는다"는...   [복사] │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🔴 상  |  B-01  계약 목적물 명세 누락  |  [누락 항목]           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ (해당 조항 발견되지 않음)                                │   │
│  └─────────────────────────────────────────────────────────┘   │
│  [AI 분석] 계약 목적물(시스템 범위)이 명시되지 않아...          │
│  [권고사항] 별첨 또는 본문에 구현 범위 명세를 추가...    [복사] │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ... (추가 항목)                                                │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  ⚠ 이 분석은 AI가 생성한 참고 자료이며 법적 조언이 아닙니다.    │
│     최종 계약 체결 전 법률 전문가 검토를 권장합니다.            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. AI 프롬프트 설계

### 6-1. System Prompt

```
당신은 한국 IT 업계 계약서 검토를 전문으로 하는 법률 분석 AI입니다.
소프트웨어 개발, 시스템구축, 유지보수 계약 분야의 한국 법률 관행과 공정거래위원회 표준 계약서 기준을 깊이 이해하고 있습니다.

당신의 역할:
- 제공된 계약서 원문을 아래 25개 분석 항목 기준으로 검토합니다.
- 각 항목에 대해 계약서에서 해당 조항을 탐지하고 리스크를 평가합니다.
- 반드시 JSON 형식으로만 응답합니다.

분석 항목 정의:
[카테고리 A — 불리한 조항 탐지]
A-01: 일방적 계약 해지권 (발주자만 보유) [기본 리스크: medium]
A-02: 손해배상 무제한 책임 조항 [기본 리스크: high]
A-03: 지체상금률 과다 (일반 0.1% 초과) [기본 리스크: medium]
A-04: 납기 불명확 또는 일방적 변경 허용 [기본 리스크: medium]
A-05: 대금 지급 기한 과도 (60일 초과) [기본 리스크: medium]
A-06: 개발 결과물 지식재산권 전량 발주자 이전 [기본 리스크: high]
A-07: 재하도급 금지 + 페널티 과다 [기본 리스크: medium]
A-08: 비밀유지 기간 무제한 또는 과도 [기본 리스크: low]
A-09: 분쟁 관할 법원 발주자 소재지 일방 지정 [기본 리스크: low]
A-10: 유지보수 범위 과도하게 광범위 정의 [기본 리스크: medium]

[카테고리 B — 필수 조항 누락 탐지]
B-01: 계약 목적물(시스템 범위) 명세 누락 [기본 리스크: high]
B-02: 납기/완료 기준 정의 누락 [기본 리스크: high]
B-03: 검수 기준 및 기간 미정의 [기본 리스크: medium]
B-04: 대금 지급 조건 및 시기 미정의 [기본 리스크: high]
B-05: 하자담보책임 기간 미정의 [기본 리스크: medium]
B-06: 변경관리(추가개발) 절차 미정의 [기본 리스크: medium]
B-07: 개인정보 처리 위탁 조항 누락 [기본 리스크: medium]
B-08: 계약 해지 절차 및 귀책 사유 미정의 [기본 리스크: medium]
B-09: 지식재산권 귀속 조항 누락 [기본 리스크: high]
B-10: 보안/기밀유지 의무 조항 누락 [기본 리스크: low]

[카테고리 C — 모호한 표현 탐지]
C-01: 정량화되지 않은 의무 표현 ("성실히 이행") [기본 리스크: low]
C-02: "협의하여 결정" 협의 불발 처리 기준 없음 [기본 리스크: medium]
C-03: 완료 기준이 주관적으로 정의된 경우 [기본 리스크: medium]
C-04: 금액/기간이 미첨부 별도 문서 참조 [기본 리스크: high]
C-05: 적용 법률/버전 미정의 기술 명세 참조 [기본 리스크: low]

응답 형식 (JSON only):
{
  "items": [
    {
      "id": "항목ID",
      "found": true/false,
      "risk_level": "high"/"medium"/"low",
      "excerpt": "원문 발췌 최대 200자 (미탐지 시 빈 문자열)",
      "explanation": "왜 리스크인지 2-3문장 설명",
      "recommendation": "협상 또는 수정 방향 1-2문장"
    }
  ],
  "summary": "전체 분석 요약 2-3문장"
}

중요 지침:
- found=false인 경우에도 항목을 반드시 포함합니다.
- 기본 리스크 수준은 계약서 실제 내용에 따라 조정 가능합니다.
- excerpt는 계약서 원문에서 직접 발췌합니다. 조항이 없으면 빈 문자열("")로 합니다.
- 법적 조언이 아닌 참고 분석임을 인지하고 과도한 단정 표현을 피합니다.
```

### 6-2. User Prompt 구조

```typescript
const userPrompt = `
계약서 유형: ${contractTypeLabel[contractType]}
검토 입장: ${perspectiveLabel[perspective]}

[계약서 원문]
${contractText}

위 계약서를 25개 분석 항목 기준으로 검토하고 JSON 형식으로 결과를 반환하세요.
`;
```

### 6-3. OpenAI 호출 옵션

```typescript
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ],
  response_format: { type: 'json_object' },
  temperature: 0.2,   // 낮은 온도로 일관된 분석 결과 유도
  max_tokens: 8000,   // 25개 항목 응답에 충분한 토큰
});
```

### 6-4. 긴 계약서 청크 분할 전략

계약서 텍스트가 약 60,000자(~20,000 토큰) 초과 시 청크 분할 분석을 적용한다.

```
전체 분석 항목을 두 그룹으로 분리:
  - 청크 1: 카테고리 A (A-01~A-10) + 카테고리 B (B-01~B-05)
  - 청크 2: 카테고리 B (B-06~B-10) + 카테고리 C (C-01~C-05)

각 청크에서 전체 계약서 텍스트를 분석하되, 해당 청크의 항목만 응답 요청

병렬 처리:
  Promise.all([analyzeChunk1(), analyzeChunk2()])

결과 병합:
  items 배열을 합치고, summary는 두 번째 호출에서 전체 기준으로 생성
```

계약서 최대 처리 기준:

| 분류 | 기준 | 처리 방식 |
|------|------|-----------|
| 일반 | 60,000자 이하 | 단일 호출 |
| 대형 | 60,000~160,000자 | 2청크 병렬 호출 |
| 초과 | 160,000자 초과 | 앞 160,000자만 처리 + 안내 메시지 |

---

## 7. DOCX 리포트 생성

### 7-1. 기존 docx-generator.ts 활용

`lib/generators/docx-generator.ts`의 기존 인터페이스를 확장하여 `ContractRiskReport` 타입을 추가한다.

파일 위치: `lib/services/contract-risk-report.ts`

```typescript
import { generateDocx } from '@/lib/generators/docx-generator';
import type { ContractRiskAnalysis } from '@/lib/types/contract-risk';

export async function generateRiskReportDocx(
  analysis: ContractRiskAnalysis
): Promise<Buffer> {
  const sections = buildReportSections(analysis);
  return generateDocx(sections);
}
```

### 7-2. 리포트 섹션 구성

```
[표지]
- 제목: 계약서 AI 리스크 분석 리포트
- 파일명: {file_name}
- 계약서 유형: {contract_type}
- 검토 입장: {perspective}
- 분석 일시: {created_at}
- CLIO AI 분석 시스템

[요약 섹션]
- 리스크 수준별 건수 표 (상/중/하)
- 전체 요약 문장 (risk_result.summary)

[상세 섹션 — 카테고리 A: 불리한 조항]
각 found=true 항목에 대해:
  - 항목 ID + 항목명 + 리스크 수준
  - 원문 발췌 (회색 배경 박스)
  - AI 분석 설명
  - 권고사항

[상세 섹션 — 카테고리 B: 누락 항목]
동일 구성

[상세 섹션 — 카테고리 C: 모호한 표현]
동일 구성

[면책 문구]
"본 리포트는 AI가 생성한 참고 자료이며 법적 조언이 아닙니다.
계약 체결 전 반드시 법률 전문가의 검토를 받으시기 바랍니다.
CLIO AI 분석 시스템은 분석 결과의 정확성에 대해 보증하지 않습니다."
```

---

## 8. 구현 순서 (Phase별 체크리스트)

### Phase 1 — 백엔드 기반 (예상: 1일)

- [ ] `supabase/migrations/011_contract_risk.sql` 작성 및 마이그레이션 실행
  - `contract_risk_analyses` 테이블 생성
  - RLS 정책 4개 적용
  - 인덱스 2개 + 트리거 1개 생성
- [ ] `lib/types/contract-risk.ts` — 타입 정의 파일 생성
- [ ] `lib/contract-risk-items.ts` — 25개 분석 항목 상수 정의 (A/B/C 카테고리)
- [ ] `lib/services/contract-risk-analyzer.ts` — GPT-4o 프롬프트 + 분석 로직
  - System prompt 구현
  - User prompt 생성 함수
  - 청크 분할 전략 구현
  - OpenAI 호출 + 응답 파싱
- [ ] `app/api/contract-risk/analyze/route.ts` — 분석 실행 API
  - 파일 업로드 처리 (FormData)
  - 텍스트 추출 (기존 lib/extractors/ 호출)
  - DB INSERT/UPDATE
  - 에러 처리 (스캔 PDF, GPT-4o 실패 등)
- [ ] 샘플 계약서 3건으로 GPT-4o 프롬프트 검증

### Phase 2 — 추가 API (예상: 0.5일)

- [ ] `app/api/contract-risk/history/route.ts` — 이력 목록 API
  - Supabase SELECT (RLS 적용)
  - 페이지네이션
- [ ] `app/api/contract-risk/[id]/route.ts` — 상세 조회 API
  - 404 처리 (타인 레코드 접근 방지)
- [ ] `lib/services/contract-risk-report.ts` — DOCX 리포트 생성 서비스
- [ ] `app/api/contract-risk/[id]/download/route.ts` — DOCX 다운로드 API
- [ ] 스캔 PDF 감지 시 안내 메시지 처리

### Phase 3 — UI 구현 (예상: 1.5일)

- [ ] `lib/types/contract-risk.ts` 내 유틸 함수 추가
  - `getCategoryFromId(id: string): Category`
  - `getRiskLevelLabel(level: RiskLevel): string`
  - `getContractTypeLabel(type: ContractType): string`
- [ ] `components/contract-risk/RiskSummary.tsx` 구현
- [ ] `components/contract-risk/RiskCard.tsx` 구현
  - 원문 발췌 박스
  - 복사 버튼 (Clipboard API)
- [ ] `components/contract-risk/RiskFilter.tsx` 구현
  - 필터 상태 관리
  - 건수 뱃지 표시
- [ ] `components/contract-risk/AnalysisHistory.tsx` 구현
  - 이력 목록 테이블
  - 날짜/유형/리스크 건수 컬럼
- [ ] `app/(main)/contract-risk/page.tsx` — 업로드 페이지 구현
  - 기존 `components/ui/file-upload.tsx` 재사용
  - 계약서 유형 선택 라디오/셀렉트
  - 입장 선택 토글
  - 분석 중 로딩 스피너
- [ ] `app/(main)/contract-risk/[id]/page.tsx` — 결과 리포트 페이지 구현
  - Server Component로 데이터 로드
  - RiskSummary + RiskFilter + RiskCard 목록 조립
  - DOCX 다운로드 버튼
  - 면책 문구 푸터
- [ ] CLIO 사이드바/메뉴에 "계약서 리스크 분석" 메뉴 항목 추가

### Phase 4 — 검증 (예상: 0.5일)

- [ ] 샘플 계약서 5건 (시스템구축 3건, 유지보수 2건) 정확도 테스트
  - 수동 리뷰 결과와 AI 분석 결과 비교
  - 탐지율 80% 이상 확인, 미달 시 프롬프트 튜닝
- [ ] 성능 측정: A4 10페이지 기준 30초 이내 완료 확인
- [ ] A4 30페이지 계약서 청크 분할 처리 검증
- [ ] 스캔 PDF 업로드 시 오류 안내 UI 확인
- [ ] DOCX 다운로드 정상 동작 확인
- [ ] 기존 CLIO 기능 회귀 테스트 (문서관리, 전자서명 등)

---

## 9. 보안 고려사항

| 항목 | 처리 방식 |
|------|-----------|
| 계약서 원문 접근 | RLS로 본인 레코드만 조회 가능 |
| OpenAI 데이터 전송 | 계약서 텍스트를 OpenAI API로 전송 — 서비스 이용 전 사용자 동의 필요 |
| 파일 저장 | 파일 자체는 저장하지 않음 (텍스트 추출 후 메모리에서 처리) |
| raw_text 보안 | 민감 정보 포함 가능 — 추후 암호화 저장 검토 (현재는 평문) |
| API 인증 | 모든 API 엔드포인트 Supabase 세션 인증 필수 |
| 입력값 검증 | 파일 확장자, 크기, MIME 타입 서버 측 재검증 |

---

## 10. 에러 처리 전략

```typescript
// 공통 에러 응답 형식
interface ApiError {
  error: string;   // 에러 코드 (대문자 스네이크)
  message: string; // 사용자 표시용 한글 메시지
}
```

| 시나리오 | HTTP | 에러 코드 | 사용자 메시지 |
|----------|------|-----------|---------------|
| 미인증 요청 | 401 | UNAUTHORIZED | 로그인이 필요합니다. |
| 지원하지 않는 파일 형식 | 400 | INVALID_FILE_TYPE | DOCX, HWPX, PDF 파일만 분석 가능합니다. |
| 파일 크기 초과 | 413 | FILE_TOO_LARGE | 파일 크기가 20MB를 초과합니다. |
| 스캔 PDF (텍스트 추출 불가) | 400 | TEXT_EXTRACTION_FAILED | 이미지 스캔 PDF는 지원하지 않습니다. 텍스트 기반 PDF를 사용해주세요. |
| GPT-4o API 실패 | 502 | AI_ANALYSIS_FAILED | AI 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요. |
| 분석 결과 없음 | 404 | NOT_FOUND | 분석 결과를 찾을 수 없습니다. |

---

## 11. 레이어 구조 (Clean Architecture)

| 컴포넌트 | 레이어 | 경로 |
|----------|--------|------|
| RiskSummary, RiskCard, RiskFilter | Presentation | `components/contract-risk/` |
| page.tsx (업로드), [id]/page.tsx | Presentation | `app/(main)/contract-risk/` |
| contract-risk-analyzer.ts | Application | `lib/services/` |
| contract-risk-report.ts | Application | `lib/services/` |
| RiskItem, RiskResult, ContractRiskAnalysis | Domain | `lib/types/contract-risk.ts` |
| contract-risk-items.ts | Domain | `lib/` |
| route.ts (API 라우트들) | Infrastructure | `app/api/contract-risk/` |
| Supabase 클라이언트 | Infrastructure | `lib/supabase.ts` (기존) |
| openai.ts | Infrastructure | `lib/openai.ts` (기존) |

---

## 12. 관련 문서

- 계획서: [clio-contract-risk.plan.md](../01-plan/features/clio-contract-risk.plan.md)
- 기존 계약서 필드 참조: `lib/contract-fields.ts`
- 기존 계약서 렌더러: `lib/contract-renderer.ts`
- 파일 추출 파이프라인: `lib/extractors/`
- DOCX 생성기: `lib/generators/docx-generator.ts`

---

## 버전 이력

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 0.1 | 2026-04-12 | 최초 작성 | 크로미 (Design Agent) |
