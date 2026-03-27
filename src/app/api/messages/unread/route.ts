import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';

/**
 * GET /api/messages/unread — 채널별 안 읽은 메시지 수
 */
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ success: false, total: 0, channels: {} });

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ success: false, total: 0, channels: {} });

    const admin = createAdminSupabaseClient();

    // 내가 속한 채널 + last_read_at
    const { data: memberships } = await admin
      .from('channel_members')
      .select('channel_id, last_read_at')
      .eq('user_id', authUserId);

    if (!memberships || memberships.length === 0) {
      return NextResponse.json({ success: true, total: 0, channels: {} });
    }

    const channelUnread: Record<string, number> = {};
    let total = 0;

    for (const m of memberships) {
      const lastRead = m.last_read_at ?? '1970-01-01T00:00:00Z';

      // 해당 채널에서 last_read_at 이후 + 내가 보내지 않은 메시지 수
      const { count } = await admin
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('channel_id', m.channel_id)
        .gt('created_at', lastRead)
        .neq('sender_id', authUserId);

      const unread = count ?? 0;
      if (unread > 0) {
        channelUnread[m.channel_id] = unread;
        total += unread;
      }
    }

    return NextResponse.json({ success: true, total, channels: channelUnread });
  } catch {
    return NextResponse.json({ success: false, total: 0, channels: {} });
  }
}
