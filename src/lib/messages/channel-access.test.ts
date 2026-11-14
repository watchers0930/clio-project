import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isChannelMember } from '@/lib/messages/channel-access';

const CHANNEL = '8ca93f49-8e25-4eb6-93a4-3ada1593623d';
const USER = '1b2c3d4e-0000-4000-8000-000000000000';

// channel_members 조회만 흉내 내는 가짜 클라이언트 — 받은 eq 조건과 호출 여부를 기록한다
function fakeAdmin(result: { count: number | null; error: unknown }) {
  const calls: { table?: string; eq: Array<[string, unknown]> } = { eq: [] };
  const builder = {
    select: () => builder,
    eq: (column: string, value: unknown) => {
      calls.eq.push([column, value]);
      return calls.eq.length === 2 ? Promise.resolve(result) : builder;
    },
  };
  const client = { from: (table: string) => { calls.table = table; return builder; } };
  return { client: client as unknown as SupabaseClient, calls };
}

test('channel access: member row → true, filtered by channel and user', async () => {
  const { client, calls } = fakeAdmin({ count: 1, error: null });
  assert.equal(await isChannelMember(client, CHANNEL, USER), true);
  assert.equal(calls.table, 'channel_members');
  assert.deepEqual(calls.eq, [['channel_id', CHANNEL], ['user_id', USER]]);
});

test('channel access: no membership row → false', async () => {
  const { client } = fakeAdmin({ count: 0, error: null });
  assert.equal(await isChannelMember(client, CHANNEL, USER), false);
});

test('channel access: query error is treated as deny', async () => {
  const { client } = fakeAdmin({ count: null, error: { message: 'boom' } });
  assert.equal(await isChannelMember(client, CHANNEL, USER), false);
});

test('channel access: non-UUID channel or user id never queries the DB', async () => {
  for (const [channelId, userId] of [['abc', USER], [CHANNEL, ''], [null, USER], [`${CHANNEL},x`, USER], [CHANNEL, undefined]]) {
    const { client, calls } = fakeAdmin({ count: 1, error: null });
    assert.equal(await isChannelMember(client, channelId, userId), false);
    assert.equal(calls.table, undefined);
  }
});
