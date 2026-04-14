-- 메모 테이블
create table if not exists public.memos (
  id         uuid primary key default uuid_generate_v4(),
  title      text not null,
  content    text,
  color      text not null default 'default',
  is_pinned  boolean not null default false,
  created_by uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 인덱스
create index if not exists idx_memos_created_by on public.memos(created_by);

-- updated_at 자동 갱신
create trigger set_memos_updated_at
  before update on public.memos
  for each row execute function public.handle_updated_at();

-- RLS: 본인 메모만 접근
alter table public.memos enable row level security;

create policy "memos_all" on public.memos for all to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());
