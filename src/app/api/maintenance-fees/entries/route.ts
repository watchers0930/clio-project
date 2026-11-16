import type { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api-helper';
import { feeMutationGate, feeReadGate, readJson, UNIQUE_VIOLATION } from '@/lib/maintenance-fees/route-guard';
import { parseYear, validateEntryCreate } from '@/lib/maintenance-fees/validate';
import { resolveAmount } from '@/lib/maintenance-fees/calc';
import { ENTRY_SELECT, mapEntry } from '@/lib/maintenance-fees/map';

// GET ?year=YYYY — 그 연도 기록 + 전년 12월(1월 전월 대비용), 최대 항목 수 × 13줄
export async function GET(request: NextRequest) {
  const gate = await feeReadGate();
  if (gate.error) return gate.error;
  const year = parseYear(request.nextUrl.searchParams.get('year'));
  if (year === null) return fail('연도가 올바르지 않습니다.', 400);
  const { data, error } = await gate.db
    .from('maintenance_fee_entries')
    .select(ENTRY_SELECT)
    .gte('month', `${year - 1}-12`)
    .lte('month', `${year}-12`)
    .order('month', { ascending: true })
    .limit(5000);
  if (error) return fail('관리비 기록을 불러오지 못했습니다.', 500);
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
  if (error || !data) return fail('관리비 기록을 저장하지 못했습니다.', 500);
  return ok(mapEntry(data), 201);
}
