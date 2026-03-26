import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * POST /api/messages/send
 * 메시지 전송
 * body: { channelId: string, content: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { channelId, content } = body;

    if (!channelId) {
      return NextResponse.json(
        { success: false, error: '채널 ID가 필요합니다.' },
        { status: 400 },
      );
    }
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: '메시지 내용이 필요합니다.' },
        { status: 400 },
      );
    }

    /* ── Supabase 연동 ── */
    const supabase = await createServerSupabaseClient();
    if (supabase) {
      const userId = 'user-1'; // TODO: getUser()

      const { data, error } = await supabase
        .from('messages')
        .insert({
          channel_id: channelId,
          sender_id: userId,
          content: content.trim(),
        } as Record<string, unknown>)
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({ success: true, data }, { status: 201 });
    }

    /* ── 폴백: mock (메모리에만 저장) ── */
    const mockMsg = {
      id: `msg-${Date.now()}`,
      channel_id: channelId,
      user_id: 'user-1',
      content: content.trim(),
      is_read: false,
      created_at: new Date().toISOString(),
    };

    return NextResponse.json({ success: true, data: mockMsg }, { status: 201 });
  } catch {
    return NextResponse.json(
      { success: false, error: '메시지 전송 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
