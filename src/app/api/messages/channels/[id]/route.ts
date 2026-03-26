import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { messages as mockMessages, users } from '@/lib/mock-data';

/**
 * GET /api/messages/channels/[id]
 * 특정 채널의 메시지 목록 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: channelId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 50)));
    const before = searchParams.get('before'); // 커서 기반 페이지네이션

    /* ── Supabase 연동 ── */
    const supabase = await createServerSupabaseClient();
    if (supabase) {
      let query = supabase
        .from('messages')
        .select('*, users:sender_id(name, avatar_url)')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (before) {
        query = query.lt('created_at', before);
      }

      const { data, error } = await query;
      if (error) throw error;

      // 메시지를 시간순(오래된 것 먼저)으로 반환
      interface MsgRow { id: string; channel_id: string; sender_id?: string | null; user_id?: string; content: string; created_at: string; users?: { name: string; avatar_url: string | null } | null }
      const rows = (data ?? []) as MsgRow[];
      const messages = rows.reverse().map((m) => ({
        id: m.id,
        channelId: m.channel_id,
        userId: m.sender_id ?? m.user_id ?? '',
        userName: m.users?.name ?? '알 수 없음',
        avatarUrl: m.users?.avatar_url ?? null,
        content: m.content,
        createdAt: m.created_at,
      }));

      return NextResponse.json({ success: true, data: messages });
    }

    /* ── 폴백: mock 데이터 ── */
    const filtered = mockMessages
      .filter((m) => m.channel_id === channelId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map((m) => {
        const user = users.find((u) => u.id === m.user_id);
        return {
          id: m.id,
          channelId: m.channel_id,
          userId: m.user_id,
          userName: user?.name ?? '알 수 없음',
          avatarUrl: user?.avatar_url ?? null,
          content: m.content,
          createdAt: m.created_at,
        };
      });

    return NextResponse.json({ success: true, data: filtered });
  } catch {
    return NextResponse.json(
      { success: false, error: '메시지 조회 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
