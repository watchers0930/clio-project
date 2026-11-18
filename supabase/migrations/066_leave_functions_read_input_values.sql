-- =============================================================================
-- 066: 휴가 DB 함수가 입력값을 칸(documents.input_values)에서 읽게 — 060 이후 휴가원 결재·연결이 막힌 문제
--
-- 증상(2026-11-18 운영): 박세영 휴가원을 대표(ceo@clio.kr)가 승인하면 실패. 되돌림 시험으로 재현 → 'document mismatch'.
-- 원인: 059·060 이 입력값을 본문 첫 줄 주석(<!--DOCUMENT_INPUTS:...-->)에서 input_values 칸으로 옮기고 주석을 지웠는데,
--       047 의 두 함수는 여전히 본문 주석만 읽었다(운영 휴가 문서 중 주석이 남은 것 0건).
--   - leave_approval_sync(결재 요청 트리거): 상신·승인 때 문서 입력값과 휴가 신청을 대조 → 주석이 없어 'document mismatch'
--   - leave_write(휴가 신청 작성·문서 연결): 주석이 없으면 'missing document inputs' → 새 휴가원 문서가 휴가 신청과 연결되지 않음
-- 수정: 두 함수의 입력값 읽기만 coalesce(input_values, parse_document_inputs(content)) 로 바꾼다. 대조 규칙·잠금·권한은 047 그대로.
--       (적용 전 운영 함수 본문 md5 가 047 파일과 같음을 확인: leave_write d71f9068…, leave_approval_sync 9d1b5b4d…)
--
-- 되돌리기: 047_leave_workflow.sql 의 두 함수 정의를 'create or replace' 로 다시 실행.
-- =============================================================================

begin;

create or replace function public.leave_write(p_user uuid,p_id uuid,p_body jsonb)
returns public.leave_requests language plpgsql set search_path=public as $$
declare r leave_requests; b jsonb; snapshot jsonb; doc documents; tmpl text; did uuid; inputs jsonb;
begin
  perform 1 from users where id=p_user and is_active for update;
  if not found then raise insufficient_privilege; end if;
  if p_id is null then
    if coalesce(length(p_body->>'idempotencyKey'),0) not between 1 and 128 then raise invalid_parameter_value; end if;
    select * into r from leave_requests where user_id=p_user and idempotency_key=p_body->>'idempotencyKey';
    if found then return r; end if;
    b:=p_body;
  else
    select * into r from leave_requests where id=p_id and user_id=p_user for update;
    if not found then raise no_data_found; end if;
    if r.status<>'draft' then raise exception 'leave locked'; end if;
    b:=jsonb_build_object('leaveType',r.leave_type,'startDate',r.start_date,'endDate',r.end_date,'halfDaySlot',r.half_day_slot,'reason',r.reason)||p_body;
    if p_body ? 'leaveType' and p_body->>'leaveType'<>'half_day' then b:=b||jsonb_build_object('halfDaySlot',null); end if;
    -- Once linked, request data must remain identical to its source document.
    if r.document_id is not null and p_body->>'action'='update' then raise exception 'linked document locked'; end if;
  end if;
  did:=coalesce((p_body->>'documentId')::uuid,r.document_id);
  if did is not null then
    select * into doc from documents where id=did and created_by=p_user for update;
    if not found then raise no_data_found; end if;
    -- 066: 입력값은 칸(input_values) 우선, 없으면 본문 첫 줄 주석(060 이전 문서)
    inputs:=coalesce(doc.input_values,public.parse_document_inputs(doc.content));
    select name into tmpl from templates where id=doc.template_id;
    if not (coalesce(tmpl,'') ~ '휴가원' or (doc.template_id is null and (doc.title ~ '휴가원' or inputs->>'__template_name'='휴가원'))) then raise invalid_parameter_value; end if;
    if inputs is null then raise exception 'missing document inputs'; end if;
    begin
      if inputs->>'leave_start_date' is distinct from b->>'startDate'
        or inputs->>'leave_end_date' is distinct from b->>'endDate'
        or coalesce(inputs->>'leave_type','annual') is distinct from b->>'leaveType'
        or inputs->>'half_day_slot' is distinct from b->>'halfDaySlot'
        or coalesce(inputs->>'leave_reason','') is distinct from coalesce(b->>'reason','') then raise exception 'document mismatch'; end if;
    end;
    if r.document_id is not null and r.document_id<>did then raise exception 'document already linked'; end if;
  end if;
  snapshot:=leave_assert(p_user,b,p_id);
  if p_id is null then
    insert into leave_requests(user_id,document_id,leave_type,start_date,end_date,half_day_slot,requested_days,deduct_days,reason,policy_version,calculation_snapshot,idempotency_key)
    values(p_user,did,b->>'leaveType',(b->>'startDate')::date,(b->>'endDate')::date,b->>'halfDaySlot',
      (snapshot->>'requestedDays')::numeric,(snapshot->>'deductDays')::numeric,b->>'reason','anniversary-v1',snapshot,b->>'idempotencyKey') returning * into r;
  else
    update leave_requests set document_id=did,leave_type=b->>'leaveType',start_date=(b->>'startDate')::date,end_date=(b->>'endDate')::date,
      half_day_slot=b->>'halfDaySlot',requested_days=(snapshot->>'requestedDays')::numeric,deduct_days=(snapshot->>'deductDays')::numeric,
      reason=b->>'reason',calculation_snapshot=snapshot where id=r.id returning * into r;
  end if;
  return r;
end; $$;

create or replace function public.leave_approval_sync() returns trigger language plpgsql set search_path=public as $$
declare r leave_requests; b jsonb; snapshot jsonb; doc documents; inputs jsonb;
begin
  select * into r from leave_requests where document_id=new.document_id;
  if r.id is null then
    if exists(select 1 from documents d left join templates t on t.id=d.template_id where d.id=new.document_id and (t.name ~ '휴가원' or (d.template_id is null and (d.title ~ '휴가원' or coalesce(d.input_values,public.parse_document_inputs(d.content))->>'__template_name'='휴가원')))) then raise exception 'leave linkage required'; end if;
    return new;
  end if;
  perform 1 from users where id=r.user_id and is_active for update;
  if not found then raise insufficient_privilege; end if;
  select * into r from leave_requests where id=r.id for update;
  if new.requester_id<>r.user_id then raise insufficient_privilege; end if;
  if tg_op='INSERT' then
    if r.status not in ('draft','rejected') then raise exception 'leave locked'; end if;
  elsif new.id<>r.approval_request_id then return new;
  elsif old.status<>new.status and old.status<>'pending' then raise exception 'approval terminal';
  elsif old.status=new.status then return new;
  end if;
  if new.status in ('pending','approved') then
    select * into doc from documents where id=r.document_id and created_by=r.user_id for update;
    if not found then raise exception 'document mismatch'; end if;
    -- 066: 입력값은 칸(input_values) 우선, 없으면 본문 첫 줄 주석(060 이전 문서)
    inputs:=coalesce(doc.input_values,public.parse_document_inputs(doc.content));
    if inputs is null or inputs->>'leave_start_date' is distinct from r.start_date::text
      or inputs->>'leave_end_date' is distinct from r.end_date::text
      or coalesce(inputs->>'leave_type','annual') is distinct from r.leave_type
      or inputs->>'half_day_slot' is distinct from r.half_day_slot
      or coalesce(inputs->>'leave_reason','') is distinct from coalesce(r.reason,'') then raise exception 'document mismatch'; end if;
    b:=jsonb_build_object('leaveType',r.leave_type,'startDate',r.start_date,'endDate',r.end_date,'halfDaySlot',r.half_day_slot,'reason',r.reason);
    snapshot:=leave_assert(r.user_id,b,r.id);
  end if;
  update leave_requests set status=new.status,approval_request_id=new.id,
    calculation_snapshot=coalesce(snapshot,calculation_snapshot) where id=r.id;
  insert into leave_approval_history values(r.id,new.id) on conflict do nothing;
  return new;
end; $$;

commit;
