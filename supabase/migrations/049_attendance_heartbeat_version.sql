-- 이미 045를 적용한 DB에도 보정 버전 분리와 최초 수신/보정 경합 방지를 적용한다.
create or replace function public.attendance_heartbeat(p_user uuid)
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

revoke all on function public.attendance_heartbeat(uuid) from public,anon,authenticated;
grant execute on function public.attendance_heartbeat(uuid) to service_role;
