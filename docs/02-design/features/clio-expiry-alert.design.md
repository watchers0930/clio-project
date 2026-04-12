# CLIO 계약/문서 만료일 자동 알림 설계서

> **요약**: 앱 진입 시 D-30 이내 만료 문서를 모달 팝업으로 즉시 알려주는 기능의 기술 설계
>
> **프로젝트**: CLIO (RAG 기반 AI 문서관리 시스템)
> **버전**: v5.3.0
> **작성일**: 2026-04-12
> **최종 수정**: 2026-04-12
> **상태**: Draft
> **계획서**: [clio-expiry-alert.plan.md](../01-plan/features/clio-expiry-alert.plan.md)

---

## 1. 개요

### 1.1 기능 요약

파일 업로드 시 GPT-4o가 문서 텍스트에서 만료일을 자동 추출하여 `schedules` 테이블에 등록하고,
앱 진입 시마다 D-30 이내 만료 문서가 있으면 **ExpiryAlertModal** 팝업을 표시한다.

**핵심 설계 원칙 — 모달 팝업 방식**:
- 이메일, cron job, Edge Function, notifications 테이블 없음
- 외부 알림 서비스 의존도 제로 (순수 클라이언트 사이드)
- 앱 진입 시 `/api/dashboard/expiry-summary` 한 번의 API 호출로 모달과 위젯 모두 처리
- "오늘 다시 보지 않기" 상태는 localStorage에서만 관리

### 1.2 기술 스택

| 영역 | 기술 |
|------|------|
| 프레임워크 | Next.js 16 (App Router) |
| 언어 | TypeScript |
| 백엔드/DB | Supabase (PostgreSQL + RLS) |
| AI | GPT-4o (OpenAI API) |
| 상태 관리 | React Context (ExpiryAlertProvider) |
| 클라이언트 상태 | localStorage |
| UI 컴포넌트 | 기존 CLIO UI 시스템 |

### 1.3 아키텍처 다이어그램

```
앱 진입 (메인 레이아웃 마운트)
        │
        ▼
ExpiryAlertProvider (Context)
        │
        ├─ localStorage 확인
        │   expiry_modal_suppressed_date === 오늘?
        │   YES → 모달 표시 안 함 (종료)
        │   NO  ↓
        │
        ├─ GET /api/dashboard/expiry-summary
        │   ┌──────────────────────────────┐
        │   │ Supabase                     │
        │   │ schedules 테이블             │
        │   │ WHERE source_type =          │
        │   │   'document_expiry'          │
        │   │ AND end_date <= today+30     │
        │   │ AND end_date >= today        │
        │   │ RLS: user_id = auth.uid()    │
        │   └──────────────────────────────┘
        │
        ├─ 결과 있음 → ExpiryAlertModal 표시
        │   └─ "오늘 다시 보지 않기" 클릭
        │       → localStorage 저장 → 모달 닫기
        │
        └─ ExpiryDashboardWidget (대시보드)
            └─ 동일 API 응답 재사용

파일 업로드 파이프라인 (비동기 후처리)
        파일 업로드
        → 텍스트 추출
        → 청킹 & 임베딩
        → [만료일 추출] POST /api/files/[id]/extract-expiry
            → GPT-4o 호출 (앞 2000토큰)
            → schedules 테이블 INSERT
            → 실패 시 try/catch 격리 (업로드 전체는 성공)
```

---

## 2. 데이터베이스 설계

### 2.1 schedules 테이블 컬럼 추가

기존 `schedules` 테이블에 만료일 출처 추적용 컬럼 3개를 추가한다.

```sql
-- 마이그레이션 파일: 012_schedules_expiry.sql
ALTER TABLE schedules
  ADD COLUMN IF NOT EXISTS source_type TEXT,       -- 'document_expiry' | NULL
  ADD COLUMN IF NOT EXISTS source_id UUID,          -- files.id 참조
  ADD COLUMN IF NOT EXISTS expiry_confidence TEXT;  -- 'high' | 'low' | 'none'
```

**컬럼 설명**:

| 컬럼명 | 타입 | 허용값 | 설명 |
|--------|------|--------|------|
| `source_type` | TEXT | `'document_expiry'` \| NULL | 문서 만료일로부터 자동 생성된 일정임을 표시. 수동 일정은 NULL |
| `source_id` | UUID | `files.id` | 어느 파일에서 추출된 만료일인지 역참조 |
| `expiry_confidence` | TEXT | `'high'` \| `'low'` \| `'none'` | AI 추출 신뢰도. 'none'은 만료일 없음 또는 추출 불가 |

**롤백 SQL (긴급 시 사용)**:

```sql
ALTER TABLE schedules
  DROP COLUMN IF EXISTS source_type,
  DROP COLUMN IF EXISTS source_id,
  DROP COLUMN IF EXISTS expiry_confidence;
```

### 2.2 notifications 테이블 없음

모달 팝업 방식은 클라이언트가 API를 직접 호출하므로 별도 notifications 테이블이 필요 없다.
"오늘 다시 보지 않기" 상태는 localStorage에서 관리한다.

### 2.3 RLS 정책

기존 `schedules` 테이블 RLS가 `user_id = auth.uid()` 조건으로 적용되어 있으므로
추가 RLS 정책 없이 타 사용자 데이터 격리가 보장된다.

확인 쿼리:

```sql
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'schedules';
-- user_id = auth.uid() 조건이 SELECT/INSERT/UPDATE/DELETE 전체에 적용되어 있어야 함
```

### 2.4 Entity 타입 정의

```typescript
// src/types/expiry.ts

/** schedules 테이블 레코드 (만료일 관련 필드 포함) */
export interface ScheduleRecord {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  start_date: string;        // ISO 8601: 'YYYY-MM-DD'
  end_date: string;          // 만료일 (ISO 8601)
  source_type: 'document_expiry' | null;
  source_id: string | null;  // files.id
  expiry_confidence: 'high' | 'low' | 'none' | null;
  created_at: string;
}

/** 만료 임박 문서 요약 (API 응답 단위) */
export interface ExpiryItem {
  schedule_id: string;
  file_id: string;
  file_name: string;
  expiry_date: string;       // 'YYYY-MM-DD'
  days_remaining: number;    // D-day (음수 = 이미 만료)
  confidence: 'high' | 'low' | 'none';
  owner_name: string | null; // 담당자명
}

/** AI 추출 결과 스키마 */
export interface ExpiryExtractResult {
  expiry_date: string | null;        // 'YYYY-MM-DD'
  contract_period: string | null;    // 'YYYY-MM-DD ~ YYYY-MM-DD'
  document_type: string;
  confidence: 'high' | 'low' | 'none';
  reason: string;
}
```

---

## 3. API 설계

### 3.1 엔드포인트 목록

| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|------|
| POST | `/api/files/[id]/extract-expiry` | AI 만료일 추출 + schedules 등록 | 필수 |
| GET | `/api/dashboard/expiry-summary` | D-30 이내 만료 문서 목록 | 필수 |
| PATCH | `/api/files/[id]/expiry` | 만료일 수동 수정 | 필수 |

---

### 3.2 `POST /api/files/[id]/extract-expiry`

파일 텍스트에서 AI로 만료일을 추출하고 `schedules` 테이블에 등록한다.
업로드 후처리 파이프라인에서 비동기로 호출된다.

**Request**:

```typescript
// URL 파라미터
interface ExtractExpiryParams {
  id: string;  // files.id (UUID)
}

// Request Body: 없음 (파일 ID만으로 서버에서 텍스트 조회)
```

**Response (200 OK)**:

```typescript
interface ExtractExpiryResponse {
  success: true;
  schedule_id: string | null;       // 생성된 schedules.id (confidence: 'none'이면 null)
  expiry_date: string | null;       // 'YYYY-MM-DD'
  confidence: 'high' | 'low' | 'none';
  document_type: string;
  reason: string;                   // AI 추출 근거
}
```

**Response (실패 — 에러 아님, 상태로 처리)**:

```typescript
// confidence: 'none'인 경우 — schedules 미등록
{
  success: true,
  schedule_id: null,
  expiry_date: null,
  confidence: 'none',
  document_type: '불명확',
  reason: '만료일 관련 날짜 정보를 찾을 수 없습니다.'
}
```

**처리 흐름**:

```
1. files 테이블에서 file_id로 텍스트(extracted_text) 조회
2. 텍스트 앞 2000토큰 슬라이싱
3. GPT-4o 호출 (system prompt + user content)
4. 응답 JSON 파싱 → ExpiryExtractResult
5. confidence !== 'none'이면 schedules INSERT:
   - title: '{파일명} 만료일'
   - start_date: expiry_date (만료 당일)
   - end_date: expiry_date
   - source_type: 'document_expiry'
   - source_id: file_id
   - expiry_confidence: confidence
6. 결과 반환 (실패해도 업로드 파이프라인은 계속 진행)
```

**에러 응답**:

```typescript
// 500 — GPT 호출 실패 등 예외 상황
{
  "error": {
    "code": "EXPIRY_EXTRACT_FAILED",
    "message": "만료일 추출 중 오류가 발생했습니다.",
    "details": { "file_id": "..." }
  }
}
```

---

### 3.3 `GET /api/dashboard/expiry-summary`

D-30 이내 만료 예정 문서 목록을 반환한다. 모달과 대시보드 위젯이 동일 API를 공유한다.

**Request**:

```typescript
// Query Parameters (모두 선택)
interface ExpirySummaryQuery {
  days?: number;   // 기본값: 30 (D-30 이내)
  limit?: number;  // 기본값: 10
}
```

**Response (200 OK)**:

```typescript
interface ExpirySummaryResponse {
  items: ExpiryItem[];  // D-day 오름차순 정렬
  total: number;        // 전체 건수 (페이지네이션용)
  has_expired: boolean; // 이미 만료된 문서 포함 여부
}
```

**예시 응답**:

```json
{
  "items": [
    {
      "schedule_id": "sch-uuid-001",
      "file_id": "file-uuid-001",
      "file_name": "ABC사 유지보수계약서.pdf",
      "expiry_date": "2026-04-15",
      "days_remaining": 3,
      "confidence": "high",
      "owner_name": "홍길동"
    },
    {
      "schedule_id": "sch-uuid-002",
      "file_id": "file-uuid-002",
      "file_name": "XYZ 소프트웨어 라이선스.pdf",
      "expiry_date": "2026-04-24",
      "days_remaining": 12,
      "confidence": "high",
      "owner_name": null
    }
  ],
  "total": 2,
  "has_expired": false
}
```

**Supabase 쿼리**:

```typescript
const today = new Date().toISOString().split('T')[0];
const limitDate = new Date(Date.now() + days * 86400000).toISOString().split('T')[0];

const { data, error } = await supabase
  .from('schedules')
  .select(`
    id,
    title,
    end_date,
    source_id,
    expiry_confidence,
    files!source_id (
      id,
      name,
      owner:profiles!owner_id (full_name)
    )
  `)
  .eq('source_type', 'document_expiry')
  .lte('end_date', limitDate)
  .order('end_date', { ascending: true })
  .limit(limit);
```

---

### 3.4 `PATCH /api/files/[id]/expiry`

AI 추출 결과가 틀렸을 때 담당자가 만료일을 직접 수정한다.

**Request**:

```typescript
interface PatchExpiryRequest {
  expiry_date: string;  // 'YYYY-MM-DD'
  reason?: string;      // 수정 사유 (선택)
}
```

**Response (200 OK)**:

```typescript
interface PatchExpiryResponse {
  success: true;
  schedule_id: string;
  expiry_date: string;   // 수정된 만료일
  updated_at: string;    // ISO 8601
}
```

**처리 흐름**:

```
1. files 테이블에서 file_id로 연결된 schedules 조회
   (source_type = 'document_expiry' AND source_id = file_id)
2. schedules.end_date, schedules.start_date 업데이트
3. expiry_confidence → 'high' 로 업데이트 (수동 확정)
4. 수정 결과 반환
```

---

## 4. 컴포넌트 설계

### 4.1 컴포넌트 목록

| 컴포넌트 | 경로 | 역할 |
|----------|------|------|
| `ExpiryAlertProvider` | `src/components/expiry/ExpiryAlertProvider.tsx` | 앱 진입 시 API 호출 + 모달 표시 결정 Context |
| `ExpiryAlertModal` | `src/components/expiry/ExpiryAlertModal.tsx` | 팝업 모달 UI |
| `ExpiryDashboardWidget` | `src/components/expiry/ExpiryDashboardWidget.tsx` | 대시보드 만료 임박 위젯 |
| `ExpiryBadge` | `src/components/expiry/ExpiryBadge.tsx` | D-day 배지 (공용) |

---

### 4.2 ExpiryAlertProvider

앱 진입 시 localStorage를 확인하고, 조건을 충족하면 API를 호출하여 모달을 트리거한다.

**Props 인터페이스**:

```typescript
interface ExpiryAlertProviderProps {
  children: React.ReactNode;
}

interface ExpiryAlertContextValue {
  items: ExpiryItem[];
  isLoading: boolean;
  refetch: () => void;
}

export const ExpiryAlertContext = React.createContext<ExpiryAlertContextValue>({
  items: [],
  isLoading: false,
  refetch: () => {},
});
```

**모달 표시 결정 로직 (핵심 코드)**:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { ExpiryAlertContext, ExpiryAlertContextValue } from './ExpiryAlertContext';
import { ExpiryAlertModal } from './ExpiryAlertModal';
import type { ExpiryItem } from '@/types/expiry';

const STORAGE_KEY = 'expiry_modal_suppressed_date';

export function ExpiryAlertProvider({ children }: ExpiryAlertProviderProps) {
  const [items, setItems] = useState<ExpiryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const fetchAndCheck = async () => {
    // 1. localStorage 확인: 오늘 이미 "다시 보지 않기" 했는지
    const today = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'
    const suppressed = localStorage.getItem(STORAGE_KEY);
    if (suppressed === today) return; // 당일 표시 생략

    // 2. API 호출
    setIsLoading(true);
    try {
      const res = await fetch('/api/dashboard/expiry-summary?days=30&limit=10');
      if (!res.ok) return;
      const data = await res.json();
      if (data.items?.length > 0) {
        setItems(data.items);
        setShowModal(true); // 3. 만료 문서 있으면 모달 표시
      }
    } catch {
      // 알림 실패가 앱 전체를 막으면 안 되므로 조용히 처리
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAndCheck();
  }, []); // 앱 진입(레이아웃 마운트) 시 1회 실행

  const handleDismissToday = () => {
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem(STORAGE_KEY, today);
    setShowModal(false);
  };

  const contextValue: ExpiryAlertContextValue = {
    items,
    isLoading,
    refetch: fetchAndCheck,
  };

  return (
    <ExpiryAlertContext.Provider value={contextValue}>
      {children}
      {showModal && (
        <ExpiryAlertModal
          items={items}
          onDismissToday={handleDismissToday}
          onClose={() => setShowModal(false)}
        />
      )}
    </ExpiryAlertContext.Provider>
  );
}
```

---

### 4.3 ExpiryAlertModal

**Props 인터페이스**:

```typescript
interface ExpiryAlertModalProps {
  items: ExpiryItem[];           // 만료 임박 문서 목록 (D-day 오름차순)
  onDismissToday: () => void;   // "오늘 다시 보지 않기" 클릭 핸들러
  onClose: () => void;           // "확인" 버튼 또는 외부 클릭 핸들러
}
```

**localStorage 키**:

```
키: expiry_modal_suppressed_date
값: 'YYYY-MM-DD' (예: '2026-04-12')
만료: 별도 TTL 없음 — 날짜 비교로 자동 무효화
```

**ASCII 와이어프레임**:

```
┌─────────────────────────────────────────────────────┐
│  만료 임박 문서 알림                            [X] │
├─────────────────────────────────────────────────────┤
│                                                     │
│  D-30 이내 만료 예정인 문서가 있습니다.             │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ [D-3]  ABC사 유지보수계약서          2026.04.15 │   │
│  │ [D-12] XYZ 소프트웨어 라이선스       2026.04.24 │   │
│  │ [D-28] 보안서약서 (홍길동)           2026.05.10 │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ※ 파일명 클릭 시 상세 페이지로 이동 (P2)          │
│                                                     │
│  [오늘 다시 보지 않기]              [확인]          │
└─────────────────────────────────────────────────────┘
```

**D-day 배지 색상 규칙**:

| 조건 | 배지 색상 | 예시 |
|------|-----------|------|
| days_remaining <= 0 | 빨강 (만료됨) | [만료됨] |
| days_remaining <= 7 | 주황 | [D-3] |
| days_remaining <= 14 | 노랑 | [D-10] |
| days_remaining <= 30 | 회색 | [D-25] |

---

### 4.4 ExpiryDashboardWidget

**Props 인터페이스**:

```typescript
interface ExpiryDashboardWidgetProps {
  // Context에서 items 소비 — props 없음
  // 또는 SSR 지원이 필요한 경우:
  initialItems?: ExpiryItem[];
}
```

**ASCII 와이어프레임**:

```
┌──────────────────────────────────────────┐
│  만료 임박 문서                          │
│  ─────────────────────────────────────  │
│  [D-3]  ABC사 유지보수계약서             │
│         2026.04.15 · 담당: 홍길동        │
│                                          │
│  [D-12] XYZ 소프트웨어 라이선스          │
│         2026.04.24                       │
│                                          │
│  [D-28] 보안서약서                       │
│         2026.05.10 · 담당: 이순신        │
│                                          │
│  [만료됨] 구계약서 2024.03.01            │
│                                          │
│                    더보기 →              │
└──────────────────────────────────────────┘
```

---

## 5. AI 프롬프트 설계

### 5.1 System Prompt

```
당신은 계약서 및 법률 문서에서 만료일과 계약 기간을 추출하는 전문가입니다.

아래 규칙을 반드시 따르세요:
1. 제공된 문서 텍스트에서 만료일(계약 종료일, 유효기간 만료일, 라이선스 만료일 등)을 찾으세요.
2. 날짜는 반드시 YYYY-MM-DD 형식으로 변환하세요.
   - '2025년 12월 31일' → '2025-12-31'
   - '2025.12.31' → '2025-12-31'
   - '25/12/31' → '2025-12-31'
3. 계약기간이 있으면 종료일을 만료일로 사용하세요.
4. 만료일을 찾을 수 없으면 expiry_date와 contract_period를 null로 반환하세요.
5. 확신할 수 없는 경우 confidence를 'low'로 설정하세요.
6. 응답은 반드시 아래 JSON 형식으로만 반환하세요. 다른 텍스트 없이 JSON만 출력하세요.

{
  "expiry_date": "YYYY-MM-DD 또는 null",
  "contract_period": "YYYY-MM-DD ~ YYYY-MM-DD 또는 null",
  "document_type": "감지된 문서 유형",
  "confidence": "high 또는 low 또는 none",
  "reason": "추출 근거 또는 실패 이유 (한 줄)"
}
```

### 5.2 응답 JSON 스키마

```typescript
interface ExpiryExtractResult {
  expiry_date: string | null;        // 'YYYY-MM-DD' 또는 null
  contract_period: string | null;    // 'YYYY-MM-DD ~ YYYY-MM-DD' 또는 null
  document_type: string;             // 예: '유지보수계약서', '소프트웨어 라이선스'
  confidence: 'high' | 'low' | 'none';
  reason: string;                    // 추출 근거 또는 실패 이유
}
```

**confidence 기준**:

| 값 | 의미 | 조건 |
|----|------|------|
| `'high'` | 명시적 날짜 확인 | 문서에 "계약기간", "만료일" 등 레이블과 날짜가 함께 있음 |
| `'low'` | 추정 가능 | 날짜는 발견했으나 맥락이 불분명함 |
| `'none'` | 추출 불가 | 날짜 자체가 없거나 문서 유형상 만료일이 없음 |

### 5.3 토큰 절감 전략

```typescript
// src/lib/expiry/prepareExpiryPrompt.ts

const MAX_CHARS = 8000; // 약 2000토큰 (한글 기준 4자 ≒ 1토큰)

export function prepareTextForExpiryExtraction(fullText: string): string {
  // 전략 1: 앞 MAX_CHARS 글자만 사용 (계약서는 전문에 핵심 정보 집중)
  const truncated = fullText.slice(0, MAX_CHARS);

  // 전략 2: 날짜 패턴 주변 컨텍스트 우선 추출 (향후 개선)
  // const datePattern = /\d{4}[-./년]\d{1,2}[-./월]\d{1,2}/g;
  // ...

  return truncated;
}
```

**GPT-4o 호출 코드**:

```typescript
// src/lib/expiry/extractExpiry.ts

import OpenAI from 'openai';
import { prepareTextForExpiryExtraction } from './prepareExpiryPrompt';
import type { ExpiryExtractResult } from '@/types/expiry';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function extractExpiryFromText(
  fullText: string
): Promise<ExpiryExtractResult> {
  const text = prepareTextForExpiryExtraction(fullText);

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: EXPIRY_SYSTEM_PROMPT },
      { role: 'user', content: `다음 문서에서 만료일을 추출하세요:\n\n${text}` },
    ],
    max_tokens: 300, // 응답은 짧은 JSON이므로 충분
  });

  const raw = response.choices[0].message.content ?? '{}';
  return JSON.parse(raw) as ExpiryExtractResult;
}
```

---

## 6. 레이아웃 연동

### 6.1 메인 레이아웃에 Provider 추가

`ExpiryAlertProvider`를 메인 레이아웃에 삽입하면 로그인 후 모든 페이지 진입 시 자동으로 트리거된다.

```typescript
// app/(main)/layout.tsx

import { ExpiryAlertProvider } from '@/components/expiry/ExpiryAlertProvider';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ExpiryAlertProvider>
      <div className="main-layout">
        {/* 기존 레이아웃 구조 유지 */}
        {children}
      </div>
    </ExpiryAlertProvider>
  );
}
```

### 6.2 대시보드에 위젯 추가

```typescript
// app/(main)/dashboard/page.tsx (또는 대시보드 컴포넌트)

import { ExpiryDashboardWidget } from '@/components/expiry/ExpiryDashboardWidget';

export default function DashboardPage() {
  return (
    <div className="dashboard-grid">
      {/* 기존 위젯들 */}
      <ExpiryDashboardWidget />
    </div>
  );
}
```

### 6.3 업로드 파이프라인 연동

기존 업로드 후처리 흐름에 만료일 추출을 비동기 단계로 추가한다.

```typescript
// 기존 업로드 후처리 함수 (예: src/lib/upload/pipeline.ts)

export async function runUploadPipeline(fileId: string) {
  await extractText(fileId);       // 텍스트 추출
  await chunkAndEmbed(fileId);     // 청킹 & 임베딩

  // 만료일 추출 — 실패해도 업로드 파이프라인 전체는 성공으로 처리
  try {
    await fetch(`/api/files/${fileId}/extract-expiry`, { method: 'POST' });
  } catch (err) {
    console.warn('[expiry] 만료일 추출 실패 (무시됨):', err);
  }
}
```

---

## 7. 에러 처리

### 7.1 에러 코드 정의

| 코드 | HTTP | 원인 | 처리 방식 |
|------|------|------|-----------|
| `EXPIRY_EXTRACT_FAILED` | 500 | GPT-4o 호출 오류 | 로그 기록 후 조용히 처리 (업로드 성공 유지) |
| `EXPIRY_FILE_NOT_FOUND` | 404 | files 테이블에 해당 ID 없음 | 에러 반환 |
| `EXPIRY_UNAUTHORIZED` | 401 | 인증 토큰 없음/만료 | 로그인 페이지 리다이렉트 |
| `EXPIRY_PARSE_ERROR` | 200 | GPT 응답이 JSON 형식 아님 | confidence: 'none'으로 처리 |

### 7.2 에러 응답 형식

```typescript
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
```

---

## 8. 보안 고려사항

- [x] Supabase RLS: `schedules` 테이블 `user_id = auth.uid()` 정책으로 타 사용자 데이터 격리
- [x] API 라우트 인증: 모든 API 라우트에서 Supabase 세션 확인 (`createRouteHandlerClient`)
- [x] GPT 응답 파싱: JSON 파싱 실패 시 `confidence: 'none'`으로 안전 처리
- [x] localStorage: 민감 정보 저장 없음 (날짜 문자열만)
- [ ] Rate Limiting: `/api/files/[id]/extract-expiry` 호출 빈도 제한 (OpenAI 비용 보호)

---

## 9. 클린 아키텍처 레이어 배분

| 컴포넌트/모듈 | 레이어 | 경로 |
|--------------|--------|------|
| `ExpiryAlertModal` | Presentation | `src/components/expiry/ExpiryAlertModal.tsx` |
| `ExpiryAlertProvider` | Presentation | `src/components/expiry/ExpiryAlertProvider.tsx` |
| `ExpiryDashboardWidget` | Presentation | `src/components/expiry/ExpiryDashboardWidget.tsx` |
| `ExpiryBadge` | Presentation | `src/components/expiry/ExpiryBadge.tsx` |
| `useExpiryAlert` | Application | `src/hooks/useExpiryAlert.ts` |
| `ExpiryItem`, `ExpiryExtractResult` | Domain | `src/types/expiry.ts` |
| `extractExpiry` | Infrastructure | `src/lib/expiry/extractExpiry.ts` |
| `prepareExpiryPrompt` | Infrastructure | `src/lib/expiry/prepareExpiryPrompt.ts` |
| API Route: extract-expiry | Infrastructure | `src/app/api/files/[id]/extract-expiry/route.ts` |
| API Route: expiry-summary | Infrastructure | `src/app/api/dashboard/expiry-summary/route.ts` |
| API Route: expiry PATCH | Infrastructure | `src/app/api/files/[id]/expiry/route.ts` |

---

## 10. 구현 순서 (Phase별 체크리스트)

### Phase 1 — DB 마이그레이션 (20분)

- [ ] `supabase/migrations/012_schedules_expiry.sql` 파일 생성
- [ ] `ALTER TABLE schedules ADD COLUMN IF NOT EXISTS ...` 3개 컬럼 추가
- [ ] Supabase Dashboard 또는 CLI로 마이그레이션 실행
- [ ] `schedules` 테이블 RLS 정책 확인 (`source_type` 컬럼 추가 후에도 기존 정책 유효한지)

### Phase 2 — AI 추출 인프라 (2~3시간)

- [ ] `src/types/expiry.ts` — Entity 타입 정의 작성
- [ ] `src/lib/expiry/prepareExpiryPrompt.ts` — 텍스트 슬라이싱 + System Prompt 상수
- [ ] `src/lib/expiry/extractExpiry.ts` — GPT-4o 호출 함수
- [ ] `src/app/api/files/[id]/extract-expiry/route.ts` — POST 라우트 구현
- [ ] 샘플 계약서 3건으로 추출 결과 확인 (confidence, expiry_date 검증)

### Phase 3 — schedules 자동 등록 (1시간)

- [ ] extract-expiry API 내 schedules INSERT 로직 구현
- [ ] `source_type = 'document_expiry'`, `source_id = file_id` 정상 입력 확인
- [ ] confidence: 'none'인 경우 INSERT 생략 확인
- [ ] 기존 수동 일정 CRUD 회귀 테스트

### Phase 4 — expiry-summary API (1시간)

- [ ] `src/app/api/dashboard/expiry-summary/route.ts` — GET 라우트 구현
- [ ] Supabase 쿼리: `end_date <= today+30 AND source_type = 'document_expiry'`
- [ ] `days_remaining` 계산 로직 (음수 허용 — 이미 만료된 문서)
- [ ] RLS 동작 확인 (다른 계정으로 요청 시 빈 배열 반환)

### Phase 5 — 모달 컴포넌트 (1~2시간)

- [ ] `src/components/expiry/ExpiryAlertContext.ts` — Context 정의
- [ ] `src/components/expiry/ExpiryAlertProvider.tsx` — localStorage 체크 + API 호출 + 모달 트리거
- [ ] `src/components/expiry/ExpiryBadge.tsx` — D-day 배지 (색상 조건 포함)
- [ ] `src/components/expiry/ExpiryAlertModal.tsx` — 모달 UI
- [ ] `app/(main)/layout.tsx`에 `ExpiryAlertProvider` 래핑 추가
- [ ] "오늘 다시 보지 않기" 동작 검증 (localStorage 저장 → 재진입 시 미표시)

### Phase 6 — 대시보드 위젯 (1~2시간)

- [ ] `src/components/expiry/ExpiryDashboardWidget.tsx` — Context에서 items 소비
- [ ] 대시보드 페이지에 위젯 삽입
- [ ] 빈 상태 UI (만료 임박 문서 없음 메시지)
- [ ] 로딩 스켈레톤 UI

### Phase 7 — 업로드 파이프라인 연동 (1시간)

- [ ] 기존 업로드 후처리 함수에 `extract-expiry` 호출 추가
- [ ] try/catch 격리 확인 (추출 실패가 업로드 성공에 영향 안 주는지)
- [ ] 파일 업로드 전체 파이프라인 회귀 테스트

### Phase 8 — P1: 수동 수정 UI (1~2시간)

- [ ] `src/app/api/files/[id]/expiry/route.ts` — PATCH 라우트 구현
- [ ] 파일 상세 페이지에 만료일 수정 UI 추가 (날짜 입력 + 저장 버튼)
- [ ] 수정 후 ExpirySummary 자동 갱신 (Context refetch 호출)

### Phase 9 — P1: 추출 실패 처리 (1시간)

- [ ] confidence: 'none'인 파일에 "만료일 없음" 상태 표시 (파일 목록/상세)
- [ ] 에러 토스트 없이 조용히 처리 확인
- [ ] "만료일 직접 입력" 유도 UI 표시

### Phase 10 — P2: 추가 기능 (1~2시간)

- [ ] 모달에서 파일명 클릭 시 파일 상세 페이지 링크 이동
- [ ] 이미 만료된 문서 "만료됨" 배지 표시 (대시보드 + 파일 목록)
- [ ] 전체 회귀 테스트 (기존 캘린더, 검색, 대시보드 정상 동작 확인)

---

## 11. 테스트 계획

### 11.1 테스트 범위

| 유형 | 대상 | 도구 |
|------|------|------|
| 단위 테스트 | `extractExpiry`, `prepareTextForExpiryExtraction`, D-day 계산 | Jest/Vitest |
| 통합 테스트 | API 라우트 3개 | Supertest |
| 수동 테스트 | 모달 표시/억제, localStorage 동작, 위젯 렌더링 | 브라우저 직접 확인 |

### 11.2 핵심 테스트 케이스

- [ ] 명시적 만료일이 있는 계약서 PDF → confidence: 'high', 올바른 날짜 추출
- [ ] 날짜가 전혀 없는 문서 → confidence: 'none', schedules 미등록
- [ ] D-30 이내 만료 문서 등록 후 앱 진입 → 모달 표시
- [ ] "오늘 다시 보지 않기" 클릭 후 앱 재진입 → 모달 미표시
- [ ] 다음 날 앱 진입 (localStorage 날짜 어제로 변경) → 모달 재표시
- [ ] 다른 계정으로 API 호출 → 빈 배열 반환 (RLS 격리 확인)

---

## 12. 관련 문서

- 계획서: [clio-expiry-alert.plan.md](../01-plan/features/clio-expiry-alert.plan.md)
- 프로젝트 현황: `wiki/CONTEXT.md`

---

## 버전 이력

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 0.1 | 2026-04-12 | 초안 작성 | 크로미 (PM) |
