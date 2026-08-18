-- work_projects: 매입금액 컬럼 추가 (예상수익 = 계약총액 - 매입금액)
alter table public.work_projects
  add column if not exists purchase_amount numeric(15,2) not null default 0;
