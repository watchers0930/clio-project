-- 062: 문서 버전의 부모(parent_id) 연결 검사 — DB 최종 관문
--
-- 문제(2026-11-17 운영 확인): documents 의 insert/update RLS 는 created_by = auth.uid() 만 본다.
--   로그인한 직원이 공개 anon 키로 REST(/rest/v1/documents)를 직접 부르면 앱 검사(lib/documents/document-links.ts)를 건너뛰고
--   볼 수 없는 남의 문서에 parent_id 를 붙여 그 버전 묶음(버전 목록의 제목·작성자·반영 코멘트)에 끼어들 수 있다.
--
-- 규칙(앱 canAccessDocument 와 같거나 더 넓게 — 정상 경로를 막지 않도록):
--   부모는 원본(parent_id 가 null 인 행)이어야 하고, 요청자가 관리자 / 원본 작성자 / 원본을 공유받은 사용자·부서 중 하나여야 한다.
--   서버 권한(service_role, auth.uid() 가 null)은 통과 — 코멘트 반영 스냅샷 등 서버 코드가 이미 권한을 확인한다.
--   parent_id 가 바뀌지 않는 갱신(본문 수정 등)은 검사하지 않는다.
--
-- 되돌리기: drop trigger documents_version_parent_guard on public.documents;
--           drop function public.documents_version_parent_guard();
begin;

create or replace function public.documents_version_parent_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if new.parent_id is null
     or (tg_op = 'UPDATE' and new.parent_id is not distinct from old.parent_id)
     or uid is null then
    return new;
  end if;
  if not exists (
    select 1
    from documents r
    where r.id = new.parent_id
      and r.parent_id is null
      and (
        r.created_by = uid
        or exists (select 1 from users u where u.id = uid and u.role = 'admin')
        or exists (
          select 1 from document_permissions dp
          where dp.document_id = r.id
            and (dp.granted_to_user = uid
              or dp.granted_to_dept = (select u.department_id from users u where u.id = uid))
        )
      )
  ) then
    raise exception 'document version parent not allowed' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- 트리거 전용 — RPC 로 직접 부를 수 없게
revoke all on function public.documents_version_parent_guard() from public, anon, authenticated;

drop trigger if exists documents_version_parent_guard on public.documents;
create trigger documents_version_parent_guard
  before insert or update of parent_id on public.documents
  for each row execute function public.documents_version_parent_guard();

commit;
