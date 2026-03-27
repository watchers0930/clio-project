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
      .select('*, users:sender_id(name, avatar_url), documents:document_id(id, title, status), shared_file:shared_file_id(id, name, type, size)')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (before) query = query.lt('created_at', before);

    const { data, error } = await query;
    if (error) {
      console.error('[messages/channels/[id]/GET]', error.message);
      return NextResponse.json({ success: false, error: '메시지 조회 실패' }, { status: 500 });
    }

    interface MsgRow { id: string; channel_id: string; sender_id?: string | null; content: string; created_at: string; attachment_name?: string | null; attachment_size?: string | null; users?: { name: string; avatar_url: string | null } | null; documents?: { id: string; title: string; status: string } | null; shared_file?: { id: string; name: string; type: string | null; size: number } | null }
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
      sharedFile: m.shared_file ?? null,
      attachmentName: m.attachment_name ?? null,
      attachmentSize: m.attachment_size ?? null,
    }));

    // last_read_at 갱신 (이 채널을 읽었음을 표시)
    try {
      await admin.from('channel_members')
        .update({ last_read_at: new Date().toISOString() })
        .eq('channel_id', channelId)
        .eq('user_id', authUserId);
    } catch {}

    return NextResponse.json({ success: true, data: messages });
  } catch {
    return NextResponse.json({ success: false, error: '메시지 조회 중 오류' }, { status: 500 });
  }
}
