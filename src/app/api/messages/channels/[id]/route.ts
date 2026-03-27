import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: channelId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 50)));
    const before = searchParams.get('before');

    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

    const admin = createAdminSupabaseClient();

    let query = admin
      .from('messages')
      .select('*, users:sender_id(name, avatar_url), documents:document_id(id, title, status)')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (before) query = query.lt('created_at', before);

    const { data, error } = await query;
    if (error) {
      console.error('[messages/channels/[id]/GET]', error.message);
      return NextResponse.json({ success: false, error: '메시지 조회 실패' }, { status: 500 });
    }

    interface MsgRow { id: string; channel_id: string; sender_id?: string | null; content: string; created_at: string; users?: { name: string; avatar_url: string | null } | null; documents?: { id: string; title: string; status: string } | null }
    const rows = (data ?? []) as MsgRow[];
    const messages = rows.reverse().map((m) => ({
      id: m.id,
      channelId: m.channel_id,
      userId: m.sender_id ?? '',
      userName: m.users?.name ?? '알 수 없음',
      avatarUrl: m.users?.avatar_url ?? null,
      content: m.content,
      createdAt: m.created_at,
      document: m.documents ?? null,
    }));

    return NextResponse.json({ success: true, data: messages });
  } catch {
    return NextResponse.json({ success: false, error: '메시지 조회 중 오류' }, { status: 500 });
  }
}
