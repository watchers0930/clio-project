# 업무일지 (Work Logs)

[coverage: high -- sources: supabase/migrations/020_work_logs.sql, src/types/work-log.ts, src/hooks/useWorkLog.ts, src/app/api/work-logs/, src/components/work-logs/]

---

## Purpose [coverage: high -- 4 sources]

업무일지는 사원이 날짜별로 업무 내용을 기록하고, 부서장/관리자가 팀원의 일지 현황을 열람·관리하는 기능이다.

- **개인 일지**: 오늘 한 일(`done`), 내일 할 일(`plan`), 특이사항(`note`) 3개 필드
- **첨부파일**: 문서(`documents`) 또는 파일(`files`) 참조 가능 (둘 중 하나만)
- **잠금 시스템**: 전일 이전 날짜 일지 조회 시 서버에서 자동으로 `is_locked=true` 처리 (Lazy auto-lock)
- **부서장 잠금 해제**: manager/admin만 `POST /api/work-logs/[date]/unlock`으로 해제 가능
- **팀 현황**: manager/admin이 부서 팀원 전체의 주간 일지 현황을 그리드로 열람
- **주간 요약**: 본인 일주일치 일지를 GPT-4o로 요약 + DOCX 다운로드

사이드바에서 오늘 일지 미작성 시 빨간 점 배지(workLogBadge) 표시.

---

## Architecture [coverage: high -- 4 sources]

```
src/
├── types/work-log.ts                     타입 정의 (WorkLog, WorkLogAttachment 등)
├── hooks/useWorkLog.ts                   전체 상태 관리 훅
├── components/work-logs/
│   ├── WorkLogEditor.tsx                 잠금 해제 상태 편집기 (done/plan/note 입력)
│   ├── WorkLogViewer.tsx                 잠금 상태 뷰어 (부서장 잠금해제 버튼 포함)
│   ├── AttachmentSelector.tsx            문서/파일 첨부 선택 UI
│   ├── TeamLogGrid.tsx                   팀 현황 그리드 (manager/admin 전용)
│   └── WeeklySummaryModal.tsx            주간 요약 모달 + DOCX 다운로드
└── app/
    ├── (app)/work-logs/page.tsx          업무일지 메인 페이지
    └── api/work-logs/
        ├── [date]/route.ts               GET(조회+자동잠금) / PATCH(수정) / POST(upsert)
        ├── [date]/lock/route.ts          POST: 사용자 수동 잠금
        ├── [date]/unlock/route.ts        POST: manager/admin 잠금 해제
        ├── [date]/attachments/route.ts   POST(첨부 추가) / DELETE(첨부 제거)
        ├── team/route.ts                 GET: 팀원 일지 현황 (manager/admin)
        └── weekly-summary/route.ts       POST: 주간 요약 생성 (GPT-4o + DOCX)
```

### UI 렌더링 분기

```
is_locked=false → WorkLogEditor (편집 모드)
is_locked=true  → WorkLogViewer (읽기 모드)
  └─ isManager=true → 잠금 해제 버튼 표시
```

### useWorkLog.ts 핵심 흐름

```typescript
fetchLog(date)        → GET /api/work-logs/{date}
saveLog(date, body)   → POST(upsert) or PATCH(수정), is_locked 시 차단
addAttachment(...)    → POST /api/work-logs/{date}/attachments
removeAttachment(...) → DELETE /api/work-logs/{date}/attachments
lockLog(date)         → POST /api/work-logs/{date}/lock
unlockLog(date, uid)  → POST /api/work-logs/{date}/unlock { target_user_id }
fetchTeamLogs(s,e)    → GET /api/work-logs/team?start=&end=
generateWeeklySummary → POST /api/work-logs/weekly-summary { week_start }
```

---

## API Surface [coverage: high -- 4 sources]

| 메서드 | 경로 | 권한 | 설명 |
|--------|------|------|------|
| GET | `/api/work-logs/[date]` | 본인 또는 ?user_id= (manager/admin) | 조회. 전일 이전 + 미잠금 → 자동 잠금 |
| POST | `/api/work-logs/[date]` | 본인 | 일지 upsert (없으면 생성, 있으면 업데이트) |
| PATCH | `/api/work-logs/[date]` | 본인 | 일지 수정 (is_locked=true면 403) |
| POST | `/api/work-logs/[date]/lock` | 본인 | 수동 잠금 |
| POST | `/api/work-logs/[date]/unlock` | manager/admin | 잠금 해제. body: `{ target_user_id }` 필수 |
| POST | `/api/work-logs/[date]/attachments` | 본인 | 첨부 추가. body: `{ document_id }` 또는 `{ file_id }` |
| DELETE | `/api/work-logs/[date]/attachments` | 본인 | 첨부 제거. body: `{ attachment_id }` |
| GET | `/api/work-logs/team` | manager/admin | 팀원 현황 `?start=YYYY-MM-DD&end=YYYY-MM-DD` |
| POST | `/api/work-logs/weekly-summary` | 본인 | body: `{ week_start: 월요일 날짜 }` → GPT-4o 요약 + DOCX |

**team API 응답 구조 (`TeamLogEntry[]`)**:
```typescript
interface TeamLogEntry {
  user_id: string;
  user_name: string;
  position: string;
  logs: Record<string, { id: string; is_locked: boolean } | null>; // key: YYYY-MM-DD
}
```

**weekly-summary 응답 (`WeeklySummaryResponse`)**:
```typescript
interface WeeklySummaryResponse {
  document_id?: string;   // documents 테이블에 저장된 ID
  title: string;
  summary: string;
  week_start: string;
  week_end: string;
  log_count: number;
  docx_base64: string;    // base64 인코딩된 DOCX 바이너리
  docx_filename: string;
}
```

---

## Data Schema [coverage: high -- 2 sources]

### work_logs (migration 020)

```sql
CREATE TABLE work_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date    DATE NOT NULL,
  done        TEXT,           -- 오늘 한 일
  plan        TEXT,           -- 내일 할 일
  note        TEXT,           -- 특이사항
  is_locked   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, log_date)
);
```

### work_log_attachments (migration 020)

```sql
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
```

CHECK 제약: `document_id`/`file_id` 중 정확히 하나만 non-NULL이어야 한다.

---

## RLS Policies [coverage: high -- 2 sources]

| 정책 | 테이블 | 조건 |
|------|--------|------|
| `work_logs_own` | work_logs | `user_id = auth.uid()` — 본인 일지 ALL |
| `work_logs_manager_read` | work_logs | SELECT 전용. `me.role IN ('manager','admin') AND me.dept = target.dept` |
| `work_log_attachments_own` | work_log_attachments | `wl.user_id = auth.uid()` — 본인 일지 첨부 ALL |

lock/unlock API는 admin client 사용 (RLS bypass). manager는 같은 부서 팀원만 해제 가능.

---

## Key Decisions [coverage: high -- 3 sources]

1. **Lazy auto-lock**: GET 요청 시 서버에서 `date < today && !is_locked` 조건으로 자동 잠금. 별도 배치/크론 불필요. `.eq('user_id', authUserId)` 재확인으로 타인 일지 잠금 방지 (C9).

2. **target_user_id 필수 (unlock)**: unlock body에 `target_user_id` 누락 시 400. 날짜가 같아도 잘못된 사용자 일지를 해제하는 버그 방지 (C8).

3. **?user_id 파라미터 패턴 (C7)**: manager/admin이 팀원 개별 일지 열람 시 `GET /api/work-logs/[date]?user_id=xxx`. 같은 엔드포인트에 쿼리 파라미터로 분기, 권한 검증 포함.

4. **주간 요약 월요일 기준**: `week_start`는 반드시 월요일(isMondayDate 서버 검증). 월~금 5일치 일지 GPT-4o 요약 후 DOCX 생성 → `docx_base64` 응답.

5. **DOCX 다운로드 방식**: 서버는 `docx_base64` 반환. 클라이언트에서 `atob() → Uint8Array → Blob → URL.createObjectURL`로 처리.

---

## Gotchas [coverage: high -- 2 sources]

- **migration 020 미적용**: 테이블 없음 → 모든 API 500 오류. Supabase Dashboard → SQL Editor에서 `020_work_logs.sql` 실행 필수.
- **Supabase 타입 `never`**: `src/lib/supabase/types.ts`에 `work_logs`/`work_log_attachments` 미등록 → 백엔드 API 파일 TypeScript 에러. migration 적용 후 타입 재생성 필요. 런타임 무관.
- **WeeklySummaryModal DOCX 다운로드**: `docx_base64`를 직접 `<a href>` 로 사용 불가. Blob 변환 + createObjectURL 필수.
- **팀 현황 그리드 변환**: `GET /api/work-logs/team` 응답은 flat 배열. `useWorkLog.ts`에서 `TeamLogEntry[]` (팀원별 날짜 맵) 구조로 클라이언트 변환.
- **WorkLogViewer `isManager` prop**: 뷰어에 `isManager` 전달 시에만 잠금 해제 버튼 표시. 해제 후 `WorkLogEditor`로 전환.

---

## Sources [coverage: high]

- `/Users/watchers/Desktop/clio-project/supabase/migrations/020_work_logs.sql`
- `/Users/watchers/Desktop/clio-project/src/types/work-log.ts`
- `/Users/watchers/Desktop/clio-project/src/hooks/useWorkLog.ts`
- `/Users/watchers/Desktop/clio-project/src/app/api/work-logs/[date]/route.ts`
- `/Users/watchers/Desktop/clio-project/src/app/api/work-logs/[date]/unlock/route.ts`
- `/Users/watchers/Desktop/clio-project/src/app/api/work-logs/team/route.ts`
- `/Users/watchers/Desktop/clio-project/src/app/api/work-logs/weekly-summary/route.ts`
- `/Users/watchers/Desktop/clio-project/src/components/work-logs/WorkLogViewer.tsx`
