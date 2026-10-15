-- Reuse approval_requests/approval_steps; leave commands commit as one transaction.
create function public.leave_submit(p_user uuid,p_document uuid,p_line jsonb)
returns jsonb language plpgsql set search_path=public as $$
declare r leave_requests; a uuid; s jsonb; sig text;
begin
  perform 1 from users where id=p_user and is_active for update;
  if not found then raise insufficient_privilege; end if;
  select * into r from leave_requests where user_id=p_user and document_id=p_document for update;
  if not found then raise no_data_found; end if;
  if r.status not in ('draft','rejected') then raise exception 'leave locked'; end if;
  if jsonb_array_length(p_line)<2 or (p_line->0->>'approver_id')::uuid<>p_user then raise invalid_parameter_value; end if;
  if not exists(select 1 from documents where id=p_document and created_by=p_user) then raise insufficient_privilege; end if;
  select signature_path into sig from users where id=p_user;
  insert into approval_requests(document_id,requester_id,status,current_step) values(p_document,p_user,'pending',2) returning id into a;
  for s in select value from jsonb_array_elements(p_line) loop
    if not exists(select 1 from users where id=(s->>'approver_id')::uuid and is_active) then raise exception 'inactive approver'; end if;
    insert into approval_steps(request_id,step_order,approver_id,rank_title,status,signature_path,decided_at)
    values(a,(s->>'step_order')::int,(s->>'approver_id')::uuid,s->>'rank_title',
      case when (s->>'step_order')::int=1 then 'approved' else 'waiting' end,
      case when (s->>'step_order')::int=1 then sig end,case when (s->>'step_order')::int=1 then now() end);
  end loop;
  update documents set status='in_approval' where id=p_document;
  insert into audit_logs(user_id,action,target_type,target_id,details) values(p_user,'leave.submit','leave',r.id,jsonb_build_object('approvalRequestId',a));
  select * into r from leave_requests where id=r.id;
  return jsonb_build_object('requestId',a,'leave',to_jsonb(r));
end; $$;

create function public.leave_decide(p_actor uuid,p_request uuid,p_action text,p_comment text)
returns jsonb language plpgsql set search_path=public as $$
declare a approval_requests; s approval_steps; me users; last_step int; result text; owner_id uuid;
begin
  select user_id into owner_id from leave_requests where approval_request_id=p_request;
  if owner_id is null then raise no_data_found; end if;
  perform 1 from users where id=owner_id for update;
  select * into a from approval_requests where id=p_request for update;
  if a.status<>'pending' then raise exception 'approval terminal'; end if;
  select * into me from users where id=p_actor and is_active;
  if not found then raise insufficient_privilege; end if;
  select * into s from approval_steps where request_id=p_request and step_order=a.current_step for update;
  if s.id is null or s.approver_id<>p_actor or s.status<>'waiting' then raise insufficient_privilege; end if;
  if p_action not in ('approve','reject','delegate') or length(p_comment)>1000 then raise invalid_parameter_value; end if;
  if p_action='delegate' and (me.rank_level is null or me.rank_level>2) then raise insufficient_privilege; end if;
  select max(step_order) into last_step from approval_steps where request_id=p_request;
  update approval_steps set status=case p_action when 'approve' then 'approved' when 'reject' then 'rejected' else 'delegated' end,
    signature_path=case when p_action<>'reject' then me.signature_path end,comment=p_comment,decided_at=now() where id=s.id;
  if p_action='reject' then
    update approval_requests set status='rejected',completed_at=now() where id=p_request;
    update documents set status='rejected' where id=a.document_id; result:='rejected';
  elsif p_action='delegate' or a.current_step>=last_step then
    if p_action='delegate' then update approval_steps set status='skipped' where request_id=p_request and step_order>a.current_step; end if;
    update approval_requests set status='approved',completed_at=now() where id=p_request;
    update documents set status='approved' where id=a.document_id;
    result:=case when p_action='delegate' then 'delegated' else 'completed' end;
  else
    update approval_requests set current_step=current_step+1 where id=p_request; result:='advanced';
  end if;
  insert into audit_logs(user_id,action,target_type,target_id,details) values(p_actor,'leave.decide','approval',p_request,jsonb_build_object('action',p_action));
  return jsonb_build_object('result',result,'nextStep',case when result='advanced' then a.current_step+1 end);
end; $$;
revoke all on function public.leave_submit(uuid,uuid,jsonb),public.leave_decide(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.leave_submit(uuid,uuid,jsonb),public.leave_decide(uuid,uuid,text,text) to service_role;
