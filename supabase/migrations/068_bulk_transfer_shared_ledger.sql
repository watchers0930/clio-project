-- =============================================================================
-- 068: 대량이체 데이터를 대표·관리자 공용으로 — 두 계정이 한 장부를 본다
--
-- 배경(2026-11-18 대장 요청): 대량이체(수취인·이체 항목·고정지출·월지출·잔고)는 작성자 본인 것만 보이게
--   되어 있어(041·043·044, 051 은 여기에 역할 조건만 더함), admin@clio.kr 이 입력한 고정지출 10건·이체 6건·
--   수취인 6건·잔고는 ceo@clio.kr 화면에 보이지 않았다.
-- 조치: 조회·수정·삭제는 '대표/관리자(is_admin_or_ceo)'면 누구 것이든 허용. 생성은 여전히 본인 명의로만.
--   대상 계정은 is_admin_or_ceo() 를 만족하는 사용자뿐(운영 2개: admin@clio.kr·ceo@clio.kr).
--   잔고(fixed_expense_settings)는 사용자별 1행 구조라 API 가 가장 최근 행 하나를 공용 잔고로 읽고 고친다.
-- 서버는 사용자 세션(RLS 적용)으로 접근하므로 이 정책이 실제 공유 범위를 정한다.
--
-- 되돌리기: 051_sensitive_tables_role_rls.sql 의 해당 5개 테이블 정책 부분을 다시 실행.
-- =============================================================================

begin;

-- ── transfer_payees ──
drop policy if exists "transfer_payees_select" on public.transfer_payees;
create policy "transfer_payees_select" on public.transfer_payees for select to authenticated using (public.is_admin_or_ceo());
drop policy if exists "transfer_payees_update" on public.transfer_payees;
create policy "transfer_payees_update" on public.transfer_payees for update to authenticated using (public.is_admin_or_ceo()) with check (public.is_admin_or_ceo());
drop policy if exists "transfer_payees_delete" on public.transfer_payees;
create policy "transfer_payees_delete" on public.transfer_payees for delete to authenticated using (public.is_admin_or_ceo());

-- ── transfer_items ──
drop policy if exists "transfer_items_select" on public.transfer_items;
create policy "transfer_items_select" on public.transfer_items for select to authenticated using (public.is_admin_or_ceo());
drop policy if exists "transfer_items_update" on public.transfer_items;
create policy "transfer_items_update" on public.transfer_items for update to authenticated using (public.is_admin_or_ceo()) with check (public.is_admin_or_ceo());
drop policy if exists "transfer_items_delete" on public.transfer_items;
create policy "transfer_items_delete" on public.transfer_items for delete to authenticated using (public.is_admin_or_ceo());

-- ── fixed_expenses ──
drop policy if exists "fixed_expenses_select" on public.fixed_expenses;
create policy "fixed_expenses_select" on public.fixed_expenses for select to authenticated using (public.is_admin_or_ceo());
drop policy if exists "fixed_expenses_update" on public.fixed_expenses;
create policy "fixed_expenses_update" on public.fixed_expenses for update to authenticated using (public.is_admin_or_ceo()) with check (public.is_admin_or_ceo());
drop policy if exists "fixed_expenses_delete" on public.fixed_expenses;
create policy "fixed_expenses_delete" on public.fixed_expenses for delete to authenticated using (public.is_admin_or_ceo());

-- ── fixed_expense_settings (delete 정책 없음 — 그대로) ──
drop policy if exists "fixed_expense_settings_select" on public.fixed_expense_settings;
create policy "fixed_expense_settings_select" on public.fixed_expense_settings for select to authenticated using (public.is_admin_or_ceo());
drop policy if exists "fixed_expense_settings_update" on public.fixed_expense_settings;
create policy "fixed_expense_settings_update" on public.fixed_expense_settings for update to authenticated using (public.is_admin_or_ceo()) with check (public.is_admin_or_ceo());

-- ── monthly_expenses ──
drop policy if exists "monthly_expenses_select" on public.monthly_expenses;
create policy "monthly_expenses_select" on public.monthly_expenses for select to authenticated using (public.is_admin_or_ceo());
drop policy if exists "monthly_expenses_update" on public.monthly_expenses;
create policy "monthly_expenses_update" on public.monthly_expenses for update to authenticated using (public.is_admin_or_ceo()) with check (public.is_admin_or_ceo());
drop policy if exists "monthly_expenses_delete" on public.monthly_expenses;
create policy "monthly_expenses_delete" on public.monthly_expenses for delete to authenticated using (public.is_admin_or_ceo());

-- insert 정책(created_by = auth.uid() and is_admin_or_ceo())은 051 그대로 둔다.

commit;
