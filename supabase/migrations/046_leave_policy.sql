-- Holiday data must be verified by HR before a year is enabled. No silent weekday-only fallback.
create table public.leave_calendar(day date primary key, label text not null);
create table public.leave_calendar_years(year int primary key check(year between 1900 and 2199), verified boolean not null default false);
alter table public.leave_calendar enable row level security;
alter table public.leave_calendar_years enable row level security;
create policy calendar_read on public.leave_calendar for select to authenticated using(true);
create policy calendar_year_read on public.leave_calendar_years for select to authenticated using(true);

create function public.leave_anniversary(h date,m int) returns date language sql immutable as $$
 select (date_trunc('month',h)+(m||' months')::interval +
  (least(extract(day from h)::int,extract(day from (date_trunc('month',h)+((m+1)||' months')::interval-interval '1 day'))::int)-1)*interval '1 day')::date;
$$;
create function public.leave_workdays(s date,e date) returns table(day date) language sql stable set search_path=public as $$
 select d::date from generate_series(s::timestamp,e::timestamp,interval '1 day') d
 where extract(isodow from d)<6 and not exists(select 1 from leave_calendar c where c.day=d::date);
$$;

-- Internal allocation also evaluates a proposed request under the caller's transaction lock.
create function public.leave_balance_internal(p_user uuid,p_asof date,p_candidate jsonb default null,p_exclude uuid default null)
returns jsonb language plpgsql set search_path=public as $$
declare h date; reason text; gs jsonb := '[]'; active jsonb := '[]'; g jsonb; item record;
  i int; j int; years int; on_day date; until_day date; amount numeric; left_days numeric; available numeric;
  shortage numeric:=0; pending_short numeric:=0; reserved numeric:=0; tg numeric:=0; td numeric:=0;
  min_day date; max_day date; result jsonb;
begin
  select hire_date into h from users where id=p_user;
  reason:=case when h is null then 'no_hire_date' when h>p_asof then 'future_hire_date' end;
  result:=jsonb_build_object('hireDate',h,'asOf',p_asof,'computable',reason is null,'policyVersion','anniversary-v1',
    'grants','[]'::jsonb,'totalGranted',0,'totalDeducted',0,'reservedDays',0,'remainingDays',0,'requestableDays',0,
    'assumptionNote','개근·출근율80% 충족 전제. 입사일 기준, 월말·윤년 기념일은 해당 월 말일로 보정.');
  if reason is not null then return result||jsonb_build_object('reason',reason); end if;
  select least(p_asof,min(start_date)),greatest(p_asof,max(end_date)) into min_day,max_day from leave_requests where user_id=p_user and status in ('pending','approved');
  min_day:=least(coalesce(min_day,p_asof),coalesce((p_candidate->>'startDate')::date,p_asof));
  max_day:=greatest(coalesce(max_day,p_asof),coalesce((p_candidate->>'endDate')::date,p_asof));
  if exists(select 1 from generate_series(extract(year from min_day)::int,extract(year from max_day)::int) y
    where not exists(select 1 from leave_calendar_years c where c.year=y and verified)) then
    raise exception using errcode='55000',message='calendar not verified';
  end if;
  for i in 1..11 loop
    on_day:=leave_anniversary(h,i); exit when on_day>p_asof;
    gs:=gs||jsonb_build_array(jsonb_build_object('grantedOn',on_day,'expiresOn',leave_anniversary(h,12)-1,'grantedDays',1,'deductedDays',0,'remainingDays',1));
  end loop;
  years:=extract(year from age(p_asof,h))::int+1;
  for i in 1..greatest(1,years) loop
    on_day:=leave_anniversary(h,i*12); exit when on_day>p_asof;
    amount:=least(25,15+(i-1)/2);
    gs:=gs||jsonb_build_array(jsonb_build_object('grantedOn',on_day,'expiresOn',leave_anniversary(h,(i+1)*12)-1,'grantedDays',amount,'deductedDays',0,'remainingDays',amount));
  end loop;
  -- Approved consumption precedes pending reservation. Each unique request is expanded per workday.
  for item in
    with requests as (
      select id::text,leave_type,start_date,end_date,status from leave_requests
        where user_id=p_user and status in ('approved','pending') and (p_exclude is null or id<>p_exclude)
      union all select 'candidate',p_candidate->>'leaveType',(p_candidate->>'startDate')::date,(p_candidate->>'endDate')::date,'pending' where p_candidate is not null
    ) select r.*,w.day from requests r cross join lateral leave_workdays(start_date,end_date) w
      where leave_type<>'menstrual' order by case status when 'approved' then 0 else 1 end,w.day,id
  loop
    left_days:=case when item.leave_type='half_day' then 0.5 else 1 end;
    if jsonb_array_length(gs)>0 then
      for j in 0..jsonb_array_length(gs)-1 loop
        g:=gs->j;
        if item.day<(g->>'grantedOn')::date or item.day>(g->>'expiresOn')::date then continue; end if;
        available:=least(left_days,(g->>'remainingDays')::numeric);
        g:=g||jsonb_build_object('remainingDays',(g->>'remainingDays')::numeric-available);
        if item.status='approved' then g:=g||jsonb_build_object('deductedDays',(g->>'deductedDays')::numeric+available);
        elsif (g->>'expiresOn')::date>=p_asof then reserved:=reserved+available; end if;
        gs:=jsonb_set(gs,array[j::text],g); left_days:=left_days-available; exit when left_days=0;
      end loop;
    end if;
    if item.status='approved' then shortage:=shortage+left_days; else pending_short:=pending_short+left_days; end if;
  end loop;
  for g in select value from jsonb_array_elements(gs) loop
    if (g->>'expiresOn')::date<p_asof then continue; end if;
    tg:=tg+(g->>'grantedDays')::numeric; td:=td+(g->>'deductedDays')::numeric;
    active:=active||jsonb_build_array(g||jsonb_build_object('remainingDays',(g->>'grantedDays')::numeric-(g->>'deductedDays')::numeric));
  end loop;
  return result||jsonb_build_object('grants',active,'totalGranted',tg,'totalDeducted',td+shortage,
    'remainingDays',tg-td-shortage,'reservedDays',reserved+pending_short,
    'requestableDays',tg-td-shortage-reserved-pending_short,'allocationShortage',shortage+pending_short);
end; $$;
create function public.leave_balance(p_user uuid,p_asof date) returns jsonb language sql set search_path=public as $$
 select leave_balance_internal(p_user,p_asof)-'allocationShortage';
$$;
revoke all on function public.leave_balance_internal(uuid,date,jsonb,uuid),public.leave_balance(uuid,date),public.leave_workdays(date,date),public.leave_anniversary(date,int) from public,anon,authenticated;
grant execute on function public.leave_balance(uuid,date),public.leave_balance_internal(uuid,date,jsonb,uuid),public.leave_workdays(date,date),public.leave_anniversary(date,int) to service_role;
