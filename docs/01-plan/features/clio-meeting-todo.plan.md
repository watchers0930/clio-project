# 회의록 → 할일 자동 추출 계획서

**버전:** v1.0.0
**작성일:** 2026-04-12
**프로젝트:** CLIO v5.0.0
**배포:** https://clioai.vercel.app
**상태:** Draft

---

## 1. 개요 (Overview)

### 1-1. 기능 목적

STT(Whisper-1)로 생성된 회의록에는 Action Items가 포함되어 있지만, 현재는 단순 텍스트로만 저장된다. 사용자가 회의록을 다시 읽고 직접 할일을 등록해야 하는 추가 작업이 발생한다.

이 기능은 회의록 텍스트에서 **AI가 액션 아이템, 담당자, 기한을 자동 추출**하여 CLIO 할일(`todos`) 테이블에 즉시 등록함으로써, 회의 후 후속 조치가 자동화되는 경험을 제공한다.

### 1-2. 사용자 가치

| 역할 | 현재 불편 | 기능 도입 후 |
|------|-----------|--------------|
| 회의 주관자 | 회의 후 할일 수동 등록 | 회의록 생성 시 자동 추출 |
| 참여자 | 담당 업무 메모에 의존 | 본인 할일이 자동 등록됨 |
| 관리자 | 후속 조치 추적 어려움 | 할일 목록으로 진행 현황 파악 |

### 1-3. 기술 배경

- **STT 파이프라인**: `/api/transcribe` → Whisper-1 변환 → `summarizeTranscript()` (GPT-4o-mini) 순으로 처리
- **기존 `actionItems` 필드**: `MeetingSummary.actionItems: string[]` — 이미 담당자를 텍스트로 포함하는 구조
- **todos 테이블**: `id, title, description, due_date, priority, status, user_id, created_at` 컬럼 보유
- **AI 모델**: 현재 요약은 GPT-4o-mini, 추출 단계는 GPT-4o 사용 권장 (정확도 우선)

### 1-4. 관련 문서

- 참조 계획서: `docs/01-plan/features/clio-next-phase.plan.md`
- STT API: `src/app/api/transcribe/route.ts`
- 요약 라이브러리: `src/lib/ai/summarize.ts`
- todos 마이그레이션: `supabase/migrations/005_schedule_todo.sql`

---

## 2. 범위 (Scope)

### 2-1. In Scope

- [ ] 회의록 텍스트에서 할일(제목, 담당자 이름, 기한) 자동 추출 API
- [ ] 추출 결과를 `todos` 테이블에 자동 INSERT
- [ ] 담당자 이름 → `users` 테이블 매핑 (일치 시 해당 user_id로 등록, 미일치 시 요청자 본인)
- [ ] 기존 `/api/transcribe` 응답에 `extractedTodos` 배열 추가 (파괴적 변경 없음)
- [ ] 회의록 상세 UI에서 "할일 자동 추출" 버튼 제공 (기존 문서에서 재추출 가능)
- [ ] 추출 결과 미리보기 후 선택적 등록 UI (전체 등록 / 개별 선택 / 취소)
- [ ] 추출 실패 시 사용자에게 토스트 피드백 표시

### 2-2. Out of Scope

- 담당자 자동 알림 발송 (별도 알림 시스템 미구현)
- 기한이 명시되지 않은 경우 AI가 기한 추론 (자의적 해석 방지)
- 회의록 외 일반 문서에서의 할일 추출
- 추출된 할일의 일정(events) 자동 등록
- todos 테이블 스키마 변경 (source_document_id 컬럼 추가 등 — P3로 분류)

---

## 3. 요구사항 (Requirements)

### 3-1. 기능 요구사항

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|------|
| FR-01 | `/api/transcribe` 응답에 `extractedTodos[]` 포함 (추출 실패 시 빈 배열) | P0 | Pending |
| FR-02 | 각 할일 항목: `{ title, assigneeName, dueDate, priority }` 구조로 추출 | P0 | Pending |
| FR-03 | 담당자 이름을 `users` 테이블에서 name으로 검색, 매핑 성공 시 해당 user_id 사용 | P0 | Pending |
| FR-04 | 매핑 실패한 담당자는 `user_id = 요청자 본인`으로 등록 | P0 | Pending |
| FR-05 | 새 API `/api/todos/extract` — 기존 document_id를 받아 회의록 내용 재추출 가능 | P1 | Pending |
| FR-06 | 회의록 문서 상세 UI에 "할일 자동 추출" 버튼 추가 | P1 | Pending |
| FR-07 | 추출 결과 미리보기 모달 — 개별 항목 체크/해제 후 선택 등록 | P1 | Pending |
| FR-08 | 등록 완료 후 할일 목록 페이지로 이동 또는 토스트로 개수 안내 | P1 | Pending |
| FR-09 | 추출된 할일 우선순위 자동 판단 (high/medium/low) | P2 | Pending |
| FR-10 | 중복 등록 방지 — 동일 document_id에서 이미 추출된 할일 존재 시 경고 표시 | P2 | Pending |

### 3-2. 비기능 요구사항

| 분류 | 기준 | 측정 방법 |
|------|------|-----------|
| 응답 시간 | 할일 추출 AI 호출 포함 전체 응답 10초 이내 | Vercel 함수 로그 |
| 정확도 | 테스트 회의록 5개 기준 액션 아이템 추출 정확도 80% 이상 | 수동 검증 |
| 안정성 | AI 추출 실패 시 원본 `actionItems` 텍스트를 fallback으로 사용 | 에러 케이스 테스트 |
| 보안 | 타인의 회의록에서 할일 추출 불가 (RLS: todos.user_id = auth.uid()) | RLS 정책 확인 |
| 비용 | GPT-4o 호출은 할일 추출 전용 — 불필요한 반복 호출 방지 | OpenAI 대시보드 |

---

## 4. 우선순위 (Priority)

```
P0 — 핵심 파이프라인 (Must)
  ├── FR-01: /api/transcribe 응답에 extractedTodos 통합
  ├── FR-02: 구조화 추출 (title / assigneeName / dueDate / priority)
  ├── FR-03: 담당자 → user_id 매핑
  └── FR-04: 매핑 실패 시 fallback (요청자 본인)

P1 — 사용자 제어 UI (Should)
  ├── FR-05: /api/todos/extract 독립 엔드포인트
  ├── FR-06: 문서 상세 UI "할일 자동 추출" 버튼
  ├── FR-07: 추출 결과 미리보기 모달
  └── FR-08: 등록 완료 피드백

P2 — 편의 강화 (Could)
  ├── FR-09: 우선순위 자동 판단
  └── FR-10: 중복 등록 방지 경고

P3 — 이후 검토 (Won't — 현재 범위 외)
  ├── todos 테이블에 source_document_id 컬럼 추가
  ├── 담당자 자동 알림
  └── 일정(events) 자동 등록 연동
```

---

## 5. 구현 범위 상세

### 5-1. 신규 파일

| 파일 경로 | 역할 |
|-----------|------|
| `src/lib/ai/extract-todos.ts` | 회의록 텍스트 → 할일 배열 추출 (GPT-4o 호출) |
| `src/app/api/todos/extract/route.ts` | 기존 document_id 기반 재추출 API |
| `src/components/meetings/TodoExtractModal.tsx` | 추출 결과 미리보기 + 선택 등록 모달 |

### 5-2. 수정 파일

| 파일 경로 | 변경 내용 |
|-----------|-----------|
| `src/app/api/transcribe/route.ts` | 요약 후 `extractTodosFromText()` 호출, 응답에 `extractedTodos` 추가 |
| `src/lib/ai/summarize.ts` | `MeetingSummary` 인터페이스에 `extractedTodos?` 선택 필드 검토 |
| 회의록 문서 상세 페이지 | "할일 자동 추출" 버튼 + `TodoExtractModal` 연결 |

### 5-3. 추출 데이터 구조

```typescript
// src/lib/ai/extract-todos.ts
export interface ExtractedTodo {
  title: string;           // 할일 제목 (필수)
  assigneeName: string;    // 담당자 이름 텍스트 (빈 문자열 가능)
  dueDate: string | null;  // ISO 날짜 문자열 or null
  priority: 'high' | 'medium' | 'low';
}

export interface TodoInsertResult {
  inserted: number;        // 실제 등록된 할일 수
  skipped: number;         // 건너뛴 항목 수
  todos: { id: string; title: string }[];
}
```

### 5-4. todos 테이블 활용 방식

```
todos 컬럼 매핑:
  title       ← ExtractedTodo.title
  description ← "회의록 자동 추출 (문서: {docTitle})"
  due_date    ← ExtractedTodo.dueDate (null 허용)
  priority    ← ExtractedTodo.priority
  status      ← 'active' (고정)
  user_id     ← 매핑 성공 시 담당자 user_id, 실패 시 요청자 uid
```

---

## 6. 검증 기준 (Acceptance Criteria)

### 6-1. P0 검증 — 추출 파이프라인

| 검증 항목 | 테스트 방법 | 기대 결과 |
|-----------|-------------|-----------|
| STT 완료 후 할일 자동 추출 | 회의 오디오 업로드 → `/api/transcribe` 응답 확인 | `extractedTodos[]` 배열 포함 |
| 담당자 매핑 성공 | 시스템에 등록된 사용자 이름 언급 회의록 | 해당 user_id로 todos INSERT |
| 담당자 매핑 실패 | 시스템 미등록 이름 ("홍길동") 언급 | 요청자 uid로 todos INSERT |
| 기한 없음 처리 | 기한 언급 없는 회의록 | `due_date = null`로 정상 저장 |
| AI 실패 fallback | OpenAI 오류 상황 (키 임시 제거) | `extractedTodos: []` 반환, 회의록 생성은 정상 완료 |

### 6-2. P1 검증 — UI

| 검증 항목 | 테스트 방법 | 기대 결과 |
|-----------|-------------|-----------|
| "할일 자동 추출" 버튼 표시 | 회의록 문서 상세 페이지 접근 | 버튼 렌더링 확인 |
| 미리보기 모달 동작 | 버튼 클릭 | 추출 항목 목록 모달 표시 |
| 개별 선택 후 등록 | 일부 항목 체크 해제 → "등록" | 선택한 항목만 todos 저장 |
| 전체 취소 | 모달에서 "취소" | todos 테이블 변경 없음 |
| 등록 완료 피드백 | 등록 버튼 클릭 성공 | "N개의 할일이 등록되었습니다" 토스트 |

### 6-3. 회귀 테스트

| 항목 | 확인 방법 |
|------|-----------|
| 기존 STT 회의록 생성 정상 동작 | 오디오 업로드 → 문서 생성 확인 |
| 할일 목록 CRUD 정상 동작 | 기존 할일 생성/수정/삭제 |
| 로그인/인증 세션 유지 | 추출 API 호출 시 인증 에러 없음 |
| RLS 검증 | 타인 문서에서 추출 시도 → 403 응답 |

---

## 7. 예상 작업 항목 (Task Breakdown)

```
[P0] 추출 라이브러리 구현                          (2-3시간)
  └── src/lib/ai/extract-todos.ts
      - GPT-4o 프롬프트 설계 (구조화 JSON 추출)
      - users 테이블 이름 매핑 로직
      - fallback 처리

[P0] /api/transcribe 통합                          (1시간)
  └── 요약 완료 후 extractTodosFromText() 호출
      - 응답 스키마에 extractedTodos 추가
      - 오류 시 회의록 생성 중단 없이 빈 배열 반환

[P1] /api/todos/extract 신규 엔드포인트             (1-2시간)
  └── document_id 수신 → 문서 content 조회 → 추출 → 등록

[P1] TodoExtractModal 컴포넌트                     (2-3시간)
  └── 추출 결과 체크리스트 UI
      - 전체 선택/해제
      - 담당자/기한 표시
      - 등록 버튼 → API 호출

[P1] 문서 상세 페이지 연동                          (1시간)
  └── "할일 자동 추출" 버튼 추가
      - TodoExtractModal 연결
      - 등록 완료 토스트

[P2] 우선순위 자동 판단 프롬프트 개선               (1시간)
[P2] 중복 등록 경고 로직                            (1시간)
```

**총 예상 소요 시간:** P0+P1 기준 7~10시간

---

## 8. 리스크 및 완화 방안

| 리스크 | 영향 | 가능성 | 완화 방안 |
|--------|------|--------|-----------|
| GPT-4o 추출 정확도 불충분 | 잘못된 할일 자동 등록 | 중간 | 미리보기 모달로 사용자 검토 단계 필수 삽입 |
| 담당자 이름 매핑 실패 | 엉뚱한 사람에게 할일 등록 | 높음 | 매핑 실패 시 요청자 본인으로 fallback + 모달에서 담당자 표시 |
| 긴 회의록 토큰 초과 | 추출 실패 | 낮음 | 최대 15,000자 슬라이싱 (기존 summarize 방식 동일 적용) |
| 추출 API 응답 지연 | UX 저하 | 중간 | 로딩 스피너 + 10초 타임아웃 후 빈 배열 fallback |
| /api/transcribe 파괴적 변경 | 기존 프론트 오류 | 낮음 | `extractedTodos` 선택 필드로 추가 (기존 필드 유지) |

---

## 9. 버전 계획

| 버전 | 내용 |
|------|------|
| v5.1.0 | P0 완료 — STT 파이프라인에 할일 자동 추출 통합 |
| v5.2.0 | P1 완료 — 미리보기 모달 + 재추출 UI |
| v5.3.0 | P2 완료 — 우선순위 자동 판단 + 중복 방지 |

---

## Version History

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 0.1 | 2026-04-12 | 최초 작성 | 크로미 (PM) |
