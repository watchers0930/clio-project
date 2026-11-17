import type { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api-helper';
import { feeMutationGate, MAX_ITEMS, readJson } from '@/lib/maintenance-fees/route-guard';
import { validateReorder } from '@/lib/maintenance-fees/validate';

// PUT — 항목 순서 저장. 화면이 본 전체 항목 순서를 받아 DB 함수(065) 한 번으로 바꾼다(한 트랜잭션).
// 화면을 연 뒤 항목이 추가·삭제됐으면 낡은 목록이라 409 — 새로고침 후 다시 옮기게 한다.
export async function PUT(request: NextRequest) {
  const gate = await feeMutationGate(request);
  if (gate.error) return gate.error;
  const v = validateReorder(await readJson(request));
  if (!v.ok) return fail(v.error, 400);
  const { data, error } = await gate.db.from('maintenance_fee_items').select('id').limit(MAX_ITEMS + 1);
  if (error) return fail('순서를 저장하지 못했습니다.', 500);
  const current = new Set((data ?? []).map((r) => String(r.id).toLowerCase()));
  const same = current.size === v.value.length && v.value.every((id) => current.has(id.toLowerCase()));
  if (!same) return fail('항목 목록이 바뀌었습니다. 새로고침 후 다시 옮겨 주세요.', 409);
  const { error: rpcError } = await gate.db.rpc('reorder_maintenance_fee_items', { p_ids: v.value });
  // 대조와 저장 사이에 항목이 지워지면 함수가 22023(unknown id)로 전부 되돌린다 → 낡은 목록과 같은 안내
  if (rpcError?.code === '22023') return fail('항목 목록이 바뀌었습니다. 새로고침 후 다시 옮겨 주세요.', 409);
  if (rpcError) return fail('순서를 저장하지 못했습니다.', 500);
  return ok({ ids: v.value });
}
