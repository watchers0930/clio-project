-- =============================================================================
-- CLIO - 대량이체 > 월지출 (그 달에만 발생하는 변동 지출)
--   monthly_expenses : 월별 변동 지출 — 항목명/금액/월(YYYY-MM)/메모
--
-- 고정지출(fixed_expenses, 매월 동일)과 별개. 당월 총지출 = 고정지출합계 + 당월 월지출합계.
-- RLS 본인 전용.
-- =============================================================================

create table if not exists public.monthly_expenses (
  id          uuid primary key default uuid_generate_v4(),
  label       text not null,                     -- 항목명
  amount      numeric(15,2) not null default 0,  -- 지출액(원)
  month       text not null,                     -- 발생 월 'YYYY-MM'
  memo        text,
  created_by  uuid not null references public.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_monthly_expenses_created_by_month on public.monthly_expenses(created_by, month);

create trigger set_monthly_expenses_updated_at
  before update on public.monthly_expenses
  for each row execute function public.handle_updated_at();

alter table public.monthly_expenses enable row level security;

create policy "monthly_expenses_select" on public.monthly_expenses for select to authenticated
  using (created_by = auth.uid());
create policy "monthly_expenses_insert" on public.monthly_expenses for insert to authenticated
  with check (created_by = auth.uid());
create policy "monthly_expenses_update" on public.monthly_expenses for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());
create policy "monthly_expenses_delete" on public.monthly_expenses for delete to authenticated
  using (created_by = auth.uid());
