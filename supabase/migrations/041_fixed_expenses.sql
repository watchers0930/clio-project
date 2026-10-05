-- =============================================================================
-- CLIO - 대량이체 > 월 고정지출 (단순 가계부형)
--   fixed_expenses : 매월 반복되는 고정 지출 항목 — 항목명/금액/메모
--
-- 실제 이체와 무관한 '기록용' 목록. 거래처/계좌 연결 없음. RLS 본인 전용.
-- =============================================================================

create table if not exists public.fixed_expenses (
  id          uuid primary key default uuid_generate_v4(),
  label       text not null,                     -- 항목명 (예: 임대료, 4대보험)
  amount      numeric(15,2) not null default 0,  -- 월 지출액(원)
  memo        text,                              -- 메모 (선택)
  created_by  uuid not null references public.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_fixed_expenses_created_by on public.fixed_expenses(created_by);

create trigger set_fixed_expenses_updated_at
  before update on public.fixed_expenses
  for each row execute function public.handle_updated_at();

alter table public.fixed_expenses enable row level security;

-- 본인 전용 CRUD
create policy "fixed_expenses_select" on public.fixed_expenses for select to authenticated
  using (created_by = auth.uid());
create policy "fixed_expenses_insert" on public.fixed_expenses for insert to authenticated
  with check (created_by = auth.uid());
create policy "fixed_expenses_update" on public.fixed_expenses for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());
create policy "fixed_expenses_delete" on public.fixed_expenses for delete to authenticated
  using (created_by = auth.uid());
