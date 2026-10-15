# 설계서: 클리오 근태관리 (electron / attendance·leave)

**작성일:** 2026-10-15
**버전:** v1.0
**상태:** Design (백엔드·프론트엔드 공용 계약서)
**참조 기획서:** `docs/01-plan/features/electron.plan.md`
**대상 구현자:** 백엔드 = Codex · 프론트엔드 = Claude

> 이 문서는 백엔드(Codex)와 프론트엔드(Claude)가 각자 구현할 때 따르는 **단일 계약서**다.
> DB 스키마·타입·API 요청/응답 형태는 **이 문서가 유일한 진실원(source of truth)** 이며, 양측은 임의로 필드명·형태를 바꾸지 않는다. 변경이 필요하면 이 문서를 먼저 고치고 상대에게 알린다.
> ⚠️ 이 문서는 설계·스펙만 담는다. UI/컴포넌트 **구현 코드는 포함하지 않는다.** (타입 정의·SQL·API 시그니처는 계약이므로 포함)

---

## 0. 기존 코드 검증 결과 (설계 전제)

설계 전 실제 저장소 소스를 재검증했다. 기획서·위키와 다른 **확정 사실**은 아래와 같으며, 모든 구현은 이 사실을 기준으로 한다.

| 항목 | 검증된 사실 | 설계 반영 |
| --- | --- | --- |
| 응답 헬퍼 | `src/lib/api-helper.ts`에 `ok<T>(data,status)`, `fail(msg,status)`, `withAuth()` 존재. 표준 타입 `ApiResponse<T> = { success, data?, error?, status? }` | **신규 API는 전부 `ok/fail/withAuth` 사용**. ad-hoc 형태 금지 |
| 인증 | `getAuthUserId(supabase)` → `auth.getUser()` 기반 UUID. `withAuth()`가 DB 미설정(503)·미인증(401)을 한번에 처리 | 신규 API 진입부는 `withAuth()`로 통일 |
| CSRF | **코드베이스에 전혀 없음**(csrf.ts 없음, X-CSRF-Token 미사용) | `src/lib/csrf.ts` **신규 작성**. 신규+재사용 변이 API에 가드 적용 (§4.2) |
| Supabase 클라 | `createServerSupabaseClient()`(쿠키·RLS), `createAdminSupabaseClient()`(service role·RLS우회), `createClient()`(브라우저) | 신규 쓰기는 RLS 우회 admin이 아니라 **인증 후 소유권 검증 + admin 쓰기**를 §3 규칙대로 |
| 결재 | **존재함** (위키는 구식). `040_approval_workflow.sql`, `approval_requests`(status: pending/approved/rejected), `approval_steps`(status: waiting/approved/rejected/delegated), `POST /api/approvals {documentId}`, `POST /api/approvals/[requestId]/decide {action,comment}` | 새 결재 테이블 생성 금지. 기존 흐름에 **연결만** |
| 결재선 | `src/lib/approval/build-line.ts` → `buildApprovalLine(requesterId, membersById, depth)`. step1=신청자 자동승인, 전결=`rank_level<=2` | 휴가원 상신도 동일 경로 사용 |
| 휴가원 템플릿 | `src/lib/templates/leave-application.ts`. `computeRemainingLeaveDays(hireDate, usedDays, baseDate)` — 1년 미만 max 11, 1년↑ 고정 15, 근속 가산·유효기간·승인 집계 없음 | §4 정책 함수(`src/lib/leave-policy/`)로 **대체·연결**. 기존 함수는 신규 정책 어댑터로 래핑 |
| 문서 생성 | `POST /api/documents`(201, `{document}`), `POST /api/generate`(201, `{document, format, downloadUrl...}`). `DOCUMENT_INPUTS`를 본문 HTML 주석으로 보관 | 생성 성공 후 서버에서 `leave_requests` 연결(§4.4). 레거시 응답 형태는 그대로 두되 **연결 훅만** 추가 |
| 사이드바 | `CORE_ITEMS`(항상노출: search/documents/files/approvals), `OPTIONAL_ITEMS`(sidebar_menus로 제어). `NavItem = {key,label,href,icon,badge?,description?}` | `CORE_ITEMS`에 `attendance` 추가 |
| 레이아웃 | `(app)/layout.tsx` → `AppLayout`(auth 초기화 useEffect 보유) | heartbeat hook을 **AppLayout에 1회만** 마운트 |
| users | `role`(admin/manager/user), `manager_user_id`, `rank_level`, `hire_date`, `is_active` 존재 | admin만 전체조회. manager 전체조회 금지 |
| audit | `recordAuditEvent(client, {userId,action,targetType,targetId,details})`. **실패를 무시(fire-and-forget)** | 보정 이력은 **await + 실패 시 보정 커밋 거부**(§4.3) |
| Electron | `electron/main.js`(loadURL `https://clioai.vercel.app`, contextIsolation:true, nodeIntegration:false), `preload.js`(electronAPI: isElectron/platform/파일 IPC 8종). **자동실행·heartbeat·tick 전부 없음** | §4.1 신규 추가 |
| 마이그레이션 | 최신 `044_monthly_expenses.sql` | 신규 = **`045_attendance_leave.sql`** |
| 타입 | `src/lib/supabase/supabase-db-types.ts`(DbUser/DbDocument/DbAuditLog 등), `supabase-app-types.ts`(ApiResponse) | 신규 Db 타입을 db-types에 추가 |

---

## 1. 아키텍처 및 컴포넌트 구조

### 1.1 전체 데이터 흐름

```
[Electron main.js]  OS 로그인 자동실행 + 3분 타이머(생존 tick)
      │ IPC (contextBridge, 승인 출처 검증)
      ▼
[preload.js] electronAPI.attendance.onHeartbeatTick(cb) / offHeartbeatTick / getAutoLaunch / setAutoLaunch
      │ (tick 신호만 전달, 토큰·세션 미전달)
      ▼
[useAttendanceHeartbeat hook]  ← AppLayout에 1회 마운트. 인증·CSRF 확인 후
      │ 동일 출처 fetch (쿠키 세션 + X-CSRF-Token)
      ▼
[POST /api/attendance/heartbeat]  서버 수신시각(UTC) 기준 일별 upsert (KST 날짜)
      ▼
[attendance_records]  UNIQUE(user_id, work_date), first/last 원자 갱신

[/attendance 페이지]
  ├─ useAttendance()        조회·보정 (GET /api/attendance, PATCH /api/attendance/[workDate])
  ├─ useLeaveRequests()     휴가 신청·연결·상신 (POST/PATCH /api/leave-requests, POST /api/approvals)
  └─ useLeaveBalance()      연차 집계 (GET /api/leave-requests/balance)
                                  │ 서버에서 src/lib/leave-policy 순수함수로 계산
                                  ▼
                            [leave_requests] + [users.hire_date] + [approval_requests.status]
```

### 1.2 파일 분리 계획 (플랫폼 절대규칙 — 페이지 500줄·단일책임·폴더역할)

**프론트엔드 (Claude 담당)**

| 경로 | 책임 | 종류 | 예상 줄수 |
| --- | --- | --- | --- |
| `src/app/(app)/attendance/page.tsx` | 조립·진입만. 데이터 로직·계산 없음 | 페이지 | ≤150 |
| `src/components/attendance/AttendanceSummaryCard.tsx` | 오늘 출근/퇴근 기준·마지막 heartbeat·연결 상태 | UI | ≤150 |
| `src/components/attendance/AttendanceMonthlyList.tsx` | 월별 기록 목록(날짜·유효 출퇴근·원본·보정표시) | UI | ≤200 |
| `src/components/attendance/AttendanceCorrectionModal.tsx` | 보정 입력 모달(시각·사유), 제출→PATCH | UI | ≤200 |
| `src/components/attendance/LeaveBalanceCard.tsx` | 연차 카드(부여·차감·예약·잔여·전제) | UI | ≤150 |
| `src/components/attendance/LeaveRequestList.tsx` | 휴가 목록(종류/기간/상태/문서링크) | UI | ≤200 |
| `src/components/attendance/LeaveRequestForm.tsx` | 휴가 신청 폼(종류/기간/반차/사유)→문서생성 진입 | UI | ≤250 |
| `src/components/attendance/AdminAttendancePanel.tsx` | admin 전용 전직원 조회(직원·기간 필터·페이지네이션) | UI | ≤250 |
| `src/components/attendance/DesktopAutoLaunchSetting.tsx` | Electron 전용 자동실행 ON/OFF (웹에서 숨김) | UI | ≤120 |
| `src/hooks/use-attendance.ts` | 근태 조회·필터·보정 요청·갱신 상태 | hook | ≤200 |
| `src/hooks/use-attendance-heartbeat.ts` | Electron tick 구독·인증/CSRF·전송·backoff·정리 | hook | ≤200 |
| `src/hooks/use-leave-requests.ts` | 휴가 신청·문서연결·상신·잔여 갱신 | hook | ≤200 |
| `src/hooks/use-leave-balance.ts` | 잔여/예약/신청가능량 조회 상태 | hook | ≤120 |
| `src/types/attendance.ts` | 프론트·API 공용 타입(§2.3 재노출) | types | ≤120 |

**백엔드 (Codex 담당)**

| 경로 | 책임 | 종류 |
| --- | --- | --- |
| `supabase/migrations/045_attendance_leave.sql` | 테이블·인덱스·제약·RLS (§2) | 마이그레이션 |
| `src/lib/supabase/supabase-db-types.ts` (수정) | `DbAttendanceRecord`, `DbLeaveRequest` 추가 (§2.3) | types |
| `src/lib/csrf.ts` | CSRF 토큰 발급·검증·세션 결합 (§4.2) | 보안 유틸 |
| `src/lib/http/mutation-guard.ts` | `withMutation()` = withAuth + CSRF + Origin 검증 래퍼 | 보안 유틸 |
| `src/lib/attendance/attendance-service.ts` | heartbeat upsert·보정·조회 (DB 원자 처리, 소유권) | 서비스 |
| `src/lib/attendance/attendance-validation.ts` | 날짜/시각/사유/버전 서버 검증 (순수) | 검증 |
| `src/lib/leave/leave-service.ts` | 휴가 신청 생성·문서연결·상신 연동·상태 동기화 | 서비스 |
| `src/lib/leave/leave-validation.ts` | 종류/기간/반차/멱등키 서버 검증 (순수) | 검증 |
| `src/lib/leave-policy/accrual.ts` | 입사일→부여 구간(발생일·만료일·발생량) 순수함수 | 정책 |
| `src/lib/leave-policy/deduction.ts` | 승인 휴가를 유효 구간에 배분·차감·예약 집계 순수함수 | 정책 |
| `src/lib/leave-policy/workdays.ts` | 근무일 계산(주말·공휴일·회사휴무 제외)·반차 분할 | 정책 |
| `src/lib/leave-policy/types.ts` | 정책 입출력 타입·`POLICY_VERSION` 상수 | 정책 |
| `src/lib/leave-policy/index.ts` | `computeLeaveBalance()` 집계 진입점 | 정책 |
| `src/app/api/csrf/route.ts` | GET CSRF 토큰 발급 | 라우트 |
| `src/app/api/attendance/route.ts` | GET 본인 근태 조회 | 라우트 |
| `src/app/api/attendance/heartbeat/route.ts` | POST 생존 기록 | 라우트 |
| `src/app/api/attendance/[workDate]/route.ts` | PATCH 보정/복원/수동생성 | 라우트 |
| `src/app/api/attendance/admin/route.ts` | GET admin 전직원 조회 | 라우트 |
| `src/app/api/leave-requests/route.ts` | GET 목록 / POST 초안 생성 | 라우트 |
| `src/app/api/leave-requests/[id]/route.ts` | PATCH 초안 수정·연결 재시도 | 라우트 |
| `src/app/api/leave-requests/balance/route.ts` | GET 잔여 집계 | 라우트 |
| `electron/main.js` (수정) | 자동실행·단일인스턴스·3분 타이머·종료/절전 처리 | Electron |
| `electron/preload.js` (수정) | `electronAPI.attendance.*` 최소 노출 | Electron |

> 라우트는 **얇게** 유지한다: `withMutation()/withAuth()` → 검증(validation 모듈) → 서비스 호출 → `ok/fail`. 비즈니스 로직은 `src/lib/**`에만 둔다. (단일 책임)

### 1.3 Electron 계층 설계 원칙

- main.js가 **타이머 소유자**다. 3분마다 tick을 renderer로 보낸다. 실제 HTTP는 renderer가 쿠키·CSRF로 수행한다. **세션/서비스키를 main·preload에 저장·복사하지 않는다.**
- preload는 `attendance` 네임스페이스에 **최소 메서드만** 노출. IPC `sender` URL을 승인된 웹앱 출처(`https://clioai.vercel.app`)로 검증한 뒤에만 tick 송신.
- 단일 인스턴스(`app.requestSingleInstanceLock()`)로 타이머 중복 방지.
- MVP: **창 닫기 = heartbeat 중단**. macOS도 `window-all-closed` 시 타이머·상태 정리 후 `app.quit()`으로 통일(기존 darwin 예외 제거).

---

## 2. 데이터 모델

### 2.1 마이그레이션 `045_attendance_leave.sql`

```sql
-- ============================================================
-- 045_attendance_leave.sql — 근태관리(attendance) + 휴가신청(leave_requests)
-- 선행: 015(hire_date), 039(org_chart), 040(approval_workflow)
-- ============================================================

-- 1) 사용자별 일별 근태 ------------------------------------------------
create table if not exists public.attendance_records (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.users(id) on delete cascade,
  work_date           date not null,                       -- KST 기준 근무 날짜
  first_heartbeat_at  timestamptz,                         -- 서버 수신 UTC, 수동생성 시 null 가능
  last_heartbeat_at   timestamptz,
  heartbeat_count     integer not null default 0 check (heartbeat_count >= 0),
  manual_check_in_at  timestamptz,                         -- 보정값(heartbeat 원본과 독립)
  manual_check_out_at timestamptz,
  correction_reason   text,
  corrected_at        timestamptz,
  corrected_by        uuid references public.users(id) on delete set null,
  version             integer not null default 1,          -- 낙관적 동시수정 제어
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint attendance_unique_user_date unique (user_id, work_date),
  constraint attendance_hb_order
    check (first_heartbeat_at is null or last_heartbeat_at is null
           or first_heartbeat_at <= last_heartbeat_at),
  constraint attendance_manual_order
    check (manual_check_in_at is null or manual_check_out_at is null
           or manual_check_in_at <= manual_check_out_at),
  constraint attendance_reason_len
    check (correction_reason is null or char_length(correction_reason) <= 500)
);

create index if not exists idx_attendance_user_date
  on public.attendance_records (user_id, work_date desc);

-- 2) 구조화된 휴가 신청 + 문서/결재 연결 --------------------------------
create table if not exists public.leave_requests (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.users(id) on delete cascade,
  document_id          uuid references public.documents(id) on delete restrict,   -- 승인자료 보호
  approval_request_id  uuid references public.approval_requests(id) on delete restrict,
  leave_type           text not null
                         check (leave_type in ('annual','monthly','half_day','menstrual')),
  start_date           date not null,
  end_date             date not null,
  half_day_slot        text check (half_day_slot in ('am','pm')),
  requested_days       numeric(4,1) not null check (requested_days >= 0),
  deduct_days          numeric(4,1) not null check (deduct_days >= 0),
  status               text not null default 'draft'
                         check (status in ('draft','pending','approved','rejected')),
  reason               text check (reason is null or char_length(reason) <= 1000),
  policy_version       text not null,
  calculation_snapshot jsonb not null default '{}'::jsonb,  -- 근무일·구간별 배분·당시 잔여
  idempotency_key      text not null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint leave_date_order check (start_date <= end_date),
  -- 반차는 단일 근무일 + 슬롯 필수, 그 외는 슬롯 null
  constraint leave_halfday_rule check (
    (leave_type = 'half_day' and start_date = end_date and half_day_slot is not null)
    or (leave_type <> 'half_day' and half_day_slot is null)
  ),
  -- 생휴는 단일 근무일, 차감 0
  constraint leave_menstrual_rule check (
    leave_type <> 'menstrual' or (start_date = end_date and deduct_days = 0)
  ),
  -- 문서 연결 후 유일(초안 null 다건 허용은 partial unique로)
  constraint leave_idem_unique unique (user_id, idempotency_key)
);

-- 연결된 문서는 휴가 1건에만 (연결 후 유일) — null 제외 partial unique
create unique index if not exists uniq_leave_document
  on public.leave_requests (document_id) where document_id is not null;

create index if not exists idx_leave_user_status
  on public.leave_requests (user_id, status);
create index if not exists idx_leave_user_dates
  on public.leave_requests (user_id, start_date, end_date);
create index if not exists idx_leave_approval
  on public.leave_requests (approval_request_id) where approval_request_id is not null;

-- 3) updated_at 자동 갱신 트리거 (기존 프로젝트 패턴 따름) ---------------
create or replace function public.touch_updated_at()
  returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_attendance_touch on public.attendance_records;
create trigger trg_attendance_touch before update on public.attendance_records
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_leave_touch on public.leave_requests;
create trigger trg_leave_touch before update on public.leave_requests
  for each row execute function public.touch_updated_at();
```

> ⚠️ Codex 확인: `public.touch_updated_at()`가 이전 마이그레이션에 이미 정의됐으면 재정의부를 생략하고 트리거만 건다. 운영 적용 전 중복 함수 여부 확인.

### 2.2 RLS 정책 (§3 보안의 DB 계층)

```sql
alter table public.attendance_records enable row level security;
alter table public.leave_requests    enable row level security;

-- SELECT: 본인 또는 admin 만 (manager 자동 허용 금지)
create policy attendance_select_own_or_admin on public.attendance_records
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.users u
               where u.id = auth.uid() and u.role = 'admin')
  );
create policy leave_select_own_or_admin on public.leave_requests
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.users u
               where u.id = auth.uid() and u.role = 'admin')
  );

-- INSERT/UPDATE/DELETE: 브라우저 직접 쓰기 전면 거부.
-- 모든 쓰기는 API(인증+CSRF 통과) → createAdminSupabaseClient(service role)로만 수행.
-- (authenticated INSERT RLS를 열면 CSRF API를 우회해 승인상태·원본시각 위조 가능 → 정책상 금지)
-- → INSERT/UPDATE/DELETE 용 policy를 만들지 않음 = authenticated/anon 쓰기 불가.
```

**쓰기 경로 계약 (중요):**
- 신규 두 테이블의 모든 INSERT/UPDATE/DELETE는 **API 라우트에서 인증·CSRF·소유권·권한을 먼저 검증한 뒤 `createAdminSupabaseClient()`로 실행**한다.
- service role은 RLS를 우회하므로 **라우트가 소유권(user_id=인증결과)·활성사용자·admin 권한을 코드로 반드시 검증**한다. user_id는 **클라이언트 입력을 신뢰하지 않고 인증 결과로 서버에서 설정**한다.

### 2.3 타입 정의 (`src/lib/supabase/supabase-db-types.ts`에 추가)

```typescript
export type LeaveType = 'annual' | 'monthly' | 'half_day' | 'menstrual';
export type LeaveStatus = 'draft' | 'pending' | 'approved' | 'rejected';
export type HalfDaySlot = 'am' | 'pm';

export type DbAttendanceRecord = Record<string, unknown> & {
  id: string;
  user_id: string;
  work_date: string;                 // 'YYYY-MM-DD' (KST)
  first_heartbeat_at: string | null; // ISO UTC
  last_heartbeat_at: string | null;
  heartbeat_count: number;
  manual_check_in_at: string | null;
  manual_check_out_at: string | null;
  correction_reason: string | null;
  corrected_at: string | null;
  corrected_by: string | null;
  version: number;
  created_at: string;
  updated_at: string;
};

export type DbLeaveRequest = Record<string, unknown> & {
  id: string;
  user_id: string;
  document_id: string | null;
  approval_request_id: string | null;
  leave_type: LeaveType;
  start_date: string;                // 'YYYY-MM-DD'
  end_date: string;
  half_day_slot: HalfDaySlot | null;
  requested_days: number;
  deduct_days: number;
  status: LeaveStatus;
  reason: string | null;
  policy_version: string;
  calculation_snapshot: Record<string, unknown>;
  idempotency_key: string;
  created_at: string;
  updated_at: string;
};
```

### 2.4 API 공용 뷰 타입 (`src/types/attendance.ts` — 프론트·백 공용)

```typescript
// 화면에 내려주는 '유효 출퇴근'은 보정값 우선, 없으면 heartbeat.
export interface AttendanceDayView {
  workDate: string;                 // KST 'YYYY-MM-DD'
  effectiveCheckIn: string | null;  // ISO UTC — 유효 출근(보정>heartbeat)
  effectiveCheckOut: string | null; // 유효 퇴근
  source: 'auto' | 'manual' | 'mixed' | 'none';
  firstHeartbeatAt: string | null;
  lastHeartbeatAt: string | null;
  heartbeatCount: number;
  isCorrected: boolean;
  correctionReason: string | null;
  isSingleSignal: boolean;          // 당일 1회만 수신(최초=마지막)
  isToday: boolean;                 // true면 퇴근 '갱신 중'
  version: number;
}

export interface LeaveRequestView {
  id: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  halfDaySlot: HalfDaySlot | null;
  requestedDays: number;
  deductDays: number;
  status: LeaveStatus;
  reason: string | null;
  documentId: string | null;
  approvalRequestId: string | null;
  createdAt: string;
}

// 연차 집계 응답 (GET /api/leave-requests/balance)
export interface LeaveBalanceView {
  hireDate: string | null;
  asOf: string;                     // 기준일 KST
  computable: boolean;              // 입사일 없음/미래/오류 시 false
  reason?: 'no_hire_date' | 'future_hire_date' | 'invalid_date';
  policyVersion: string;
  grants: Array<{                   // 유효 부여 구간
    grantedOn: string;
    expiresOn: string;
    grantedDays: number;
    deductedDays: number;           // 이 구간에 배분된 승인 차감
    remainingDays: number;
  }>;
  totalGranted: number;
  totalDeducted: number;            // 승인(전결 포함, 예정 포함) 차감 합
  reservedDays: number;             // 대기(pending) 예약량
  remainingDays: number;            // totalGranted - totalDeducted
  requestableDays: number;          // remainingDays - reservedDays
  assumptionNote: string;           // '개근·출근율80% 충족 전제' 등 계산 전제
}
```

### 2.5 유효 출퇴근 결정 규칙 (서버 공통 — 양측 동일 해석)

```
effectiveCheckIn  = manual_check_in_at  ?? first_heartbeat_at
effectiveCheckOut = manual_check_out_at ?? last_heartbeat_at
source =
  (manual_in && manual_out) ? 'manual'
  : (manual_in || manual_out) ? 'mixed'
  : (first_heartbeat_at) ? 'auto'
  : 'none'
```
- 보정값이 있으면 **이후 heartbeat가 와도 보정값을 덮지 않는다.** heartbeat는 `first/last_heartbeat_at`만 갱신.
- 당일(`isToday`) 퇴근은 '갱신 중' 표시. 다음날부터 전날 `last`를 고정 표시.

---

## 3. 보안 설계 (RLS·인증·CSRF)

### 3.1 변이 가드 `withMutation()` (신규)

모든 변이(POST/PUT/PATCH/DELETE)의 **공통 진입 계약**. `src/lib/http/mutation-guard.ts`.

```typescript
// 반환: 성공 시 {supabase(쿠키), admin(service role), userId}, 실패 시 {error: NextResponse}
export async function withMutation(request: NextRequest): Promise<
  | { supabase: SupabaseClient<Database>; admin: SupabaseClient<Database>; userId: string; error: null }
  | { error: NextResponse; supabase: null; admin: null; userId: null }
>;
```
처리 순서(하나라도 실패 시 즉시 반환):
1. `withAuth()` — DB 미설정 503 / 미인증 401
2. **Origin 검증** — `Origin`(또는 `Referer`) 헤더가 허용 출처 집합(`https://clioai.vercel.app` 등 + 개발 origin)에 속하지 않으면 403. Origin 누락은 거부(무조건 허용 금지).
3. **CSRF 검증** — `X-CSRF-Token` 헤더를 `src/lib/csrf.ts`의 `verifyCsrfToken(token, session)`로 검증. 없음/불일치/만료 403.
4. Electron 여부·User-Agent로 **면제하지 않는다.**

### 3.2 CSRF (`src/lib/csrf.ts`, 신규)

- `issueCsrfToken(userId, sessionId)`: 세션에 결합된 서명 토큰 발급(HMAC, `JWT_SECRET` 또는 전용 시크릿 사용). 만료 포함.
- `verifyCsrfToken(token, ctx)`: 서명·만료·세션 결합 검증. boolean.
- 토큰은 `GET /api/csrf`로 발급하며 HTTPS·SameSite 쿠키 정책과 병행. GET에는 데이터 변이를 넣지 않는다.
- Electron도 동일 웹앱 URL·동일 CSRF 흐름 사용.

### 3.3 조회 보안

- GET도 인증·소유권 검증. 타인 `userId` 지정으로 범위 확장 불가(admin 라우트 제외).
- 개인 응답 헤더: `Cache-Control: private, no-store`.
- admin 조회(`/api/attendance/admin`)는 **서버에서 `users.role='admin'` 재검증** + 기간 상한 + 페이지네이션. 일반 사용자 fallback 금지. manager 전체조회 불가.

### 3.4 재사용 변이 API에도 동일 가드 적용 (출시 조건)

기획서 요구대로 신규 외에 **연결 경로의 기존 변이 API에도 CSRF·Origin 가드를 도입**한다. 적용 대상 목록(출시 전 체크):
- `/api/generate`, `/api/documents`(POST/PUT/DELETE), 문서 수정/삭제 경로
- `/api/approvals`(POST), `/api/approvals/[requestId]/decide`(POST)

> ⚠️ 이는 기존 동작에 영향을 주므로, 프론트의 모든 변이 호출이 `X-CSRF-Token`을 싣도록 공통 fetch 래퍼(§5)를 먼저 배포한 뒤 서버 가드를 켠다. 전환 중 깨짐 방지를 위해 **프론트 래퍼 적용 → 서버 가드 활성화** 순서를 지킨다.

### 3.5 heartbeat 빈도 제한

- 사용자별 빈도 제한(예: 분당 상한). 정상 다중 기기 요청은 수용. 위조 신호 완전 차단은 MVP 밖 → 보정·감사로 보완.

---

## 4. 기능별 상세 설계

### 4.1 자동실행 + heartbeat

- `app.setLoginItemSettings({ openAtLogin })` 적용(설치 앱 한정, 개발 실행과 구분). 실패 시 UI에 표시.
- main이 3분(`HEARTBEAT_INTERVAL_MS = 180_000`) 타이머로 tick 송신. 인증 완료 직후 renderer가 즉시 1회 전송. 생존 누락 안내 기준 6분(2회).
- renderer(`useAttendanceHeartbeat`)가 쿠키+CSRF로 `POST /api/attendance/heartbeat` 호출. 서버가 **수신시각(UTC)** 기록, 근무 날짜는 `Asia/Seoul`로 산정. 클라 시각·날짜·user_id **불신**.
- 서버 upsert(원자): `work_date` 기준 `first`는 유지(coalesce), `last`는 갱신, `heartbeat_count += 1`. 여러 기기도 일별 1건 합산.
- 미인증/로그아웃/세션만료 시 중단, 재인증 후 재개. 계정 전환 시 이전 타이머·요청 폐기. 인증 실패 무한재시도 금지.
- 네트워크 실패는 지수 backoff. 오프라인 과거분 일괄 재전송 안 함. 복귀 시 현재시각 재개.

### 4.2 수동 보정 (`PATCH /api/attendance/[workDate]`)

- 본인 행만. 신호 없는 날도 수동 생성 가능.
- 서버 검증: 출근≤퇴근, 미래 근무일 금지, 보정 시각의 KST 날짜가 `workDate`와 일치, 사유 필수·길이(≤500). 자정 넘는 교대 미지원.
- 동시 수정: 요청의 `version`(또는 `updatedAt`)과 DB 불일치 시 409.
- **감사 이력 필수 보장**: 변경자·변경시각·이전/이후 값·사유를 `audit_logs`에 `action:'attendance.correct'`로 기록하되, **기존 fire-and-forget이 아니라 await하고 실패 시 보정 커밋을 거부**(500/503)한다. (CLAUDE.md 규칙 0-5 수명주기·비정상경로)
- 자동값 복원도 명시적 보정 동작(인증+CSRF). manual_* 를 null로 되돌림 + 사유 기록.

### 4.3 휴가 신청 + 문서·결재 연결

**두 진입점, 하나의 연결 경로:**
1. `/attendance` 휴가 신청 폼 → 휴가원 템플릿 + 본인정보 프리필 → 문서 생성 서비스
2. 기존 `새 문서 → 휴가원` 직접 생성

두 경로 모두 **문서 생성 성공 후 서버가 소유자·휴가원 종류를 확인하고 `leave_requests`에 연결**(단순 링크 아님, 생성 서비스에 연결 훅). 기존 자유입력 `used_leave_days`는 **표시용**이며 차감 원장으로 쓰지 않는다.

**차감 규칙 (서버 계산):**

| 종류 | 입력 규칙 | deduct_days |
| --- | --- | --- |
| annual(연차) | 유효 근무일 기간 | 근무일당 1 |
| monthly(월차) | 1년 미만 월발생분 사용 명칭 | 동일 연차 원장, 근무일당 1 (중복부여 없음) |
| half_day(반차) | 단일 근무일 + am/pm 필수 | 0.5 |
| menstrual(생휴) | 단일 근무일, 월별 중복 검증 | 0 |

- 일수는 **근무일 캘린더**(월~금 − 공휴일·회사휴무)로 계산. 단순 날짜차 금지. 캘린더 데이터 출처는 출시 전 확정(§6).
- 겹침 거부: 같은 시간대 pending/approved 겹치면 409. 오전/오후 반차는 슬롯 비교로 상호 허용.
- 상신: `POST /api/approvals {documentId}` 사용. 성공 시 `approval_request_id` 연결, status `pending`. 조직도 상위자 누락 실패 시 `draft` 유지.
- **차감 시점**: 중간 승인 무차감. `approval_requests.status='approved'`(최종 승인 또는 전결)만 차감 대상. 반려 무차감. **반복요청 누적 금지 — 승인된 고유 신청에서 재집계.**
- 상태 동기화: `approval_requests`를 권위 데이터로 보고 `leave_requests.status`를 **공통 트랜잭션/트리거로 동기화**, 조회 시 불일치 탐지.
- 상신 후 신청자·기간·종류·차감량·연결문서 잠금. 반려 후 재상신은 같은 휴가 신청에 새 결재건 연결(과거 이력 보존).
- 부분 실패(생성/연결/상신) 재시도 가능: `idempotency_key`(사용자별 유일) + `document_id` partial unique로 중복 차단. 연결 실패 문서는 상신 불가(서버 검증).
- 삭제 보호: 연결 문서/결재의 삭제는 RLS·FK `on delete restrict`로 막아 승인 차감 유실 방지. 승인 문서 수정·버전 생성도 승인 휴가 데이터 불변.
- MVP: 승인 휴가 본인 삭제·철회 불가(후속).

### 4.4 표준 연차 계산 (`src/lib/leave-policy/`, 순수 함수)

입력: `hire_date`, KST 기준일, `POLICY_VERSION`, 근무일 캘린더, 승인 휴가 내역.
출력: 발생일·만료일·발생량·차감량·잔여량·근거(= `LeaveBalanceView`).

- 1년 미만: 1개월 개근당 1일, 최초 1년 최대 11.
- 1년 이상: `grantedDays(Y) = min(25, 15 + floor((Y-1)/2))` (1·2년 15, 3·4년 16, 5·6년 17, 21년↑ 25).
- `잔여 = 현재 유효 부여량 − 해당 구간 배분 승인 차감량`. 입사 이후 전체를 15에서 빼지 않는다.
- 만료 빠른 발생분부터 사용일에 배분. 미래 승인 휴가도 즉시 차감(화면 '승인 차감(예정 포함)') + 예약 별도 표시.
- 기념일·연말 가로지르는 휴가는 근무일별 분할해 각 구간 차감. 월차 명칭으로 만1년시 월발생분+새15 **중복합산 금지**.
- 입사일 누락/오류/미래 → `computable:false` + 사유. 0일로 확정하지 않음.
- 윤년 2/29·월말 입사자 기념일 보정 규칙을 함수에 **명시**하고 인사 확인 후 고정(§6).
- 0.5일 단위, DB `numeric`. 잔여 부족 신청·승인 거부. 음수는 숨기지 않고 불일치로 표시.
- 입사일 변경 시 서버 재계산 + 변경 이력. 과거 승인 문서의 당시 잔여는 `calculation_snapshot` 스냅샷 유지.
- 기존 `computeRemainingLeaveDays`·미리보기·렌더러 호출부를 **동일 정책에 연결**(어댑터). `used/remaining_leave_days`는 서버 집계 스냅샷, 사용자 입력 불신.

**경합 방지:** `신청 가능량 = 잔여 − 대기 예약량`. 신청·최종승인 시 **사용자 단위 잠금**(`SELECT ... FOR UPDATE` 또는 advisory lock)으로 재검증. 예약량과 승인 차감 혼동 금지.

---

## 5. API 스펙

공통: 응답 `{ success, data?, error? }`. 코드 — **401** 미인증, **403** CSRF/Origin/권한, **400** 입력오류, **409** 중복·경합·잔여부족, **503** DB미설정/일시장애. 개인 조회 `Cache-Control: private, no-store`.

> 프론트는 **공통 fetch 래퍼**(가칭 `lib/http/api-client`)로 변이 요청 시 `X-CSRF-Token`·`credentials:'include'`를 자동 첨부한다. GET은 토큰 불필요.

### `GET /api/csrf`
- **인증:** 필요 · **CSRF:** 불필요(발급 엔드포인트)
- **Query:** 없음
- **성공 200:** `{ success:true, data:{ token:string, expiresAt:string } }`
- **실패:** 401

### `GET /api/attendance?from=YYYY-MM-DD&to=YYYY-MM-DD`
- **인증:** 필요(본인) · **CSRF:** 불필요(GET)
- **Query:** `from`,`to` (KST date, 필수, 기간 상한 예: 92일). 초과 시 400.
- **성공 200:** `{ success:true, data:{ days: AttendanceDayView[] } }`
- **실패:** 400(기간)·401

### `POST /api/attendance/heartbeat`
- **인증:** 필요(본인) · **CSRF:** 필요 · **빈도제한:** 적용
- **Request body:** `{}` (서버가 수신시각·user_id·날짜 결정. 클라 값 무시)
- **성공 200:** `{ success:true, data:{ workDate:string, firstHeartbeatAt:string, lastHeartbeatAt:string, heartbeatCount:number } }`
- **실패:** 401 · 403(CSRF/Origin) · 429(빈도초과) · 503

### `PATCH /api/attendance/[workDate]`
- **인증:** 필요(본인) · **CSRF:** 필요
- **Path:** `workDate` = KST `YYYY-MM-DD`
- **Request body:**
  ```typescript
  {
    mode: 'correct' | 'restore';     // restore = 자동값 복원(manual_* null화)
    checkInAt?: string | null;       // ISO, mode='correct'
    checkOutAt?: string | null;
    reason: string;                  // 필수, ≤500
    version: number;                 // 낙관적 잠금(없는 날 생성 시 0)
  }
  ```
- **성공 200:** `{ success:true, data: AttendanceDayView }`
- **실패:** 400(출근>퇴근·미래·날짜불일치·사유누락) · 401 · 403 · 404(타인/없음) · 409(version 충돌/감사기록 실패)

### `GET /api/attendance/admin?userId=&from=&to=&page=&pageSize=`
- **인증:** 필요 + **admin 서버 재검증** · **CSRF:** 불필요(GET)
- **Query:** `userId`(선택, 미지정 시 전체), `from`,`to`(필수·기간상한), `page`(기본1), `pageSize`(기본20·상한100)
- **성공 200:** `{ success:true, data:{ rows: Array<{ userId, userName, department, days: AttendanceDayView[] }>, total:number, page:number, pageSize:number } }`
- **실패:** 401 · 403(비admin) · 400

### `GET /api/leave-requests?status=&from=&to=`
- **인증:** 필요(본인) · **CSRF:** 불필요
- **Query:** `status?`(LeaveStatus), `from?`,`to?`. admin 전체조회는 **명시 파라미터 + 서버 범위검증** 시만.
- **성공 200:** `{ success:true, data:{ requests: LeaveRequestView[] } }`
- **실패:** 401 · 403

### `POST /api/leave-requests`
- **인증:** 필요(본인) · **CSRF:** 필요 · **멱등:** `idempotency_key`
- **Request body:**
  ```typescript
  {
    leaveType: LeaveType;
    startDate: string; endDate: string;   // 'YYYY-MM-DD'
    halfDaySlot?: 'am' | 'pm';            // half_day 필수
    reason?: string;                       // ≤1000
    idempotencyKey: string;                // 클라 생성 재시도 키
    documentId?: string;                   // 이미 생성된 휴가원 문서 연결 시
  }
  ```
- **동작:** 근무일·차감량 서버 계산 → 겹침·잔여 검증(사용자 잠금) → `draft` 생성(또는 `documentId` 연결). `requested_days/deduct_days/policy_version/calculation_snapshot`는 서버가 채움.
- **성공 201:** `{ success:true, data: LeaveRequestView }`
- **실패:** 400(종류/날짜/반차슬롯) · 401 · 403 · 409(기간 겹침·잔여부족·멱등키 중복은 기존 건 반환)

### `PATCH /api/leave-requests/[id]`
- **인증:** 필요(본인·소유) · **CSRF:** 필요
- **Path:** `id`
- **Request body:**
  ```typescript
  {
    action: 'update' | 'link_document' | 'submit';
    // update: 상신 전 draft 수정
    leaveType?: LeaveType; startDate?: string; endDate?: string;
    halfDaySlot?: 'am'|'pm'; reason?: string;
    // link_document: 생성된 문서 연결 재시도
    documentId?: string;
    // submit: 상신 → 내부적으로 POST /api/approvals {documentId} 호출, approval_request_id 연결
  }
  ```
- **성공 200:** `{ success:true, data: LeaveRequestView }`
- **실패:** 400 · 401 · 403 · 404 · 409(상태 불가: 이미 pending/approved — 잠금됨 / 조직도 상신 실패 시 draft 유지 메시지)

### `GET /api/leave-requests/balance?asOf=YYYY-MM-DD`
- **인증:** 필요(본인) · **CSRF:** 불필요
- **Query:** `asOf?`(기본 오늘 KST, 범위 검증)
- **성공 200:** `{ success:true, data: LeaveBalanceView }` (입사일 없음도 200, `computable:false`)
- **실패:** 400(asOf 범위) · 401

### 기존 재사용 API (변경 범위 = CSRF 가드 + 연결 훅만)
| API | 변경점 |
| --- | --- |
| `POST /api/generate`, `POST/PUT/DELETE /api/documents*` | `withMutation`(CSRF·Origin) 적용. 휴가원 생성 성공 시 leave 연결 훅 |
| `POST /api/approvals` | `withMutation` 적용. 휴가원 상신 시 호출 (body `{documentId}` 불변) |
| `POST /api/approvals/[requestId]/decide` | `withMutation` 적용. 승인·전결 시 `leave_requests.status` 동기화 훅 |

---

## 6. 구현 순서 (백엔드 → UI)

> 기획서 §6 순서(정책/이관 → 인증·CSRF/DB → heartbeat·보정 → 휴가·연차 → UI/관리자 → 검증)를 지킨다.

### Phase A — 선행 정책 확정 (코드 전, 대장/인사 확인 — §7)
1. 월차 의미·근무일 캘린더 출처·연차 전제·기존 승인 사용분 이관 기준·출시 기준일 확정.

### Phase B — 백엔드 기반 (Codex)
2. `045_attendance_leave.sql` + RLS 작성, **로컬 적용 후 운영 적용 여부 별도 확인**(규칙 0-1).
3. `supabase-db-types.ts`에 `DbAttendanceRecord`/`DbLeaveRequest`/`src/types/attendance.ts` 추가.
4. `src/lib/csrf.ts` + `src/lib/http/mutation-guard.ts`(`withMutation`) 작성.
5. `src/lib/leave-policy/*` 순수함수 + 단위 검증(1년미만/경계/근속가산/만료/분할/반차/생휴/윤년·월말).

### Phase C — 백엔드 API (Codex)
6. `GET /api/csrf`.
7. `attendance-service`·`attendance-validation` → `GET /api/attendance`, `POST heartbeat`, `PATCH [workDate]`, `GET admin`.
8. `leave-service`·`leave-validation` → `GET/POST /api/leave-requests`, `PATCH [id]`, `GET balance`.
9. 기존 `/api/generate`·documents·approvals·decide에 `withMutation` + 연결/동기화 훅.

### Phase D — Electron (Codex)
10. `main.js` 자동실행·단일인스턴스·3분 타이머·종료/절전/계정전환, `preload.js` `electronAPI.attendance.*` 최소 노출 + sender 출처 검증.

### Phase E — 프론트엔드 (Claude) — B/C가 타입·API를 노출한 뒤 착수
11. 공통 fetch 래퍼(X-CSRF-Token 자동 첨부) → **서버 가드 활성화 전 선배포**(§3.4).
12. `use-attendance-heartbeat` → `AppLayout`에 1회 마운트 (Electron에서만 tick 구독, 웹은 비활성).
13. `use-attendance`/`use-leave-requests`/`use-leave-balance`.
14. `/attendance/page.tsx` + `components/attendance/*` (각 파일 500줄 이하).
15. 사이드바 `CORE_ITEMS`에 `{key:'attendance', label:'근태관리', href:'/attendance', icon:…, description:'출퇴근·휴가·연차'}` 추가.
16. 상태 처리: 로딩·빈데이터·연결실패·입사일누락·잔여불일치·CSRF만료·단일신호·웹 안내.

### Phase F — 통합 검증 (양측)
17. 기획서 §7 수용 기준 전수 검증. 특히 **설치 앱 실환경**(macOS arm64/x64·Windows x64) 자동실행·절전·창닫기, 보안(미인증/토큰누락/위조/타출처/직접DB쓰기 거부), 권한별(본인/admin/manager차단), 회귀(기존 문서·결재·다운로드 유지).

### 병렬·의존성 요약
- Codex Phase B→C→D 순차. Phase B(3,4)와 Phase E(11,12 뼈대)는 **타입·API 계약(§2,§5) 확정 후 병렬 가능**.
- 프론트는 실제 API 완성 전 **이 문서의 타입/응답 형태로 목업** 후, C 완료 시 연결.

---

## 7. 구현 전 확정 필요 정책 (대장/인사 확인 — 미확정 시 기본 제안 사용)

| 정책 | 기본 제안 | 확인 필요 |
| --- | --- | --- |
| 연차 운영 기준 | 입사일 기준, 요건충족 가정 표준값 | 회계연도 기준 여부, 예외 확정값 관리 |
| 월차 | 1년미만 발생분 신청 명칭 | 별도 월차 부여 시 정책 분리 |
| 근무일 캘린더 | 월~금 − 공휴일·회사휴무 | **데이터 출처·관리주체**(설계 미확정 핵심) |
| 자동 기록 | 3분, 수신시각, 창닫기 중단 | OS 설정 안내·최소화 기대동작 |
| 미래 휴가 | 사용일 구간 예약 | 미발생 연차 선사용 허용 여부 |
| 기존 승인 사용분 | 검증 이관 후 잔여 확정 | 출시 기준일·누락 사용분 |
| 윤년·월말 입사 | 정책함수에 보정규칙 명시 | 인사 확정값 |

---

## 8. 절대규칙 준수 체크리스트

### 8.1 플랫폼 5대 원칙 (설계 반영 확인)

```
─────────────────────────────────────────────────
📋 플랫폼 개발 원칙 점검 (설계 단계)
─────────────────────────────────────────────────
1. 페이지 500줄 제한 : ✅ /attendance/page.tsx ≤150줄로 조립만.
                        모든 신규 파일 예상 줄수 명시(§1.2, 전부 ≤250)
2. 단일 책임         : ✅ UI(components) / 상태(hooks) / 계산(lib/leave-policy) /
                        서비스(lib/attendance·leave) / 검증(validation) /
                        라우트(얇게) 분리. 라우트에 비즈니스 로직 금지
3. 서버 검증·보안    : ✅ 모든 변이 withMutation(인증+CSRF+Origin).
                        user_id는 인증결과로 서버 설정(클라 불신).
                        RLS SELECT 본인/admin, 직접 쓰기 전면 거부.
                        CSRF 신규 구축(현재 전무). 기존 변이 API까지 가드 확장
4. 성능             : ✅ 개인조회 no-store, 캐시로 타인노출 차단.
                        heartbeat 일별 upsert(테이블 비대화 없음, 전체 heartbeat 테이블 미생성).
                        admin 조회 페이지네이션+기간상한.
                        연차계산 순수함수+스냅샷(요청마다 재계산 최소화).
                        조회 인덱스(user_id,work_date / user_id,status) 설계.
                        N+1 회피: admin 조회는 user 조인 일괄
5. 폴더 구조        : ✅ components/hooks/lib/app/api/types 역할대로 배치(§1.2)
─────────────────────────────────────────────────
위반 항목: 없음 (설계 기준). 구현 시 각 파일 400줄 초과 감지하면 보고 후 분리
─────────────────────────────────────────────────
```

### 8.2 규칙 0-5 견고성 4문 (설계 반영)

1. **규모(100~1000배):** heartbeat는 일별 1행 upsert(이벤트 원장 미보관). 연차계산 순수함수+`calculation_snapshot` 캐시. 조회 기간상한·페이지네이션·인덱스. 목록 take 상한.
2. **수명주기(삭제 경로):** 연결 문서·결재 삭제를 FK `on delete restrict`로 보호(승인 차감 유실 방지). 승인 휴가 삭제/철회는 MVP 금지(후속). 보정은 원본 heartbeat 유지.
3. **비정상 경로:** 재시도(멱등키+document partial unique), 동시수정(version 409), 경합(사용자 잠금), 계정전환(타이머 폐기), IDOR(소유권·admin 서버 재검증), env 누락(503), 날짜 위조(서버 KST 재산정), 한쪽 경로 방치 금지(상신↔동기화 양방향).
4. **적대적 자문:** 직접 DB 쓰기로 승인상태·원본시각 위조 시나리오 → RLS 쓰기 전면 거부로 차단. 위조 Electron 신호 → 완전 차단 불가 인정, 보정·감사로 보완. 구현 완료 후 **병렬 코드리뷰로 적대적 검토 필수**(보안·DB·결재 동기화).

### 8.3 규칙 0-1 / 0-2 (로컬≠운영, 재검증)

- 마이그레이션은 **운영 DB 실제 적용 여부를 로컬 통과와 별개로 확인**. 기존 승인 사용분 이관·입사일 등록률·근무일 캘린더 완전성·CSRF 변이 목록을 **출시 조건**으로 둔다.
- "결재 삭제됨"(위키) 같은 문서 기반 전제는 믿지 않고 실제 소스로 재검증 완료(§0).

---

## 9. 양측 협업 계약 (요약)

- **진실원:** 본 문서 §2(타입/스키마)·§5(API). 한쪽이 바꾸면 문서 수정 후 상대 통지.
- **Codex(백엔드):** Phase B~D. API는 이 문서의 요청/응답 형태를 **정확히** 반환. `ok/fail/withAuth/withMutation` 사용.
- **Claude(프론트):** Phase E. 이 문서 타입으로 목업 선개발 → C 완료 시 연결. CSRF 래퍼를 서버 가드보다 먼저.
- **공통 경계:** user_id·날짜·차감량·승인상태는 **서버 권위**. 클라 입력은 표시·요청 의도로만.
</content>
</invoke>
