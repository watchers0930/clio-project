-- 052: 문서 결재 상태 위조 차단
--
-- 배경: documents_update 정책이 `created_by = auth.uid()`만 검사하고 컬럼 제한이 없어,
-- 작성자가 Supabase REST(또는 PATCH /api/documents/[id])로 status를 'approved'로 바꾸면
-- 결재 없이 '승인됨' 문서가 된다. 결재 중(in_approval) 문서를 초안으로 되돌려 고치는 것도 가능했다.
--
-- 조치: BEFORE INSERT/UPDATE 트리거로 사용자 세션(auth.uid() not null)의
--   ① 결재 상태(in_approval/submitted/approved/rejected) 직접 설정·해제 (반려→초안만 예외)
--   ② 결재 진행·완료(in_approval/submitted/approved) 문서의 status 외 모든 컬럼 수정
-- 을 거부한다. 결재 API·버전 스냅샷은 service_role(auth.uid() null)이라 통과한다.
-- service_role 경로 중 본문을 바꾸는 댓글 반영(reflect/apply-comments)은 라우트에서 잠금 상태를 409로 막는다.
-- 앱 규칙 단일 출처: src/lib/documents/document-status.ts (함께 바꿀 것)

create or replace function public.protect_document_workflow_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status not in ('draft', 'completed') then
      raise exception '결재 상태는 결재 기능으로만 지정할 수 있습니다.';
    end if;
    return new;
  end if;

  -- 허용 전환: 초안↔완료, 반려→초안(반려 문서 수정 후 재상신)
  if new.status is distinct from old.status
    and not (
      (old.status in ('draft', 'completed') and new.status in ('draft', 'completed'))
      or (old.status = 'rejected' and new.status = 'draft')
    ) then
    raise exception '결재 상태는 결재 기능으로만 변경할 수 있습니다.';
  end if;

  -- 잠금 문서는 status 외 모든 컬럼 변경 금지(컬럼 화이트리스트 — storage_path 바꿔치기 등 차단)
  if old.status in ('in_approval', 'submitted', 'approved')
    and (to_jsonb(new) - 'status') is distinct from (to_jsonb(old) - 'status') then
    raise exception '결재 중이거나 승인된 문서는 수정할 수 없습니다.';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_document_workflow_status() from public, anon, authenticated;

drop trigger if exists trg_protect_document_workflow_status on public.documents;
create trigger trg_protect_document_workflow_status
  before insert or update on public.documents
  for each row execute function public.protect_document_workflow_status();
