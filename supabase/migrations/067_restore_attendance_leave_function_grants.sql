-- =============================================================================
-- 067: 근태·휴가 DB 함수 실행 권한 회수 복원 — 045~048 의 revoke 가 운영에 남아 있지 않았다
--
-- 발견(2026-11-18 운영 조회): attendance_*·leave_* 함수 13개에 PUBLIC·anon·authenticated 실행 권한이 열려 있었다.
--   같은 방식의 058(readable_file_ids)·065(reorder_maintenance_fee_items) 회수는 정상 → 045~048 회수만 빠짐(시점은 DB 이력 없음).
-- 실제 악용 가능성은 낮았다: 모두 호출자 권한(invoker) 함수이고, 쓰는 테이블(결재·휴가·근태)은 RLS 켜짐·사용자 쓰기 정책 0개,
--   감사 기록은 본인 id 로만 삽입 가능 → 남의 id 로 결재를 위조해도 전체가 되돌려진다. 빠진 방어선 한 겹을 되살리는 것.
-- 앱 영향 없음: 호출부(leave-service·leave-approval·attendance-service)는 모두 service role 클라이언트,
--   일반 결재 상신도 service role 로 approval_requests 를 넣는다(트리거 함수는 실행 권한 검사 대상이 아님).
--
-- 아래는 045·046·047·048 파일의 revoke/grant 문장 그대로다. 함수 본문은 건드리지 않는다.
-- 되돌리기: grant execute on function (아래 목록) to public, anon, authenticated;
-- =============================================================================

begin;

-- 045
revoke all on function public.attendance_heartbeat(uuid), public.attendance_correct(uuid,date,jsonb) from public,anon,authenticated;
grant execute on function public.attendance_heartbeat(uuid), public.attendance_correct(uuid,date,jsonb) to service_role;

-- 046
revoke all on function public.leave_balance_internal(uuid,date,jsonb,uuid),public.leave_balance(uuid,date),public.leave_workdays(date,date),public.leave_anniversary(date,int) from public,anon,authenticated;
grant execute on function public.leave_balance(uuid,date),public.leave_balance_internal(uuid,date,jsonb,uuid),public.leave_workdays(date,date),public.leave_anniversary(date,int) to service_role;

-- 047
revoke all on function public.leave_assert(uuid,jsonb,uuid),public.leave_write(uuid,uuid,jsonb),public.leave_approval_sync(),public.leave_document_lock(),public.leave_hire_audit() from public,anon,authenticated;
grant execute on function public.leave_assert(uuid,jsonb,uuid),public.leave_write(uuid,uuid,jsonb) to service_role;

-- 048
revoke all on function public.leave_submit(uuid,uuid,jsonb),public.leave_decide(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.leave_submit(uuid,uuid,jsonb),public.leave_decide(uuid,uuid,text,text) to service_role;

commit;
