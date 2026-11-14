// 채널 가입 확인 단일 창구.
// 채널·메시지 쓰기는 사용자 세션이 막혀 있어(055) 서버가 service role 로 한다 — 그 전에 반드시 이 헬퍼로 가입 여부를 확인한다.
// (2026-11-14: 자기가입 후 남의 대화 열람이 실증되어 RLS 의존 대신 앱에서 확인)
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { uuid } from '@/lib/attendance/date';

/** 사용자가 채널 멤버인지 확인한다. channelId·userId 가 UUID 가 아니거나 조회 실패면 false(거부). */
export async function isChannelMember(
  admin: SupabaseClient,
  channelId: unknown,
  userId: unknown,
): Promise<boolean> {
  if (!uuid(channelId) || !uuid(userId)) return false;
  const { count, error } = await admin
    .from('channel_members')
    .select('channel_id', { count: 'exact', head: true })
    .eq('channel_id', channelId)
    .eq('user_id', userId);
  if (error) {
    console.warn('[channel-access] 가입 확인 실패 — 거부로 처리');
    return false;
  }
  return (count ?? 0) > 0;
}

/** 가입하지 않은 채널 접근 응답 */
export function notChannelMember(): NextResponse {
  return NextResponse.json({ success: false, error: '참여 중인 채널이 아닙니다.' }, { status: 403 });
}
