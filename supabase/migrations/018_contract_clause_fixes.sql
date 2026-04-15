-- 계약 조항 수정 제안 테이블
create table if not exists public.contract_clause_fixes (
  id              uuid primary key default uuid_generate_v4(),
  analysis_id     uuid not null references public.contract_risk_analyses(id) on delete cascade,
  user_id         uuid not null references public.users(id) on delete cascade,
  clause_index    integer not null,           -- 원본 리스크 항목 인덱스
  clause_title    text not null,              -- 조항 제목 (리스크 항목명)
  clause_text     text not null,              -- 원문 조항
  law_references  jsonb not null default '[]', -- 참조 법령 목록
  suggested_fix   text,                       -- AI 수정 제안
  status          text not null default 'pending'
                  check (status in ('pending', 'accepted', 'rejected', 'modified')),
  final_text      text,                       -- 최종 채택 문구
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_contract_clause_fixes_analysis_id
  on public.contract_clause_fixes(analysis_id);
create index if not exists idx_contract_clause_fixes_user_id
  on public.contract_clause_fixes(user_id);

-- updated_at 자동 갱신
create trigger set_contract_clause_fixes_updated_at
  before update on public.contract_clause_fixes
  for each row execute function public.handle_updated_at();

-- RLS: 본인 것만 접근
alter table public.contract_clause_fixes enable row level security;

create policy "contract_clause_fixes_all" on public.contract_clause_fixes
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
