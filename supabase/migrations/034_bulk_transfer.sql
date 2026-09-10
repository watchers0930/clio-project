-- =============================================================================
-- CLIO - 하나은행 대량이체 (지급/출금)
--   transfer_payees : 거래처(수취인) — 은행/계좌번호(암호화)/예금주/휴대폰
--   transfer_items  : 이체 예정 건 — 거래처·금액·적요·통장표시·상태·출처
--
-- 실제 이체는 하나은행 사이트에서 수행. 클리오는 대량이체 업로드 파일만 생성.
-- 계좌번호는 애플리케이션단 AES-256-GCM 암호화 저장(enc_account). RLS는 본인 전용.
-- =============================================================================

-- 거래처(수취인) --------------------------------------------------------------
create table if not exists public.transfer_payees (
  id             uuid primary key default uuid_generate_v4(),
  name           text not null,                 -- 거래처/수취인 표시명
  bank_code      text not null,                 -- 금융결제원 3자리 코드 (예: '081')
  enc_account    text not null,                 -- 계좌번호 암호화 저장(하이픈 제외 숫자 평문을 암호화)
  account_holder text,                          -- 예상예금주 (검증 비교용, 선택)
  notify_phone   text,                          -- 기본 SMS 통지 번호 (선택)
  memo           text,                          -- 내부 메모 (선택)
  created_by     uuid not null references public.users(id) on delete cascade,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_transfer_payees_created_by on public.transfer_payees(created_by);

create trigger set_transfer_payees_updated_at
  before update on public.transfer_payees
  for each row execute function public.handle_updated_at();

alter table public.transfer_payees enable row level security;

-- 거래처 계좌는 민감정보 → 본인만 열람/생성/수정/삭제 (팀 공유 안 함)
create policy "transfer_payees_select" on public.transfer_payees for select to authenticated
  using (created_by = auth.uid());
create policy "transfer_payees_insert" on public.transfer_payees for insert to authenticated
  with check (created_by = auth.uid());
create policy "transfer_payees_update" on public.transfer_payees for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());
create policy "transfer_payees_delete" on public.transfer_payees for delete to authenticated
  using (created_by = auth.uid());

-- 이체 예정 건 ----------------------------------------------------------------
create table if not exists public.transfer_items (
  id               uuid primary key default uuid_generate_v4(),
  payee_id         uuid references public.transfer_payees(id) on delete restrict,
  payee_name       text not null,                     -- 표시용 스냅샷 (거래처 삭제/변경 대비)
  amount           numeric(15,2) not null default 0,  -- 입금액(원)
  deposit_display  text,                              -- 입금통장표시 (받는분 통장 인쇄)
  withdraw_display text,                              -- 출금통장표시 (보내는분 통장 인쇄)
  memo             text,                              -- 파일메모 (내부용)
  cms_code         text,                              -- CMS코드 (CMS이체시만)
  notify_phone     text,                              -- 이 건 SMS 통지 번호 (선택)
  status           text not null default 'pending',   -- pending/exported/done
  source_type      text not null default 'manual',    -- manual/contract
  source_id        uuid,                              -- 출처 레코드 id (계약서 등)
  created_by       uuid not null references public.users(id) on delete cascade,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_transfer_items_created_by on public.transfer_items(created_by);
create index if not exists idx_transfer_items_status on public.transfer_items(status);
create index if not exists idx_transfer_items_payee on public.transfer_items(payee_id);

create trigger set_transfer_items_updated_at
  before update on public.transfer_items
  for each row execute function public.handle_updated_at();

alter table public.transfer_items enable row level security;

-- 이체 건도 본인 전용 CRUD
create policy "transfer_items_select" on public.transfer_items for select to authenticated
  using (created_by = auth.uid());
create policy "transfer_items_insert" on public.transfer_items for insert to authenticated
  with check (created_by = auth.uid());
create policy "transfer_items_update" on public.transfer_items for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());
create policy "transfer_items_delete" on public.transfer_items for delete to authenticated
  using (created_by = auth.uid());
