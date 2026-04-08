-- =============================================================================
-- CLIO - 일정(Events) + 할일(Todos) 테이블
-- =============================================================================

-- 일정 테이블
create table if not exists public.events (
  id            uuid primary key default uuid_generate_v4(),
  title         text not null,
  description   text,
  location      text,
  event_type    text not null default 'meeting',
  start_at      timestamptz not null,
  end_at        timestamptz not null,
  all_day       boolean not null default false,
  department_id uuid references public.departments(id) on delete set null,
  created_by    uuid not null references public.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_events_start_at on public.events(start_at);
create index if not exists idx_events_created_by on public.events(created_by);

create trigger set_events_updated_at
  before update on public.events
  for each row execute function public.handle_updated_at();

alter table public.events enable row level security;

create policy "events_select" on public.events for select to authenticated
  using (
    department_id is null
    or department_id in (select department_id from public.users where id = auth.uid())
    or created_by = auth.uid()
  );
create policy "events_insert" on public.events for insert to authenticated
  with check (created_by = auth.uid());
create policy "events_update" on public.events for update to authenticated
  using (created_by = auth.uid());
create policy "events_delete" on public.events for delete to authenticated
  using (created_by = auth.uid());

-- 할일 테이블
create table if not exists public.todos (
  id            uuid primary key default uuid_generate_v4(),
  title         text not null,
  description   text,
  due_date      date,
  priority      text not null default 'medium',
  status        text not null default 'active',
  completed_at  timestamptz,
  user_id       uuid not null references public.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_todos_user_id on public.todos(user_id);
create index if not exists idx_todos_due_date on public.todos(due_date);

create trigger set_todos_updated_at
  before update on public.todos
  for each row execute function public.handle_updated_at();

alter table public.todos enable row level security;

create policy "todos_all" on public.todos for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
