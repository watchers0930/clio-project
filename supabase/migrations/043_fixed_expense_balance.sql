-- =============================================================================
-- CLIO - 월 고정지출 '현재 잔고' (사용자당 1값)
--   fixed_expense_settings : 현재 잔고 — 잔액(잔고-지출합계) 표시용. RLS 본인 전용.
-- =============================================================================

create table if not exists public.fixed_expense_settings (
  created_by  uuid primary key references public.users(id) on delete cascade,
  balance     numeric(15,2) not null default 0,
  updated_at  timestamptz not null default now()
);

create trigger set_fixed_expense_settings_updated_at
  before update on public.fixed_expense_settings
  for each row execute function public.handle_updated_at();

alter table public.fixed_expense_settings enable row level security;

create policy "fixed_expense_settings_select" on public.fixed_expense_settings for select to authenticated
  using (created_by = auth.uid());
create policy "fixed_expense_settings_insert" on public.fixed_expense_settings for insert to authenticated
  with check (created_by = auth.uid());
create policy "fixed_expense_settings_update" on public.fixed_expense_settings for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());
