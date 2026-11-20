import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeMemberIds, resolveChannelMemberIds, MAX_CHANNEL_MEMBERS } from '@/lib/messages/channel-members';

const SELF = '1b2c3d4e-0000-4000-8000-000000000000';
const A = '2b2c3d4e-0000-4000-8000-000000000000';
const B = '3b2c3d4e-0000-4000-8000-000000000000';

test('멤버 목록 정리: 중복·본인 제거, 없으면 빈 목록', () => {
  assert.deepEqual(normalizeMemberIds([A, A, SELF, B], SELF), { ok: true, ids: [A, B] });
  assert.deepEqual(normalizeMemberIds(undefined, SELF), { ok: true, ids: [] });
  assert.deepEqual(normalizeMemberIds(null, SELF), { ok: true, ids: [] });
});

test('멤버 목록 거부: 배열 아님·UUID 아님·상한 초과', () => {
  assert.equal(normalizeMemberIds('x', SELF).ok, false);
  assert.equal(normalizeMemberIds([A, 'not-a-uuid'], SELF).ok, false);
  assert.equal(normalizeMemberIds([A, 1], SELF).ok, false);
  const many = Array.from({ length: MAX_CHANNEL_MEMBERS + 1 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
  assert.equal(normalizeMemberIds(many, SELF).ok, false);
});

// users 조회만 흉내 — in/eq 조건을 기록하고 정해진 행을 돌려준다
function fakeAdmin(rows: Array<{ id: string }> | null, error: unknown = null) {
  const calls: { table?: string; in?: [string, unknown]; eq: Array<[string, unknown]> } = { eq: [] };
  const result = Promise.resolve({ data: rows, error });
  const builder = {
    select: () => builder,
    in: (column: string, values: unknown) => { calls.in = [column, values]; return builder; },
    eq: (column: string, value: unknown) => { calls.eq.push([column, value]); return result; },
  };
  const client = { from: (table: string) => { calls.table = table; return builder; } };
  return { client: client as unknown as SupabaseClient, calls };
}

test('활성 사용자만 허용: 전원 활성이면 통과, 활성 사용자만 조회', async () => {
  const { client, calls } = fakeAdmin([{ id: A }, { id: B }]);
  assert.deepEqual(await resolveChannelMemberIds(client, SELF, [A, B]), { ok: true, ids: [A, B] });
  assert.equal(calls.table, 'users');
  assert.deepEqual(calls.in, ['id', [A, B]]);
  assert.deepEqual(calls.eq, [['is_active', true]]);
});

test('없는·비활성 사용자가 섞이면 거부, 조회 오류도 거부', async () => {
  assert.equal((await resolveChannelMemberIds(fakeAdmin([{ id: A }]).client, SELF, [A, B])).ok, false);
  assert.equal((await resolveChannelMemberIds(fakeAdmin(null, { message: 'x' }).client, SELF, [A])).ok, false);
});

test('빈 목록은 조회하지 않고 통과', async () => {
  const { client, calls } = fakeAdmin([]);
  assert.deepEqual(await resolveChannelMemberIds(client, SELF, []), { ok: true, ids: [] });
  assert.equal(calls.table, undefined);
});
