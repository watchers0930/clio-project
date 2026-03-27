import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: '데이터베이스가 설정되지 않았습니다.' }, { status: 503 });
    }

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    // 멤버십 기반 채널 조회
    const { data: memberships } = await supabase
      .from('channel_members')
      .select('channel_id')
      .eq('user_id', authUserId);

    const memberRows = (memberships ?? []) as Array<{ channel_id: string }>;

    let channelList;
    if (memberRows.length > 0) {
      const channelIds = memberRows.map((m) => m.channel_id);
      const { data, error } = await supabase
        .from('channels')
        .select('*')
        .in('id', channelIds)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[messages/channels/GET]', error.message);
        return NextResponse.json({ success: false, error: '채널 조회에 실패했습니다.' }, { status: 500 });
      }
      channelList = data;
    } else {
      // 멤버십 없으면 빈 배열 반환
      channelList = [];
    }

    return NextResponse.json({ success: true, data: channelList ?? [] });
  } catch {
    return NextResponse.json(
      { success: false, error: '채널 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
