# CLIO 업무일지 (Work Log) 기능 계획서

**버전:** v1.0.0  
**작성일:** 2026-04-17  
**상태:** 계획 수립  
**목표 버전:** v7.0.0  
**연계 기능:** 할일(todo), 일정(events), 회의록(STT), 문서생성(generate), 메신저

---

## 1. 기능 개요

### 한 줄 정의
"오늘 한 일을 쓰면 AI가 정리하고, 팀장은 팀원 일지를 한눈에 본다"

### 배경
CLIO에는 할일·일정·회의록·문서생성 기능이 독립적으로 존재한다.  
업무일지는 이 기능들을 하루 단위로 묶는 허브 역할을 하며,  
AI 주간 요약으로 보고 부담까지 줄인다.

### 핵심 가치
- **작성자**: 하루 5분으로 업무 기록 완료 (할일/일정 자동 불러오기)
- **부서장**: 팀원 전체 현황을 별도 보고 없이 실시간 확인
- **조직**: AI 주간 요약 → 주간업무보고서 DOCX 자동 생성

---

## 2. 사용자 스토리

| 역할 | 스토리 | 완료 조건 |
|------|--------|----------|
| 일반 직원 | 오늘 완료한 할일을 클릭 한 번으로 일지에 가져오고 싶다 | 할일 자동 불러오기 버튼 동작 |
| 일반 직원 | 오늘 참여한 회의록을 일지에 연결하고 싶다 | 당일 문서 선택 첨부 가능 |
| 일반 직원 | 금요일에 이번 주 업무를 AI가 요약해주면 좋겠다 | 주간 요약 DOCX 다운로드 가능 |
| 부서장 | 팀원 중 오늘 일지 미작성자를 확인하고 싶다 | 팀 일지 목록에서 미작성 뱃지 표시 |
| 부서장 | 특정 팀원의 지난 주 업무 흐름을 보고 싶다 | 팀원별 날짜 필터 조회 가능 |

---

## 3. 기능 상세

### 3-1. 일별 업무일지 작성

**작성 항목**
| 필드 | 설명 | 입력 방식 |
|------|------|----------|
| 오늘 한 일 | 완료한 업무 내용 | 텍스트 (자동 불러오기 버튼) |
| 내일 할 일 | 다음날 예정 업무 | 텍스트 (자동 불러오기 버튼) |
| 특이사항 | 이슈·공유사항 | 텍스트 (선택) |
| 첨부 문서 | 당일 회의록·문서 연결 | 문서/파일 선택 모달 |

**규칙**
- 날짜당 1개 (같은 날 중복 생성 불가, UNIQUE 제약)
- 당일·과거 날짜만 작성 가능 (미래 날짜 비활성)
- 완료(잠금) 처리 후에는 관리자만 수정 가능
- 임시저장: 5분마다 자동 저장 (unsaved 뱃지 표시)

**할일 자동 불러오기**
- `GET /api/todos?status=completed&date=YYYY-MM-DD` 호출
- 당일 완료된 할일 목록 → 체크박스로 선택 → 일지 "오늘 한 일"에 항목별 줄 추가

**일정 자동 불러오기**
- `GET /api/events?start=YYYY-MM-DDT00:00:00&end=YYYY-MM-DDT23:59:59` 호출
- 당일 일정 → 체크박스로 선택 → 일지에 추가

---

### 3-2. 부서장 팀 일지 열람

**권한:** role = manager | admin

**팀 일지 목록 화면**
- 부서 내 팀원 목록 + 날짜 선택 (기본: 오늘)
- 작성 완료 / 미작성 상태 한눈에 표시
- 팀원 클릭 → 해당 일지 상세 (읽기 전용)
- 날짜 범위 필터 (이번 주 / 지난 주 / 직접 선택)

**미작성 알림**
- 매일 오후 5시 기준 미작성자 → 메신저 DM 자동 발송 (선택적 설정)
- 부서장 화면에서도 미작성자 수 뱃지 표시

---

### 3-3. AI 주간 요약 + DOCX 보고서

**트리거**
- 금요일 일지 작성 완료 시 "이번 주 요약하기" 버튼 표시
- 또는 언제든 "주간 요약 생성" 수동 버튼

**처리 흐름**
```
1. 해당 주(월~금) work_logs 전체 조회
2. 첨부된 document/file 제목 포함
3. GPT-4o에 전달 → 주간 업무 요약 생성
   - 주요 완료 업무 (항목별)
   - 다음 주 계획
   - 주요 이슈
4. 결과를 기존 DOCX 렌더러로 주간업무보고서.docx 생성
5. 다운로드 or 문서함에 자동 저장 (선택)
```

**GPT-4o 프롬프트 전략**
- 요일별 할 일 나열이 아닌 "업무 카테고리"별 정리
- 반복 업무는 합산 표현 ("미팅 3회 참석")
- 이슈·특이사항은 별도 섹션

---

## 4. 화면 구성

### 4-1. /work-logs (메인 페이지)

```
┌─────────────────────────────────────────────────┐
│  업무일지          [← 이전날] 2026-04-17 [다음날 →]  │
│                                                 │
│  ┌──────────────────────────────────────────┐   │
│  │ 📋 오늘 한 일          [할일 불러오기]    │   │
│  │ ________________________________         │   │
│  │ ________________________________         │   │
│  │                                          │   │
│  │ 📅 내일 할 일          [일정 불러오기]    │   │
│  │ ________________________________         │   │
│  │                                          │   │
│  │ 📌 특이사항                              │   │
│  │ ________________________________         │   │
│  │                                          │   │
│  │ 📎 첨부 문서    [문서 선택]  [파일 선택]  │   │
│  │  • 2026-04-17 팀 미팅 회의록             │   │
│  └──────────────────────────────────────────┘   │
│                                                 │
│  [임시저장]  [작성 완료]  [이번 주 AI 요약]       │
└─────────────────────────────────────────────────┘
```

### 4-2. 팀 일지 열람 (부서장)

```
┌──────────────────────────────────────────────────┐
│  팀 업무일지    [2026-04-14 ~ 2026-04-17 ▼]       │
│                                                  │
│  이름      월   화   수   목(오늘)  상태           │
│  김대리    ✅   ✅   ✅   ✅       전체 작성        │
│  이사원    ✅   ✅   ❌   ⏳       수요일 누락      │
│  박과장    ✅   ✅   ✅   ❌       오늘 미작성      │
│                                                  │
│  [클릭 → 해당 일지 상세 팝업]                     │
└──────────────────────────────────────────────────┘
```

---

## 5. API 설계

| 메서드 | 경로 | 설명 | 권한 |
|--------|------|------|------|
| GET | `/api/work-logs` | 내 일지 목록 (날짜 범위) | 본인 |
| GET | `/api/work-logs/[date]` | 특정 날짜 일지 조회 | 본인 |
| POST | `/api/work-logs` | 일지 생성 | 본인 |
| PATCH | `/api/work-logs/[date]` | 일지 수정 | 본인 (잠금 전) |
| POST | `/api/work-logs/[date]/lock` | 일지 완료(잠금) | 본인 |
| GET | `/api/work-logs/team` | 팀 일지 목록 | manager+ |
| POST | `/api/work-logs/weekly-summary` | AI 주간 요약 생성 | 본인 |

---

## 6. DB 설계

```sql
-- 마이그레이션: 020_work_logs.sql

CREATE TABLE work_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date    DATE NOT NULL,
  done        TEXT,               -- 오늘 한 일
  plan        TEXT,               -- 내일 할 일
  note        TEXT,               -- 특이사항
  is_locked   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, log_date)
);

CREATE INDEX idx_work_logs_user_date ON work_logs(user_id, log_date DESC);
CREATE INDEX idx_work_logs_date ON work_logs(log_date DESC);

-- 첨부 연결 (문서 or 파일 둘 중 하나)
CREATE TABLE work_log_attachments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id      UUID NOT NULL REFERENCES work_logs(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  file_id     UUID REFERENCES files(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (document_id IS NOT NULL AND file_id IS NULL) OR
    (document_id IS NULL AND file_id IS NOT NULL)
  )
);

-- RLS
ALTER TABLE work_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_log_attachments ENABLE ROW LEVEL SECURITY;

-- 본인 일지만 CUD
CREATE POLICY "work_logs_own" ON work_logs
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 부서장: 같은 부서 팀원 일지 SELECT
CREATE POLICY "work_logs_manager_read" ON work_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users me
      JOIN users target ON target.id = work_logs.user_id
      WHERE me.id = auth.uid()
        AND me.role IN ('manager', 'admin')
        AND me.department_id = target.department_id
    )
  );

-- 첨부: 일지 소유자와 동일 권한
CREATE POLICY "work_log_attachments_own" ON work_log_attachments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM work_logs wl
      WHERE wl.id = work_log_attachments.log_id
        AND wl.user_id = auth.uid()
    )
  );
```

---

## 7. 컴포넌트 구조

```
src/
├── app/(app)/work-logs/
│   └── page.tsx                  # 메인 페이지 (날짜 내비게이션)
├── components/work-logs/
│   ├── WorkLogEditor.tsx          # 일지 작성/수정 폼
│   ├── WorkLogViewer.tsx          # 읽기 전용 뷰 (부서장용)
│   ├── AutoFillModal.tsx          # 할일/일정 자동 불러오기 모달
│   ├── AttachmentSelector.tsx     # 문서/파일 첨부 선택 모달
│   ├── TeamLogGrid.tsx            # 팀 일지 격자 뷰 (부서장)
│   └── WeeklySummaryModal.tsx     # AI 주간 요약 결과 + 다운로드
├── hooks/
│   └── useWorkLog.ts              # 일지 CRUD + 자동저장 훅
```

---

## 8. 구현 순서 및 예상 일정

| 단계 | 작업 | 예상 시간 |
|------|------|----------|
| P1 | DB 마이그레이션 (020_work_logs.sql) | 30분 |
| P1 | API 7개 구현 | 3시간 |
| P2 | WorkLogEditor 컴포넌트 + /work-logs 페이지 | 3시간 |
| P2 | AutoFillModal (할일/일정 불러오기) | 1.5시간 |
| P2 | AttachmentSelector (문서/파일 연결) | 1시간 |
| P3 | TeamLogGrid (부서장 뷰) + manager API | 2시간 |
| P4 | AI 주간 요약 API + WeeklySummaryModal | 2시간 |
| P4 | DOCX 주간업무보고서 렌더러 | 1.5시간 |
| P5 | 사이드바 메뉴 추가 + 미작성 뱃지 | 30분 |
| **합계** | | **약 15시간 (2~3일)** |

---

## 9. 검증 계획

| 항목 | 검증 방법 | 기대 결과 |
|------|----------|----------|
| 일지 생성 | 같은 날 두 번 POST | 두 번째는 409 에러 |
| 잠금 후 수정 | lock → PATCH 시도 | 403 거부 |
| 할일 자동 불러오기 | 완료된 할일 선택 후 일지에 반영 | 항목이 "오늘 한 일"에 추가됨 |
| 부서장 열람 | manager 계정으로 팀원 일지 조회 | 팀원 일지 목록 표시 |
| 일반 직원 타 팀 조회 | 다른 부서 user_id로 GET | 404 또는 빈 결과 |
| AI 주간 요약 | 월~금 일지 있는 상태로 요약 생성 | DOCX 다운로드 성공 |
| 빈 주 요약 | 일지 0개 상태로 요약 시도 | "작성된 일지가 없습니다" 안내 |

---

## 10. 확정 사항

| 항목 | 결정 내용 |
|------|----------|
| 미작성 알림 | 푸시 알림 + 대시보드 뱃지 동시 제공 |
| 잠금 기준 | 완료 버튼 수동 잠금 + 다음날 자정 자동 잠금, 부서장 잠금 해제 가능 |
| AI 요약 저장 | 문서함 자동 저장 + 다운로드 시 DOCX/PDF 선택 |
| 주간 범위 | 월~금 고정 |
