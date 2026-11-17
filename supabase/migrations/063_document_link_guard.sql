-- 063: 문서 연결 검사(DB 최종 관문)를 원본(origin_document_id)까지 확장 — 062 의 parent_id 검사를 하나로 합친다
--
-- 문제(2026-11-17 운영 리뷰): documents 의 insert/update RLS 는 created_by = auth.uid() 만 본다.
--   로그인한 직원이 공개 anon 키로 REST 를 직접 부르면 앱 검사(lib/documents/document-links.ts)를 건너뛰고
--   남의 문서를 origin_document_id 로 걸 수 있다 → 그 문서로 결재를 올리면 원본 문서가 삭제 불가(잠금 참조, 409)가 된다.
--
-- 규칙(앱 canAccessDocument 와 같거나 더 넓게 — 정상 경로를 막지 않도록):
--   요청자가 관리자 / 대상 문서 작성자 / 대상 문서를 공유받은 사용자·부서 중 하나여야 한다.
--   parent_id(새 버전)는 추가로 대상이 원본(parent_id 가 null 인 행)이어야 하고, 공유는 'edit' 만 인정한다
--   ('read' 공유만으로 남의 버전 묶음에 끼어들지 못하게 — 앱 canEditDocument 와 같은 기준).
--   서버 권한(service_role, auth.uid() 가 null)은 통과, 값이 바뀌지 않는 갱신은 검사하지 않는다.
--
-- 되돌리기(062 상태로): drop trigger documents_link_guard on public.documents;
--           drop function public.documents_link_guard(); drop function public.document_link_target_allowed(uuid, uuid, boolean);
--           그 뒤 062 파일을 다시 실행.
begin;

create or replace function public.document_link_target_allowed(p_target uuid, p_uid uuid, p_for_version boolean)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from documents t
    where t.id = p_target
      and (not p_for_version or t.parent_id is null)
      and (
        t.created_by = p_uid
        or exists (select 1 from users u where u.id = p_uid and u.role = 'admin')
        or exists (
          select 1 from document_permissions dp
          where dp.document_id = t.id
            and (not p_for_version or dp.permission = 'edit')
            and (dp.granted_to_user = p_uid
              or dp.granted_to_dept = (select u.department_id from users u where u.id = p_uid))
        )
      )
  );
$$;

create or replace function public.documents_link_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return new;
  end if;
  if new.parent_id is not null
     and (tg_op = 'INSERT' or new.parent_id is distinct from old.parent_id)
     and not public.document_link_target_allowed(new.parent_id, uid, true) then
    raise exception 'document version parent not allowed' using errcode = '42501';
  end if;
  if new.origin_document_id is not null
     and (tg_op = 'INSERT' or new.origin_document_id is distinct from old.origin_document_id)
     and not public.document_link_target_allowed(new.origin_document_id, uid, false) then
    raise exception 'document origin not allowed' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- 트리거 전용 — RPC 로 직접 부를 수 없게(보조 함수는 다른 사람의 권한을 묻는 통로가 되지 않게)
revoke all on function public.documents_link_guard() from public, anon, authenticated;
revoke all on function public.document_link_target_allowed(uuid, uuid, boolean) from public, anon, authenticated;

drop trigger if exists documents_link_guard on public.documents;
create trigger documents_link_guard
  before insert or update of parent_id, origin_document_id on public.documents
  for each row execute function public.documents_link_guard();

-- 062 를 대체
drop trigger if exists documents_version_parent_guard on public.documents;
drop function if exists public.documents_version_parent_guard();

commit;
