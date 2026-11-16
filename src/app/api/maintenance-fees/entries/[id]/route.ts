import type { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api-helper';
import { feeMutationGate, readJson } from '@/lib/maintenance-fees/route-guard';
import { isUuid, validateEntryUpdate } from '@/lib/maintenance-fees/validate';
import { resolveAmount } from '@/lib/maintenance-fees/calc';
import { ENTRY_SELECT, mapEntry } from '@/lib/maintenance-fees/map';

// PATCH — 사용량·단가·금액·메모 전체 교체 (항목·월은 고정). 직접 입력 금액은 계산값으로 덮어쓰지 않는다.
// 두 관리자가 같은 기록을 동시에 고치면 updated_at 이 달라져 0행 → 409(나중 저장이 소리 없이 덮어쓰지 않게).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await feeMutationGate(request);
  if (gate.error) return gate.error;
  if (!isUuid(id)) return fail('잘못된 기록입니다.', 400);
  const v = validateEntryUpdate(await readJson(request));
  if (!v.ok) return fail(v.error, 400);
  const { updated_at: loadedAt, ...fields } = v.value;
  const resolved = resolveAmount(fields);
  if ('error' in resolved) return fail(resolved.error, 400);
  const { data, error } = await gate.db
    .from('maintenance_fee_entries')
    .update({ ...fields, ...resolved, updated_by: gate.userId })
    .eq('id', id)
    .eq('updated_at', loadedAt)
    .select(ENTRY_SELECT)
    .maybeSingle();
  if (error) return fail('관리비 기록을 저장하지 못했습니다.', 500);
  if (!data) {
    const { data: exists } = await gate.db.from('maintenance_fee_entries').select('id').eq('id', id).maybeSingle();
    return exists
      ? fail('다른 관리자가 먼저 수정했습니다. 새로고침 후 다시 확인해 주세요.', 409)
      : fail('기록을 찾을 수 없습니다.', 404);
  }
  return ok(mapEntry(data));
}

// DELETE — 기록 삭제
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await feeMutationGate(request);
  if (gate.error) return gate.error;
  if (!isUuid(id)) return fail('잘못된 기록입니다.', 400);
  const { data, error } = await gate.db.from('maintenance_fee_entries').delete().eq('id', id).select('id').maybeSingle();
  if (error) return fail('관리비 기록을 삭제하지 못했습니다.', 500);
  if (!data) return fail('기록을 찾을 수 없습니다.', 404);
  return ok({ id });
}
