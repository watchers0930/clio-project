-- =============================================================================
-- CLIO - 작업내역 (프로젝트 수금 대장)
--   work_projects          : 프로젝트 본체 (계약액/수익률/열람팀 지정)
--   work_project_payments  : 대금 단계 (계약금/중도금 다회차/잔금)
-- =============================================================================

-- 프로젝트 본체 --------------------------------------------------------------
create table if not exists public.work_projects (
  id                    uuid primary key default uuid_generate_v4(),
  name                  text not null,
  status                text not null default 'in_progress',   -- in_progress/completed/on_hold/cancelled
  client_name           text,
  manager_id            uuid references public.users(id) on delete set null,
  contract_date         date,
  due_date              date,
  contract_amount       numeric(15,2) not null default 0,
  margin_rate           numeric(5,2) not null default 0,        -- 수익률 % (0~100)
  visible_department_ids uuid[] not null default '{}',          -- 빈 배열 = 전체 공개
  note                  text,
  created_by            uuid not null references public.users(id) on delete cascade,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_work_projects_created_by on public.work_projects(created_by);
create index if not exists idx_work_projects_status on public.work_projects(status);
create index if not exists idx_work_projects_visible_depts on public.work_projects using gin(visible_department_ids);

create trigger set_work_projects_updated_at
  before update on public.work_projects
  for each row execute function public.handle_updated_at();

alter table public.work_projects enable row level security;

-- 열람: 전체공개(빈 배열) OR 지정팀 소속 OR 작성자 OR admin
create policy "work_projects_select" on public.work_projects for select to authenticated
  using (
    cardinality(visible_department_ids) = 0
    or (select department_id from public.users where id = auth.uid()) = any(visible_department_ids)
    or created_by = auth.uid()
    or (select role from public.users where id = auth.uid()) = 'admin'
  );

-- 생성: 본인 명의로만
create policy "work_projects_insert" on public.work_projects for insert to authenticated
  with check (created_by = auth.uid());

-- 수정/삭제: 작성자 또는 admin
create policy "work_projects_update" on public.work_projects for update to authenticated
  using (
    created_by = auth.uid()
    or (select role from public.users where id = auth.uid()) = 'admin'
  );
create policy "work_projects_delete" on public.work_projects for delete to authenticated
  using (
    created_by = auth.uid()
    or (select role from public.users where id = auth.uid()) = 'admin'
  );

-- 대금 단계 --------------------------------------------------------------------
create table if not exists public.work_project_payments (
  id           uuid primary key default uuid_generate_v4(),
  project_id   uuid not null references public.work_projects(id) on delete cascade,
  type         text not null default 'interim',   -- down/interim/balance (계약금/중도금/잔금)
  seq          int not null default 1,            -- 중도금 회차
  amount       numeric(15,2) not null default 0,
  due_date     date,
  paid         boolean not null default false,
  paid_date    date,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_work_project_payments_project on public.work_project_payments(project_id);
create index if not exists idx_work_project_payments_due on public.work_project_payments(due_date);

create trigger set_work_project_payments_updated_at
  before update on public.work_project_payments
  for each row execute function public.handle_updated_at();

alter table public.work_project_payments enable row level security;

-- 대금 열람/수정 권한은 상위 프로젝트 권한을 따름
create policy "work_project_payments_select" on public.work_project_payments for select to authenticated
  using (
    exists (
      select 1 from public.work_projects p
      where p.id = project_id
        and (
          cardinality(p.visible_department_ids) = 0
          or (select department_id from public.users where id = auth.uid()) = any(p.visible_department_ids)
          or p.created_by = auth.uid()
          or (select role from public.users where id = auth.uid()) = 'admin'
        )
    )
  );

create policy "work_project_payments_mutate" on public.work_project_payments for all to authenticated
  using (
    exists (
      select 1 from public.work_projects p
      where p.id = project_id
        and (
          p.created_by = auth.uid()
          or (select role from public.users where id = auth.uid()) = 'admin'
        )
    )
  )
  with check (
    exists (
      select 1 from public.work_projects p
      where p.id = project_id
        and (
          p.created_by = auth.uid()
          or (select role from public.users where id = auth.uid()) = 'admin'
        )
    )
  );
