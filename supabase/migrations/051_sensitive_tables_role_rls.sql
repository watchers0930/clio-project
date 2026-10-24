-- 051: 민감 테이블 RLS 역할 강화 — API 가드 우회(Supabase REST 직접 접근) 차단
--
-- 배경: 대량이체·계정관리 테이블은 created_by/user_id(소유자)만 확인하고 역할을 안 봐서,
-- 로그인 사용자가 REST로 자기 소유 데이터를 직접 CRUD할 수 있었다(API 가드 우회).
-- templates_delete 는 qual=true 로 누구나 삭제 가능했다.
--
-- 조치(보수적): 기존 소유자 조건은 유지하고 역할 게이트만 추가한다(동작 변경 최소).
-- - 대량이체·계정관리: 소유자 AND 대표/어드민(is_admin_or_ceo)
-- - 템플릿 쓰기(insert/update/delete): admin 전용(is_admin_role). select(조회)는 문서 생성에 필요하므로 유지.
-- 서버(service_role)는 RLS를 우회하므로 앱(API 경유) 동작에는 영향 없음.

-- ── 권한 판별 helper (security definer: users RLS 우회, 재귀 방지) ──
create or replace function public.is_admin_or_ceo() returns boolean
language sql security definer stable set search_path = public as $$
  select exists(select 1 from public.users u where u.id = auth.uid() and (u.role = 'admin' or u.rank_level <= 1));
$$;

create or replace function public.is_admin_role() returns boolean
language sql security definer stable set search_path = public as $$
  select exists(select 1 from public.users u where u.id = auth.uid() and u.role = 'admin');
$$;

-- ── transfer_payees ──
drop policy if exists "transfer_payees_select" on public.transfer_payees;
create policy "transfer_payees_select" on public.transfer_payees for select to authenticated using (created_by = auth.uid() and public.is_admin_or_ceo());
drop policy if exists "transfer_payees_insert" on public.transfer_payees;
create policy "transfer_payees_insert" on public.transfer_payees for insert to authenticated with check (created_by = auth.uid() and public.is_admin_or_ceo());
drop policy if exists "transfer_payees_update" on public.transfer_payees;
create policy "transfer_payees_update" on public.transfer_payees for update to authenticated using (created_by = auth.uid() and public.is_admin_or_ceo()) with check (created_by = auth.uid() and public.is_admin_or_ceo());
drop policy if exists "transfer_payees_delete" on public.transfer_payees;
create policy "transfer_payees_delete" on public.transfer_payees for delete to authenticated using (created_by = auth.uid() and public.is_admin_or_ceo());

-- ── transfer_items ──
drop policy if exists "transfer_items_select" on public.transfer_items;
create policy "transfer_items_select" on public.transfer_items for select to authenticated using (created_by = auth.uid() and public.is_admin_or_ceo());
drop policy if exists "transfer_items_insert" on public.transfer_items;
create policy "transfer_items_insert" on public.transfer_items for insert to authenticated with check (created_by = auth.uid() and public.is_admin_or_ceo());
drop policy if exists "transfer_items_update" on public.transfer_items;
create policy "transfer_items_update" on public.transfer_items for update to authenticated using (created_by = auth.uid() and public.is_admin_or_ceo()) with check (created_by = auth.uid() and public.is_admin_or_ceo());
drop policy if exists "transfer_items_delete" on public.transfer_items;
create policy "transfer_items_delete" on public.transfer_items for delete to authenticated using (created_by = auth.uid() and public.is_admin_or_ceo());

-- ── fixed_expenses ──
drop policy if exists "fixed_expenses_select" on public.fixed_expenses;
create policy "fixed_expenses_select" on public.fixed_expenses for select to authenticated using (created_by = auth.uid() and public.is_admin_or_ceo());
drop policy if exists "fixed_expenses_insert" on public.fixed_expenses;
create policy "fixed_expenses_insert" on public.fixed_expenses for insert to authenticated with check (created_by = auth.uid() and public.is_admin_or_ceo());
drop policy if exists "fixed_expenses_update" on public.fixed_expenses;
create policy "fixed_expenses_update" on public.fixed_expenses for update to authenticated using (created_by = auth.uid() and public.is_admin_or_ceo()) with check (created_by = auth.uid() and public.is_admin_or_ceo());
drop policy if exists "fixed_expenses_delete" on public.fixed_expenses;
create policy "fixed_expenses_delete" on public.fixed_expenses for delete to authenticated using (created_by = auth.uid() and public.is_admin_or_ceo());

-- ── fixed_expense_settings (delete 정책 없음) ──
drop policy if exists "fixed_expense_settings_select" on public.fixed_expense_settings;
create policy "fixed_expense_settings_select" on public.fixed_expense_settings for select to authenticated using (created_by = auth.uid() and public.is_admin_or_ceo());
drop policy if exists "fixed_expense_settings_insert" on public.fixed_expense_settings;
create policy "fixed_expense_settings_insert" on public.fixed_expense_settings for insert to authenticated with check (created_by = auth.uid() and public.is_admin_or_ceo());
drop policy if exists "fixed_expense_settings_update" on public.fixed_expense_settings;
create policy "fixed_expense_settings_update" on public.fixed_expense_settings for update to authenticated using (created_by = auth.uid() and public.is_admin_or_ceo()) with check (created_by = auth.uid() and public.is_admin_or_ceo());

-- ── monthly_expenses ──
drop policy if exists "monthly_expenses_select" on public.monthly_expenses;
create policy "monthly_expenses_select" on public.monthly_expenses for select to authenticated using (created_by = auth.uid() and public.is_admin_or_ceo());
drop policy if exists "monthly_expenses_insert" on public.monthly_expenses;
create policy "monthly_expenses_insert" on public.monthly_expenses for insert to authenticated with check (created_by = auth.uid() and public.is_admin_or_ceo());
drop policy if exists "monthly_expenses_update" on public.monthly_expenses;
create policy "monthly_expenses_update" on public.monthly_expenses for update to authenticated using (created_by = auth.uid() and public.is_admin_or_ceo()) with check (created_by = auth.uid() and public.is_admin_or_ceo());
drop policy if exists "monthly_expenses_delete" on public.monthly_expenses;
create policy "monthly_expenses_delete" on public.monthly_expenses for delete to authenticated using (created_by = auth.uid() and public.is_admin_or_ceo());

-- ── account_credentials (본인 소유 + 대표/어드민) ──
drop policy if exists "본인 레코드만 조회" on public.account_credentials;
create policy "본인 레코드만 조회" on public.account_credentials for select to authenticated using (auth.uid() = user_id and public.is_admin_or_ceo());
drop policy if exists "본인 레코드만 삽입" on public.account_credentials;
create policy "본인 레코드만 삽입" on public.account_credentials for insert to authenticated with check (auth.uid() = user_id and public.is_admin_or_ceo());
drop policy if exists "본인 레코드만 수정" on public.account_credentials;
create policy "본인 레코드만 수정" on public.account_credentials for update to authenticated using (auth.uid() = user_id and public.is_admin_or_ceo());
drop policy if exists "본인 레코드만 삭제" on public.account_credentials;
create policy "본인 레코드만 삭제" on public.account_credentials for delete to authenticated using (auth.uid() = user_id and public.is_admin_or_ceo());

-- ── templates: 쓰기는 admin 전용. select(조회)는 기존 유지(문서 생성에 필요) ──
drop policy if exists "templates_insert" on public.templates;
create policy "templates_insert" on public.templates for insert to authenticated with check (public.is_admin_role());
drop policy if exists "templates_update" on public.templates;
create policy "templates_update" on public.templates for update to authenticated using (public.is_admin_role()) with check (public.is_admin_role());
drop policy if exists "templates_delete" on public.templates;
create policy "templates_delete" on public.templates for delete to authenticated using (public.is_admin_role());
