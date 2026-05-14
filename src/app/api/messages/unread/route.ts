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

    const membershipMap = new Map(
      memberships.map((membership) => [
        membership.channel_id,
        membership.last_read_at ?? '1970-01-01T00:00:00Z',
      ]),
    );
    const channelIds = memberships.map((membership) => membership.channel_id);
    const oldestLastReadAt = memberships.reduce((minValue, membership) => {
      const currentValue = membership.last_read_at ?? '1970-01-01T00:00:00Z';
      return currentValue < minValue ? currentValue : minValue;
    }, '1970-01-01T00:00:00Z');

    const { data: messages } = await admin
      .from('messages')
      .select('channel_id, created_at, sender_id')
      .in('channel_id', channelIds)
      .gt('created_at', oldestLastReadAt)
      .neq('sender_id', authUserId)
      .order('created_at', { ascending: false })
      .limit(1000);

    const channelUnread: Record<string, number> = {};
    for (const message of (messages ?? []) as Array<{ channel_id: string | null; created_at: string; sender_id: string | null }>) {
      if (!message.channel_id) continue;
      const lastRead = membershipMap.get(message.channel_id);
      if (!lastRead || message.created_at <= lastRead) continue;
      channelUnread[message.channel_id] = (channelUnread[message.channel_id] ?? 0) + 1;
    }

    let total = 0;
    for (const unread of Object.values(channelUnread)) {
      total += unread;
    }

    if ((messages ?? []).length === 1000) {
      for (const channelId of channelIds) {
        if (!channelUnread[channelId]) {
          channelUnread[channelId] = 0;
        }
      }
    }

    return NextResponse.json({ success: true, total, channels: channelUnread });
  } catch {
    return NextResponse.json({ success: false, total: 0, channels: {} });
  }
}
