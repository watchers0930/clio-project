import type { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api-helper';
import { ENTRY_FETCH_LIMIT, FK_VIOLATION, feeMutationGate, feeReadGate, readJson, UNIQUE_VIOLATION } from '@/lib/maintenance-fees/route-guard';
import { parseYear, validateEntryCreate } from '@/lib/maintenance-fees/validate';
import { resolveAmount } from '@/lib/maintenance-fees/calc';
import { ENTRY_SELECT, mapEntry } from '@/lib/maintenance-fees/map';

// GET ?year=YYYY — 그 연도 기록 + 전년 12월(1월 전월 대비용), 최대 항목 수 × 13줄
export async function GET(request: NextRequest) {
  const gate = await feeReadGate();
  if (gate.error) return gate.error;
  const year = parseYear(request.nextUrl.searchParams.get('year'));
  if (year === null) return fail('연도가 올바르지 않습니다.', 400);
  const { data, error, count } = await gate.db
    .from('maintenance_fee_entries')
    .select(ENTRY_SELECT, { count: 'exact' })
    .gte('month', `${year - 1}-12`)
    .lte('month', `${year}-12`)
    .order('month', { ascending: true })
    .limit(ENTRY_FETCH_LIMIT);
  if (error) return fail('관리비 기록을 불러오지 못했습니다.', 500);
  // 잘린 목록으로 합계가 틀리게 보이지 않도록, 상한을 넘으면 보여주지 않고 알린다
  if ((count ?? 0) > ENTRY_FETCH_LIMIT) return fail('관리비 기록이 너무 많아 한 번에 불러올 수 없습니다. 관리자에게 문의해 주세요.', 500);
  return ok((data ?? []).map(mapEntry));
}

// POST — 월별 기록 생성 (금액은 서버가 최종 결정)
export async function POST(request: NextRequest) {
  const gate = await feeMutationGate(request);
  if (gate.error) return gate.error;
  const v = validateEntryCreate(await readJson(request));
  if (!v.ok) return fail(v.error, 400);
  const { data: item, error: itemError } = await gate.db
    .from('maintenance_fee_items')
    .select('id, is_active')
    .eq('id', v.value.item_id)
    .maybeSingle();
  if (itemError) return fail('관리비 기록을 저장하지 못했습니다.', 500);
  if (!item || item.is_active === false) return fail('사용할 수 없는 항목입니다.', 400);
  const resolved = resolveAmount(v.value);
  if ('error' in resolved) return fail(resolved.error, 400);
  const { data, error } = await gate.db
    .from('maintenance_fee_entries')
    .insert({ ...v.value, ...resolved, created_by: gate.userId, updated_by: gate.userId })
    .select(ENTRY_SELECT)
    .single();
  if (error?.code === UNIQUE_VIOLATION) return fail('이 달에 이미 입력된 항목입니다.', 409);
  // 활성 확인과 저장 사이에 항목이 삭제된 경우
  if (error?.code === FK_VIOLATION) return fail('사용할 수 없는 항목입니다.', 400);
  if (error || !data) return fail('관리비 기록을 저장하지 못했습니다.', 500);
  return ok(mapEntry(data), 201);
}
