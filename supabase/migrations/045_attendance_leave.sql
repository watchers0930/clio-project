
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

-- Database clock, cross-instance rate limit, row lock and audit commit together.
create table public.attendance_rate_limits (
  user_id uuid primary key references public.users(id) on delete cascade,
  window_start timestamptz not null, requests int not null
);
alter table public.attendance_rate_limits enable row level security;

create function public.attendance_heartbeat(p_user uuid)
returns public.attendance_records language plpgsql set search_path = public as $$
declare t timestamptz := clock_timestamp(); d date; r public.attendance_records; n int;
begin
  if not exists(select 1 from users where id=p_user and is_active) then raise insufficient_privilege; end if;
  d := (t at time zone 'Asia/Seoul')::date;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text||d::text,0));
  insert into attendance_rate_limits values(p_user,date_trunc('minute',t),1)
  on conflict(user_id) do update set
    requests=case when attendance_rate_limits.window_start=date_trunc('minute',t) then attendance_rate_limits.requests+1 else 1 end,
    window_start=date_trunc('minute',t) returning requests into n;
  if n>30 then raise exception using errcode='54000', message='rate limited'; end if;
  insert into attendance_records(user_id,work_date,first_heartbeat_at,last_heartbeat_at,heartbeat_count,version)
  values(p_user,d,t,t,1,0) on conflict(user_id,work_date) do update set
    first_heartbeat_at=coalesce(attendance_records.first_heartbeat_at,excluded.first_heartbeat_at),
    last_heartbeat_at=greatest(attendance_records.last_heartbeat_at,excluded.last_heartbeat_at),
    -- version은 수동 보정에만 사용한다. 최초 heartbeat도 미보정 버전 0.
    heartbeat_count=attendance_records.heartbeat_count+1 returning * into r;
  return r;
end; $$;

create function public.attendance_correct(p_user uuid,p_date date,p_body jsonb)
returns public.attendance_records language plpgsql set search_path = public as $$
declare r attendance_records; before_row jsonb; ci timestamptz; co timestamptz;
begin
  if not exists(select 1 from users where id=p_user and is_active) then raise insufficient_privilege; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text||p_date::text,0));
  if p_date>(now() at time zone 'Asia/Seoul')::date or p_body->>'mode' not in ('correct','restore')
     or coalesce(length(trim(p_body->>'reason')),0) not between 1 and 500 then raise invalid_parameter_value; end if;
  select * into r from attendance_records where user_id=p_user and work_date=p_date for update;
  before_row := to_jsonb(r);
  if coalesce(r.version,0)<>(p_body->>'version')::int then raise exception 'version conflict'; end if;
  if r.id is null then
    if p_body->>'mode'='restore' then raise no_data_found; end if;
    insert into attendance_records(user_id,work_date) values(p_user,p_date) returning * into r;
  end if;
  ci := case when p_body->>'mode'='restore' then null when p_body ? 'checkInAt' then (p_body->>'checkInAt')::timestamptz else r.manual_check_in_at end;
  co := case when p_body->>'mode'='restore' then null when p_body ? 'checkOutAt' then (p_body->>'checkOutAt')::timestamptz else r.manual_check_out_at end;
  if (ci is not null and (ci at time zone 'Asia/Seoul')::date<>p_date)
     or (co is not null and (co at time zone 'Asia/Seoul')::date<>p_date)
     or coalesce(ci,r.first_heartbeat_at)>coalesce(co,r.last_heartbeat_at) then raise invalid_parameter_value; end if;
  update attendance_records set manual_check_in_at=ci,manual_check_out_at=co,
    correction_reason=trim(p_body->>'reason'),corrected_by=p_user,corrected_at=now(),
    version=case when before_row->>'id' is null then 1 else version+1 end where id=r.id returning * into r;
  insert into audit_logs(user_id,action,target_type,target_id,details)
    values(p_user,'attendance.correct','attendance',r.id,jsonb_build_object('before',before_row,'after',to_jsonb(r),'reason',p_body->>'reason'));
  return r;
end; $$;
revoke all on function public.attendance_heartbeat(uuid), public.attendance_correct(uuid,date,jsonb) from public,anon,authenticated;
grant execute on function public.attendance_heartbeat(uuid), public.attendance_correct(uuid,date,jsonb) to service_role;
