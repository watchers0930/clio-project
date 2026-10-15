-- Serialize all leave writes for a user, including final approval.
create function public.leave_assert(p_user uuid,p_body jsonb,p_exclude uuid default null)
returns jsonb language plpgsql set search_path=public as $$
declare s date:=(p_body->>'startDate')::date; e date:=(p_body->>'endDate')::date;
 t text:=p_body->>'leaveType'; slot text:=p_body->>'halfDaySlot'; n numeric; b jsonb;
begin
  perform 1 from users where id=p_user and is_active for update;
  if not found then raise insufficient_privilege; end if;
  if s is null or e is null or s>e or e-s>=366 or t is null or t not in ('annual','monthly','half_day','menstrual')
    or (t='half_day' and (s<>e or slot is null or slot not in ('am','pm')))
    or (t<>'half_day' and slot is not null) or (t='menstrual' and s<>e)
    or length(coalesce(p_body->>'reason',''))>1000 then raise invalid_parameter_value; end if;
  if exists(select 1 from generate_series(extract(year from s)::int,extract(year from e)::int) y where not exists(select 1 from leave_calendar_years c where c.year=y and verified)) then raise exception using errcode='55000',message='calendar not verified'; end if;
  select count(*) into n from leave_workdays(s,e);
  if n=0 then raise invalid_parameter_value; end if;
  if exists(select 1 from leave_requests r where r.user_id=p_user and r.status in ('pending','approved')
     and (p_exclude is null or r.id<>p_exclude) and (
       (t='menstrual' and r.leave_type='menstrual' and date_trunc('month',r.start_date)=date_trunc('month',s))
       or (r.start_date<=e and r.end_date>=s and exists(select 1 from leave_workdays(greatest(r.start_date,s),least(r.end_date,e))) and not(t='half_day' and r.leave_type='half_day' and slot<>r.half_day_slot))
     )) then raise exception 'leave overlap'; end if;
  b:=leave_balance_internal(p_user,(now() at time zone 'Asia/Seoul')::date,p_body,p_exclude);
  if t<>'menstrual' and (not (b->>'computable')::boolean or (b->>'allocationShortage')::numeric>0 or (b->>'requestableDays')::numeric<0) then raise exception 'insufficient balance'; end if;
  return b||jsonb_build_object('requestedDays',case when t='half_day' then 0.5 else n end,
    'deductDays',case when t='menstrual' then 0 when t='half_day' then 0.5 else n end);
end; $$;

create function public.leave_write(p_user uuid,p_id uuid,p_body jsonb)
returns public.leave_requests language plpgsql set search_path=public as $$
declare r leave_requests; b jsonb; snapshot jsonb; doc documents; tmpl text; did uuid;
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
    select name into tmpl from templates where id=doc.template_id;
    if not (coalesce(tmpl,'') ~ '휴가원' or (doc.template_id is null and (doc.title ~ '휴가원' or doc.content like '%"__template_name":"휴가원"%'))) then raise invalid_parameter_value; end if;
    if doc.content is null or doc.content !~ '<!--DOCUMENT_INPUTS:' then raise exception 'missing document inputs'; end if;
    declare inputs jsonb;
    begin
      inputs:=substring(doc.content from '<!--DOCUMENT_INPUTS:(.*?)-->')::jsonb;
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

-- Each resubmission retains a restrictive FK to the former approval request.
create table public.leave_approval_history (
  leave_id uuid not null references public.leave_requests(id) on delete restrict,
  request_id uuid not null references public.approval_requests(id) on delete restrict,
  primary key(leave_id,request_id)
);
alter table public.leave_approval_history enable row level security;

create function public.leave_approval_sync() returns trigger language plpgsql set search_path=public as $$
declare r leave_requests; b jsonb; snapshot jsonb; doc documents; inputs jsonb;
begin
  select * into r from leave_requests where document_id=new.document_id;
  if r.id is null then
    if exists(select 1 from documents d left join templates t on t.id=d.template_id where d.id=new.document_id and (t.name ~ '휴가원' or (d.template_id is null and (d.title ~ '휴가원' or d.content like '%"__template_name":"휴가원"%')))) then raise exception 'leave linkage required'; end if;
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
    if not found or doc.content is null then raise exception 'document mismatch'; end if;
    inputs:=substring(doc.content from '<!--DOCUMENT_INPUTS:(.*?)-->')::jsonb;
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
create trigger trg_leave_approval_sync after insert or update on public.approval_requests for each row execute function public.leave_approval_sync();

create function public.leave_document_lock() returns trigger language plpgsql set search_path=public as $$
begin
  if exists(select 1 from leave_requests where document_id=old.id and status in ('pending','approved','rejected'))
    and (new.content is distinct from old.content or new.template_id is distinct from old.template_id or new.created_by is distinct from old.created_by or new.title is distinct from old.title) then raise exception 'leave document locked'; end if;
  return new;
end; $$;
create trigger trg_leave_document_lock before update on public.documents for each row execute function public.leave_document_lock();

create function public.leave_hire_audit() returns trigger language plpgsql set search_path=public as $$
begin
 if new.hire_date is distinct from old.hire_date then
  insert into audit_logs(user_id,action,target_type,target_id,details)
  values(auth.uid(),'user.hire_date.update','user',new.id,jsonb_build_object('before',old.hire_date,'after',new.hire_date));
 end if;
 return new;
end; $$;
create trigger trg_leave_hire_audit after update of hire_date on public.users for each row execute function public.leave_hire_audit();
revoke all on function public.leave_assert(uuid,jsonb,uuid),public.leave_write(uuid,uuid,jsonb),public.leave_approval_sync(),public.leave_document_lock(),public.leave_hire_audit() from public,anon,authenticated;
grant execute on function public.leave_assert(uuid,jsonb,uuid),public.leave_write(uuid,uuid,jsonb) to service_role;
