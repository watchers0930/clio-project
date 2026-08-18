-- work_projects: 매입처(공급처/외주처) 컬럼 추가
alter table public.work_projects
  add column if not exists supplier_name text;
