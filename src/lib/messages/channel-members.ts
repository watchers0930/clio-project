// 채널(DM·그룹) 생성 시 넣을 멤버 검증 단일 창구.
// 멤버 추가는 service role 로 하므로(055) 요청 값을 그대로 넣으면 없는·비활성 사용자도 방에 들어간다 — 반드시 여기서 거른다.
import type { SupabaseClient } from '@supabase/supabase-js';
import { uuid } from '@/lib/attendance/date';

export const MAX_CHANNEL_MEMBERS = 100;

export type MemberIdsResult = { ok: true; ids: string[] } | { ok: false; error: string };

/** 형식 검증: 배열·UUID·상한. 중복과 본인은 뺀다(본인은 생성 라우트가 따로 넣는다). */
export function normalizeMemberIds(raw: unknown, selfId: string): MemberIdsResult {
  if (raw === undefined || raw === null) return { ok: true, ids: [] };
  if (!Array.isArray(raw)) return { ok: false, error: '멤버 목록 형식이 올바르지 않습니다.' };
  if (!raw.every((id) => uuid(id))) return { ok: false, error: '멤버 ID 형식이 올바르지 않습니다.' };
  const ids = [...new Set(raw.map((id) => (id as string).toLowerCase()))].filter((id) => id !== selfId.toLowerCase());
  if (ids.length > MAX_CHANNEL_MEMBERS) return { ok: false, error: `멤버는 최대 ${MAX_CHANNEL_MEMBERS}명까지 추가할 수 있습니다.` };
  return { ok: true, ids };
}

/** 형식 검증 후, 전원이 실제로 있고 활성 상태인지 확인한다. 조회 실패는 거부. */
export async function resolveChannelMemberIds(admin: SupabaseClient, selfId: string, raw: unknown): Promise<MemberIdsResult> {
  const normalized = normalizeMemberIds(raw, selfId);
  if (!normalized.ok || normalized.ids.length === 0) return normalized;

  const { data, error } = await admin.from('users').select('id').in('id', normalized.ids).eq('is_active', true);
  if (error) {
    console.warn('[channel-members] 사용자 확인 실패 — 거부로 처리');
    return { ok: false, error: '멤버 확인 중 오류가 발생했습니다.' };
  }
  const active = new Set(((data ?? []) as Array<{ id: string }>).map((u) => u.id.toLowerCase()));
  if (normalized.ids.some((id) => !active.has(id))) {
    return { ok: false, error: '존재하지 않거나 비활성화된 사용자가 포함되어 있습니다.' };
  }
  return normalized;
}
