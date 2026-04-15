-- 자동채우기 세션 테이블
create table if not exists public.autofill_sessions (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.users(id) on delete cascade,
  file_name       text not null,
  file_type       text not null check (file_type in ('docx', 'hwpx', 'hwp')),
  detected_fields jsonb not null default '[]',
  filled_values   jsonb not null default '{}',
  status          text not null default 'pending'
                  check (status in ('pending', 'analyzed', 'completed', 'error')),
  output_path     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_autofill_sessions_user_id on public.autofill_sessions(user_id);
create index if not exists idx_autofill_sessions_created_at on public.autofill_sessions(created_at desc);

-- updated_at 자동 갱신
create trigger set_autofill_sessions_updated_at
  before update on public.autofill_sessions
  for each row execute function public.handle_updated_at();

-- RLS: 본인 세션만 접근
alter table public.autofill_sessions enable row level security;

create policy "autofill_sessions_all" on public.autofill_sessions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
