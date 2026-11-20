-- 069: 결재중·승인 문서 삭제는 관리자만
--
-- 배경(2026-11-20 대장 결정): 작성자가 결재중(in_approval/submitted)·승인(approved) 문서를 지우면
-- 결재 증적도 함께 사라졌다. API 는 관리자만 허용하도록 바꿨지만, documents_delete 정책이
-- `created_by = auth.uid()` 라 작성자가 Supabase REST 로 직접 지우면 API 를 우회한다.
--
-- 조치: BEFORE DELETE 트리거로 사용자 세션(auth.uid() not null)이 잠금 상태 문서(또는 진행·승인 결재 건이 있는 문서)를 지울 때
-- 활성 관리자(users.role = 'admin')가 아니면 거부한다. 서버(service_role, auth.uid() null)는 통과 —
-- 일괄 삭제 API 는 service role 로 지우므로 라우트에서 같은 규칙을 먼저 검사한다.
-- 앱 규칙 단일 출처: src/lib/documents/document-status.ts documentDeleteViolation (함께 바꿀 것)
--
-- 되돌리기: drop trigger trg_admin_only_locked_document_delete on public.documents;
--           drop function public.admin_only_locked_document_delete();

begin;

create or replace function public.admin_only_locked_document_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return old;
  end if;

  -- 문서 상태 또는 결재 건(진행·승인) — 상신은 결재 건을 먼저 만들고 문서 상태를 나중에 바꾼다
  if (old.status in ('in_approval', 'submitted', 'approved')
      or exists (
        select 1 from public.approval_requests r
        where r.document_id = old.id and r.status in ('pending', 'approved')
      ))
    and not exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin' and u.is_active
    ) then
    raise exception '결재 중이거나 승인된 문서는 관리자만 삭제할 수 있습니다.';
  end if;

  return old;
end;
$$;

revoke all on function public.admin_only_locked_document_delete() from public, anon, authenticated;

create or replace trigger trg_admin_only_locked_document_delete
  before delete on public.documents
  for each row execute function public.admin_only_locked_document_delete();

commit;
