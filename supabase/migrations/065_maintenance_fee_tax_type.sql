-- =============================================================================
-- 065: 관리비 항목 과세 구분 + 순서 일괄 저장
--
-- 고지서(관리비 납입영수증)는 과세 항목 → 공급가액 → 부가세 → 과세합, 비과세 항목 → 비과세합 → 당월 부과액 순이다.
--   tax_type: 'taxable'(과세) / 'exempt'(비과세) / 'vat'(부가세 — 고지서 금액을 직접 입력하는 한 줄, 장부에 1개만)
--   기존 항목은 'taxable' 로 채워진다(운영 9개는 적용 뒤 별도로 고지서대로 지정).
-- 순서: 화면 ↑↓ 결과를 reorder_maintenance_fee_items(ids) 한 번으로 저장 — 중간 실패 시 순서가 반쯤 바뀌지 않게 한 트랜잭션.
--   서버 API(service role)만 부른다 → 그 외 실행 권한 회수(테이블도 056 부터 서버 전용).
--
-- 옛 코드와 호환: 칸만 늘고 기본값이 있어 이 마이그레이션을 먼저 적용해도 v7.98.6 은 그대로 동작한다.
-- 되돌리기: drop function public.reorder_maintenance_fee_items(uuid[]);
--           drop index public.uq_maintenance_fee_items_vat; alter table public.maintenance_fee_items drop column tax_type;
-- =============================================================================

begin;

alter table public.maintenance_fee_items
  add column if not exists tax_type text not null default 'taxable'
  check (tax_type in ('taxable', 'exempt', 'vat'));

-- 부가세 항목은 하나만(숨긴 것 포함) — 둘이면 과세합이 두 번 더해진다
create unique index if not exists uq_maintenance_fee_items_vat
  on public.maintenance_fee_items (tax_type) where tax_type = 'vat';

-- 넘겨받은 순서대로 sort_order = 1, 2, 3 … 중복·없는 id 가 있으면 전부 되돌린다
create or replace function public.reorder_maintenance_fee_items(p_ids uuid[])
returns void
language plpgsql
set search_path = public
as $$
declare
  v_count int;
begin
  if p_ids is null or cardinality(p_ids) = 0 then
    raise exception 'empty order' using errcode = '22023';
  end if;
  if cardinality(p_ids) <> (select count(distinct x) from unnest(p_ids) as x) then
    raise exception 'duplicate id' using errcode = '22023';
  end if;
  update public.maintenance_fee_items as i
     set sort_order = o.pos
    from unnest(p_ids) with ordinality as o(id, pos)
   where i.id = o.id;
  get diagnostics v_count = row_count;
  if v_count <> cardinality(p_ids) then
    raise exception 'unknown id' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.reorder_maintenance_fee_items(uuid[]) from public, anon, authenticated;
grant execute on function public.reorder_maintenance_fee_items(uuid[]) to service_role;

commit;
