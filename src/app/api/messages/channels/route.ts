import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';

/**
 * GET /api/messages/channels — 내가 속한 채널 목록
 */
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

    // adminClient로 멤버십 조회 (RLS bypass)
    const admin = createAdminSupabaseClient();

    const { data: memberships } = await admin
      .from('channel_members')
      .select('channel_id')
      .eq('user_id', authUserId);

    const memberRows = (memberships ?? []) as Array<{ channel_id: string }>;

    if (memberRows.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const channelIds = memberRows.map((m) => m.channel_id);
    const { data, error } = await admin
      .from('channels')
      .select('*')
      .in('id', channelIds)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ success: false, error: '채널 조회 실패' }, { status: 500 });

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch {
    return NextResponse.json({ success: false, error: '채널 조회 중 오류' }, { status: 500 });
  }
}

/**
 * POST /api/messages/channels — DM 또는 그룹 채널 생성
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

    const { type, targetUserId, name, memberIds } = await request.json();
    const admin = createAdminSupabaseClient();

    if (type === 'direct') {
      if (!targetUserId) return NextResponse.json({ success: false, error: '대상 사용자가 필요합니다.' }, { status: 400 });

      // 이미 DM 채널이 있는지 확인
      const { data: myChannels } = await admin.from('channel_members').select('channel_id').eq('user_id', authUserId);
      const { data: targetChannels } = await admin.from('channel_members').select('channel_id').eq('user_id', targetUserId);

      const myIds = new Set((myChannels ?? []).map((c) => c.channel_id));
      const commonIds = (targetChannels ?? []).filter((c) => myIds.has(c.channel_id)).map((c) => c.channel_id);

      if (commonIds.length > 0) {
        const { data: existing } = await admin.from('channels').select('*').in('id', commonIds).eq('type', 'direct').limit(1);
        if (existing && existing.length > 0) {
          return NextResponse.json({ success: true, data: existing[0] });
        }
      }

      // 이름 조회
      const { data: targetUser } = await admin.from('users').select('name').eq('id', targetUserId).single();
      const { data: myUser } = await admin.from('users').select('name').eq('id', authUserId).single();
      const channelName = `${myUser?.name ?? '나'}, ${targetUser?.name ?? '상대방'}`;

      // 채널 생성
      const { data: channel, error: chErr } = await admin.from('channels').insert({ name: channelName, type: 'direct' }).select().single();
      if (chErr || !channel) return NextResponse.json({ success: false, error: '채널 생성 실패: ' + (chErr?.message ?? '') }, { status: 500 });

      // 멤버 추가
      const { error: memErr } = await admin.from('channel_members').insert([
        { channel_id: channel.id, user_id: authUserId },
        { channel_id: channel.id, user_id: targetUserId },
      ]);
      if (memErr) console.error('[channels/POST] members insert:', memErr.message);

      return NextResponse.json({ success: true, data: channel }, { status: 201 });
    }

    if (type === 'group') {
      if (!name) return NextResponse.json({ success: false, error: '그룹 이름이 필요합니다.' }, { status: 400 });

      const { data: channel, error: chErr } = await admin.from('channels').insert({ name, type: 'group' }).select().single();
      if (chErr || !channel) return NextResponse.json({ success: false, error: '채널 생성 실패' }, { status: 500 });

      const allMembers = [authUserId, ...(memberIds ?? [])].map((uid) => ({ channel_id: channel.id, user_id: uid }));
      await admin.from('channel_members').insert(allMembers);

      return NextResponse.json({ success: true, data: channel }, { status: 201 });
    }

    return NextResponse.json({ success: false, error: '유효하지 않은 채널 타입입니다.' }, { status: 400 });
  } catch {
    return NextResponse.json({ success: false, error: '채널 생성 중 오류' }, { status: 500 });
  }
}
