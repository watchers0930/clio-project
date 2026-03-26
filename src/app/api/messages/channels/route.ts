import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { channels as mockChannels } from '@/lib/mock-data';

/**
 * GET /api/messages/channels
 * 채널 목록 조회 (channel_members 기반 또는 전체)
 */
export async function GET() {
  try {
    /* ── Supabase 연동 ── */
    const supabase = await createServerSupabaseClient();
    if (supabase) {
      // 현재 사용자의 채널 멤버십 기반으로 채널 조회
      // TODO: getUser()로 실제 사용자 ID 사용
      const userId = 'user-1';

      const { data: memberships, error: memberErr } = await supabase
        .from('channel_members')
        .select('channel_id')
        .eq('user_id', userId);

      let channelList;
      const memberRows = (memberships ?? []) as Array<{ channel_id: string }>;

      if (!memberErr && memberRows.length > 0) {
        // 멤버십 기반 채널 조회
        const channelIds = memberRows.map((m) => m.channel_id);
        const { data, error } = await supabase
          .from('channels')
          .select('*')
          .in('id', channelIds)
          .order('created_at', { ascending: false });

        if (error) throw error;
        channelList = data;
      } else {
        // 멤버십 없으면 전체 채널 조회 (폴백)
        const { data, error } = await supabase
          .from('channels')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        channelList = data;
      }

      return NextResponse.json({ success: true, data: channelList ?? [] });
    }

    /* ── 폴백: mock 데이터 ── */
    return NextResponse.json({ success: true, data: mockChannels });
  } catch {
    return NextResponse.json(
      { success: false, error: '채널 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
