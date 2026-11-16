-- =============================================================================
-- CLIO - 관리비 (시스템 관리자 role='admin' 전용 공용 장부)
--   maintenance_fee_items   : 관리비 항목 — 이름/단위/기본 단가/순서/숨김
--   maintenance_fee_entries : 월별 기록 — 항목/월(YYYY-MM)/사용량/단가/금액/직접입력 여부
--
-- 금액 = 반올림(사용량 × 단가). 고지서 금액으로 직접 고치면 amount_overridden = true.
-- 권한: RLS 켜고 사용자 세션 정책 0개 — 서버(service role) 전용(055 방식).
--   앱은 서버 API 가 requireAdmin 확인 후 service role 로만 읽고 쓴다(Supabase REST 직접 접근 차단).
-- 작성자 삭제 시 기록은 남긴다(공용 장부) → created_by/updated_by on delete set null.
-- 한 트랜잭션으로 실행 — 중간에 실패하면 아무것도 남지 않고, 다시 실행해도 된다.
-- =============================================================================

begin;

create table if not exists public.maintenance_fee_items (
  id                 uuid primary key default uuid_generate_v4(),
  name               text not null check (char_length(btrim(name)) between 1 and 50),  -- 항목명 (예: 전기, 수도)
  unit               text check (char_length(unit) <= 20),                             -- 단위 (예: kWh, ㎥)
  default_unit_price numeric(15,2),                                                    -- 기본 단가(원)
  sort_order         int not null default 0,
  is_active          boolean not null default true,                                    -- false = 숨김(지난 기록 보존)
  created_by         uuid references public.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create unique index if not exists uq_maintenance_fee_items_name on public.maintenance_fee_items (btrim(name));

create table if not exists public.maintenance_fee_entries (
  id                uuid primary key default uuid_generate_v4(),
  item_id           uuid not null references public.maintenance_fee_items(id) on delete restrict,
  month             text not null check (month ~ '^(20[0-9]{2})-(0[1-9]|1[0-2])$'),  -- 'YYYY-MM'
  usage             numeric(15,3),                    -- 사용량 (없을 수 있음: 일반관리비 등)
  unit_price        numeric(15,2),                    -- 단가(원)
  amount            numeric(15,0) not null,           -- 금액(원), 음수 = 정산 환급
  amount_overridden boolean not null default false,   -- 고지서 금액으로 직접 고침
  memo              text check (char_length(memo) <= 200),
  created_by        uuid references public.users(id) on delete set null,
  updated_by        uuid references public.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (item_id, month)
);

create index if not exists idx_maintenance_fee_entries_month on public.maintenance_fee_entries (month);

drop trigger if exists set_maintenance_fee_items_updated_at on public.maintenance_fee_items;
create trigger set_maintenance_fee_items_updated_at
  before update on public.maintenance_fee_items
  for each row execute function public.handle_updated_at();

drop trigger if exists set_maintenance_fee_entries_updated_at on public.maintenance_fee_entries;
create trigger set_maintenance_fee_entries_updated_at
  before update on public.maintenance_fee_entries
  for each row execute function public.handle_updated_at();

-- 사용자 세션 정책은 만들지 않는다(서버 service role 전용).
alter table public.maintenance_fee_items enable row level security;
alter table public.maintenance_fee_entries enable row level security;

commit;
