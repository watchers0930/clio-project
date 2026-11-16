-- 058: 모든 로그인 계정에 열려 있던 RLS 정책 2차 정리 — 055 와 같은 원칙(쓰기는 서버 전용, 조회는 접근 가능한 것만)
--
-- 문제(2026-11-16 운영 pg_policies·테이블 권한 직접 조회로 확인):
--   document_permissions dp_insert(true)·dp_delete(true) → 아무 직원이 REST 로 남의 문서 권한을 자기에게 부여/남의 권한 삭제.
--     앱의 문서 접근 판정(canAccessDocument)이 이 표를 그대로 믿으므로 곧 모든 문서 열람(055 의 fp_insert 와 같은 구멍).
--   file_chunks select_all(true)·insert_all(true)·delete_own(true) → 다른 부서·개인 파일 본문 전체 열람,
--     남의 청크 삭제·가짜 청크 삽입으로 AI 검색 오염. 채팅의 핀 파일 조회(fileIds 직접 지정)도 이 정책 때문에 아무 파일이나 읽혔다.
--   document_comments comments_select(로그인만) → 전 문서 댓글 열람 / comments_insert(작성자=본인) → 볼 수 없는 문서에 댓글 작성.
--   file_permissions fp_select(true) → 누가 어떤 파일 권한을 가졌는지 전부 열람.
--
-- 조치:
--   1) can_read_file(file_id): 앱의 파일 접근 규칙(canAccessFile)과 files 목록 정책을 합친 판정 함수.
--      관리자 / 업로더 / 같은 부서 / 회사 전체 공개 / 파일 권한(본인·부서) / 유효한 공유(file_shares) 중 하나면 읽기 허용.
--   2) file_chunks: 조회는 can_read_file 로 좁히고, 쓰기 정책은 삭제(청크 저장·삭제는 파일 처리·Gmail 동기화가 service role 로 함).
--      검색 함수(match_file_chunks 등)는 invoker 라 자동으로 같은 범위만 돌려준다.
--   3) document_permissions: 쓰기 정책 삭제(공유 라우트가 v7.97.11 부터 service role 로 씀),
--      조회는 본인·본인 부서 대상 행 + 본인이 만든 문서의 행으로 좁힌다(permissions.ts 조회는 이미 같은 조건으로 거름).
--   4) document_comments: 조회·작성 정책 삭제(앱은 전부 service role 로 읽고 씀). 본인 댓글 삭제 정책은 유지.
--   5) file_permissions: 조회를 본인·본인 부서 대상 행 + 본인이 올린 파일의 행으로 좁힌다.
--
-- 적용 순서: 공유 라우트 service role 전환 코드(v7.97.11) 배포 → 이 마이그레이션.
--
-- 되돌리기(2026-11-16 운영 정의 그대로):
--   create policy "file_chunks_select_all" on public.file_chunks for select to authenticated using (true);
--   create policy "file_chunks_insert_all" on public.file_chunks for insert to authenticated with check (true);
--   create policy "file_chunks_delete_own" on public.file_chunks for delete to authenticated using (true);
--   create policy "dp_select" on public.document_permissions for select to authenticated using (true);
--   create policy "dp_insert" on public.document_permissions for insert to authenticated with check (true);
--   create policy "dp_delete" on public.document_permissions for delete to authenticated using (true);
--   create policy "comments_select" on public.document_comments for select to public using (auth.uid() is not null);
--   create policy "comments_insert" on public.document_comments for insert to public with check ((auth.uid())::text = (user_id)::text);
--   create policy "fp_select" on public.file_permissions for select to authenticated using (true);
--   (그 뒤 새로 만든 정책 4개와 can_read_file 함수 삭제)
begin;

create or replace function public.can_read_file(p_file_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select u.id, u.role, u.department_id
    from users u
    where u.id = auth.uid() and u.is_active
  )
  select exists (
    select 1
    from files f, me
    where f.id = p_file_id
      and (
        me.role = 'admin'
        or f.uploaded_by = me.id
        or f.scope = 'company'
        or (me.department_id is not null and f.department_id = me.department_id)
        or exists (
          select 1 from file_permissions p
          where p.file_id = f.id
            and (p.granted_to_user = me.id or (me.department_id is not null and p.granted_to_dept = me.department_id))
        )
        or exists (
          select 1 from file_shares s
          where s.file_id = f.id and s.shared_with = me.id and s.expires_at > now()
        )
      )
  );
$$;

revoke all on function public.can_read_file(uuid) from public, anon;
grant execute on function public.can_read_file(uuid) to authenticated;

-- file_chunks
drop policy if exists "file_chunks_select_all" on public.file_chunks;
drop policy if exists "file_chunks_insert_all" on public.file_chunks;
drop policy if exists "file_chunks_delete_own" on public.file_chunks;
create policy "file_chunks_select_readable" on public.file_chunks
  for select to authenticated
  using (public.can_read_file(file_id));

-- document_permissions
drop policy if exists "dp_insert" on public.document_permissions;
drop policy if exists "dp_delete" on public.document_permissions;
drop policy if exists "dp_select" on public.document_permissions;
create policy "dp_select_related" on public.document_permissions
  for select to authenticated
  using (
    granted_to_user = (select auth.uid())
    or granted_to_dept = (select u.department_id from public.users u where u.id = (select auth.uid()))
    or exists (select 1 from public.documents d where d.id = document_id and d.created_by = (select auth.uid()))
  );

-- document_comments
drop policy if exists "comments_select" on public.document_comments;
drop policy if exists "comments_insert" on public.document_comments;

-- file_permissions
drop policy if exists "fp_select" on public.file_permissions;
create policy "fp_select_related" on public.file_permissions
  for select to authenticated
  using (
    granted_to_user = (select auth.uid())
    or granted_to_dept = (select u.department_id from public.users u where u.id = (select auth.uid()))
    or exists (select 1 from public.files f where f.id = file_id and f.uploaded_by = (select auth.uid()))
  );

commit;
