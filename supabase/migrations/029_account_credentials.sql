-- account_credentials: 계정관리 (사이트 아이디/비밀번호 저장)
create table if not exists account_credentials (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  site_name   text not null,
  username    text not null,
  enc_password text not null,  -- AES-256-GCM 암호화
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- RLS
alter table account_credentials enable row level security;

create policy "본인 레코드만 조회" on account_credentials
  for select using (auth.uid() = user_id);

create policy "본인 레코드만 삽입" on account_credentials
  for insert with check (auth.uid() = user_id);

create policy "본인 레코드만 수정" on account_credentials
  for update using (auth.uid() = user_id);

create policy "본인 레코드만 삭제" on account_credentials
  for delete using (auth.uid() = user_id);

-- updated_at 자동 갱신
create or replace function update_account_credentials_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_account_credentials_updated_at
  before update on account_credentials
  for each row execute procedure update_account_credentials_updated_at();
