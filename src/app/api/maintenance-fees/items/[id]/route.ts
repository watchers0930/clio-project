import type { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api-helper';
import { FK_VIOLATION, feeMutationGate, readJson, UNIQUE_VIOLATION } from '@/lib/maintenance-fees/route-guard';
import { isUuid, validateItemInput } from '@/lib/maintenance-fees/validate';
import { ITEM_SELECT, mapItem } from '@/lib/maintenance-fees/map';

// PATCH — 항목 수정 (이름·단위·기본 단가·순서·숨김)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await feeMutationGate(request);
  if (gate.error) return gate.error;
  if (!isUuid(id)) return fail('잘못된 항목입니다.', 400);
  const v = validateItemInput(await readJson(request), 'update');
  if (!v.ok) return fail(v.error, 400);
  const { data, error } = await gate.db
    .from('maintenance_fee_items')
    .update(v.value)
    .eq('id', id)
    .select(ITEM_SELECT)
    .maybeSingle();
  if (error?.code === UNIQUE_VIOLATION) return fail('같은 이름의 항목이 있습니다.', 409);
  if (error) return fail('항목을 저장하지 못했습니다.', 500);
  if (!data) return fail('항목을 찾을 수 없습니다.', 404);
  return ok(mapItem(data));
}

// DELETE — 기록이 없는 항목만 삭제 (기록이 있으면 숨기기 안내)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await feeMutationGate(request);
  if (gate.error) return gate.error;
  if (!isUuid(id)) return fail('잘못된 항목입니다.', 400);
  const { count, error: countError } = await gate.db
    .from('maintenance_fee_entries')
    .select('id', { count: 'exact', head: true })
    .eq('item_id', id);
  if (countError) return fail('항목을 삭제하지 못했습니다.', 500);
  if ((count ?? 0) > 0) return fail('기록이 있는 항목은 삭제할 수 없습니다. 숨기기를 사용해 주세요.', 409);
  const { data, error } = await gate.db.from('maintenance_fee_items').delete().eq('id', id).select('id').maybeSingle();
  // 확인과 삭제 사이에 기록이 생기면 FK(on delete restrict)가 막는다
  if (error?.code === FK_VIOLATION) return fail('기록이 있는 항목은 삭제할 수 없습니다. 숨기기를 사용해 주세요.', 409);
  if (error) return fail('항목을 삭제하지 못했습니다.', 500);
  if (!data) return fail('항목을 찾을 수 없습니다.', 404);
  return ok({ id });
}
