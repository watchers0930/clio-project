import type { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api-helper';
import { feeMutationGate, feeReadGate, MAX_ITEMS, readJson, UNIQUE_VIOLATION } from '@/lib/maintenance-fees/route-guard';
import { validateItemInput } from '@/lib/maintenance-fees/validate';
import { ITEM_SELECT, mapItem } from '@/lib/maintenance-fees/map';

// GET — 관리비 항목 전체 (숨김 포함)
export async function GET() {
  const gate = await feeReadGate();
  if (gate.error) return gate.error;
  const { data, error, count } = await gate.db
    .from('maintenance_fee_items')
    .select(ITEM_SELECT, { count: 'exact' })
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
    .limit(MAX_ITEMS);
  if (error) return fail('항목을 불러오지 못했습니다.', 500);
  // 잘린 항목 목록이면 그 항목의 기록이 표에서 빠져 합계가 틀린다 → 조용히 자르지 않고 알린다
  if ((count ?? 0) > MAX_ITEMS) return fail(`항목이 ${MAX_ITEMS}개를 넘어 불러올 수 없습니다. 관리자에게 문의해 주세요.`, 500);
  return ok((data ?? []).map(mapItem));
}

// POST — 항목 생성
export async function POST(request: NextRequest) {
  const gate = await feeMutationGate(request);
  if (gate.error) return gate.error;
  const v = validateItemInput(await readJson(request), 'create');
  if (!v.ok) return fail(v.error, 400);
  const { count, error: countError } = await gate.db.from('maintenance_fee_items').select('id', { count: 'exact', head: true });
  if (countError) return fail('항목을 저장하지 못했습니다.', 500);
  if ((count ?? 0) >= MAX_ITEMS) return fail(`항목은 최대 ${MAX_ITEMS}개까지 등록할 수 있습니다. 쓰지 않는 항목을 삭제해 주세요.`, 409);
  const { data, error } = await gate.db
    .from('maintenance_fee_items')
    .insert({ ...v.value, created_by: gate.userId })
    .select(ITEM_SELECT)
    .single();
  if (error?.code === UNIQUE_VIOLATION) return fail('같은 이름의 항목이 있습니다.', 409);
  if (error || !data) return fail('항목을 저장하지 못했습니다.', 500);
  return ok(mapItem(data), 201);
}
