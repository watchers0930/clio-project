-- 057: 사용자 세션의 users 자기 삽입 차단 (공개 가입 폐쇄와 한 묶음)
--
-- 문제(2026-11-16 운영 확인): Supabase 공개 가입이 열려 있었고(disable_signup=false),
--   users_insert 정책(auth.uid() = id)으로 가입자가 자기 users 행을 직접 넣을 수 있었다.
--   is_active 기본값이 true 이고 department_id 를 마음대로 고를 수 있어,
--   외부인이 가입 → 이메일 확인 → 자기 행 삽입 → 그 부서 문서·파일 열람까지 가능했다.
-- 조치: Supabase 인증 설정에서 공개 가입을 끄고(대시보드), 이 정책을 삭제한다.
--   직원 계정은 관리자 계정관리(POST /api/users)가 service role 로 만들므로(RLS 우회) 영향 없다.
--   사용자 세션으로 users 를 삽입하던 유일한 코드(/api/auth/signup)는 같은 변경에서 삭제한다.
--
-- 되돌리기(원래 정의):
--   create policy "users_insert" on public.users for insert to authenticated with check (auth.uid() = id);
begin;
drop policy if exists "users_insert" on public.users;
commit;
