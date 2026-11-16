import type { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api-helper';
import { feeMutationGate, feeReadGate, readJson, UNIQUE_VIOLATION } from '@/lib/maintenance-fees/route-guard';
import { validateItemInput } from '@/lib/maintenance-fees/validate';
import { ITEM_SELECT, mapItem } from '@/lib/maintenance-fees/map';

// GET — 관리비 항목 전체 (숨김 포함)
export async function GET() {
  const gate = await feeReadGate();
  if (gate.error) return gate.error;
  const { data, error } = await gate.db
    .from('maintenance_fee_items')
    .select(ITEM_SELECT)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
    .limit(500);
  if (error) return fail('항목을 불러오지 못했습니다.', 500);
  return ok((data ?? []).map(mapItem));
}

// POST — 항목 생성
export async function POST(request: NextRequest) {
  const gate = await feeMutationGate(request);
  if (gate.error) return gate.error;
  const v = validateItemInput(await readJson(request), 'create');
  if (!v.ok) return fail(v.error, 400);
  const { data, error } = await gate.db
    .from('maintenance_fee_items')
    .insert({ ...v.value, created_by: gate.userId })
    .select(ITEM_SELECT)
    .single();
  if (error?.code === UNIQUE_VIOLATION) return fail('같은 이름의 항목이 있습니다.', 409);
  if (error || !data) return fail('항목을 저장하지 못했습니다.', 500);
  return ok(mapItem(data), 201);
}
