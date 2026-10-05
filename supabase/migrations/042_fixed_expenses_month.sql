-- =============================================================================
-- CLIO - 월 고정지출에 '적용 월' 추가 (월별 비교표용)
--   fixed_expenses.month : 'YYYY-MM' 형식. 월별 비교표에서 항목×월로 pivot.
--   기존 행(month null)은 비교표에서 '미지정'으로 제외/표기.
-- =============================================================================

alter table public.fixed_expenses add column if not exists month text;

create index if not exists idx_fixed_expenses_month on public.fixed_expenses(created_by, month);
