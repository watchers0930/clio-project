import { withMutation } from '@/lib/http/mutation-guard';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import { createNotifications } from '@/lib/notifications/create-notification';
import { isChannelMember, notChannelMember } from '@/lib/messages/channel-access';
import { normalizeMemberIds, resolveChannelMemberIds } from '@/lib/messages/channel-members';

const MAX_GROUP_NAME_LENGTH = 100;

// 멤버를 못 넣은 새 채널을 지운다 — 실패하면 빈 채널이 남으므로 로그로 남긴다
async function rollbackChannel(admin: ReturnType<typeof createAdminSupabaseClient>, channelId: string) {
  const { error } = await admin.from('channels').delete().eq('id', channelId);
  if (error) console.error('[channels/POST] rollback failed:', channelId, error.message);
}

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
  // 변이 요청: 출처 + CSRF 토큰 + 활성 사용자 확인 (기존 권한 확인은 아래 그대로)
  const mutation = await withMutation(request);
  if (mutation.error) return mutation.error;
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

    const { type, targetUserId, name, memberIds } = await request.json();
    const admin = createAdminSupabaseClient();

    if (type === 'direct') {
      if (!targetUserId) return NextResponse.json({ success: false, error: '대상 사용자가 필요합니다.' }, { status: 400 });
      // 형식·본인 확인만 먼저 — 활성 여부는 새로 만들 때만 본다(퇴사자와의 기존 DM 은 계속 열 수 있게)
      const target = normalizeMemberIds([targetUserId], authUserId);
      if (!target.ok) return NextResponse.json({ success: false, error: target.error }, { status: 400 });
      if (target.ids.length !== 1) return NextResponse.json({ success: false, error: '본인과는 대화방을 만들 수 없습니다.' }, { status: 400 });
      const targetId = target.ids[0];

      // 이미 DM 채널이 있는지 확인
      const { data: myChannels } = await admin.from('channel_members').select('channel_id').eq('user_id', authUserId);
      const { data: targetChannels } = await admin.from('channel_members').select('channel_id').eq('user_id', targetId);

      const myIds = new Set((myChannels ?? []).map((c) => c.channel_id));
      const commonIds = (targetChannels ?? []).filter((c) => myIds.has(c.channel_id)).map((c) => c.channel_id);

      if (commonIds.length > 0) {
        const { data: existing } = await admin.from('channels').select('*').in('id', commonIds).eq('type', 'direct').limit(1);
        if (existing && existing.length > 0) {
          return NextResponse.json({ success: true, data: existing[0] });
        }
      }

      // 새 DM 은 실제로 있는 활성 사용자와만
      const activeTarget = await resolveChannelMemberIds(admin, authUserId, [targetId]);
      if (!activeTarget.ok) return NextResponse.json({ success: false, error: activeTarget.error }, { status: 400 });

      // 이름 조회
      const { data: targetUser } = await admin.from('users').select('name').eq('id', targetId).single();
      const { data: myUser } = await admin.from('users').select('name').eq('id', authUserId).single();
      const channelName = `${myUser?.name ?? '나'}, ${targetUser?.name ?? '상대방'}`;

      // 채널 생성
      const { data: channel, error: chErr } = await admin.from('channels').insert({ name: channelName, type: 'direct' }).select().single();
      if (chErr || !channel) return NextResponse.json({ success: false, error: '채널 생성 실패: ' + (chErr?.message ?? '') }, { status: 500 });

      // 멤버 추가
      const { error: memErr } = await admin.from('channel_members').insert([
        { channel_id: channel.id, user_id: authUserId },
        { channel_id: channel.id, user_id: targetId },
      ]);
      if (memErr) {
        // 멤버 없는 빈 채널이 남지 않게 되돌린다
        console.error('[channels/POST] members insert:', memErr.message);
        await rollbackChannel(admin, channel.id);
        return NextResponse.json({ success: false, error: '채널 생성 실패' }, { status: 500 });
      }

      // 채팅 신청(신규 DM 개설) 시 상대에게 알림. best-effort.
      await createNotifications(admin, {
        recipientIds: [targetId],
        actorId: authUserId,
        type: 'chat_request',
        title: `${myUser?.name ?? '누군가'}님이 채팅을 시작했습니다`,
        body: null,
        link: '/messages',
      });

      return NextResponse.json({ success: true, data: channel }, { status: 201 });
    }

    if (type === 'group') {
      const groupName = typeof name === 'string' ? name.trim() : '';
      if (!groupName) return NextResponse.json({ success: false, error: '그룹 이름이 필요합니다.' }, { status: 400 });
      if (groupName.length > MAX_GROUP_NAME_LENGTH) {
        return NextResponse.json({ success: false, error: `그룹 이름은 ${MAX_GROUP_NAME_LENGTH}자 이내로 입력해 주세요.` }, { status: 400 });
      }
      const members = await resolveChannelMemberIds(admin, authUserId, memberIds);
      if (!members.ok) return NextResponse.json({ success: false, error: members.error }, { status: 400 });

      const { data: channel, error: chErr } = await admin.from('channels').insert({ name: groupName, type: 'group' }).select().single();
      if (chErr || !channel) return NextResponse.json({ success: false, error: '채널 생성 실패' }, { status: 500 });

      const allMembers = [authUserId, ...members.ids].map((uid) => ({ channel_id: channel.id, user_id: uid }));
      const { error: memErr } = await admin.from('channel_members').insert(allMembers);
      if (memErr) {
        console.error('[channels/POST] group members insert:', memErr.message);
        await rollbackChannel(admin, channel.id);
        return NextResponse.json({ success: false, error: '채널 생성 실패' }, { status: 500 });
      }

      return NextResponse.json({ success: true, data: channel }, { status: 201 });
    }

    return NextResponse.json({ success: false, error: '유효하지 않은 채널 타입입니다.' }, { status: 400 });
  } catch {
    return NextResponse.json({ success: false, error: '채널 생성 중 오류' }, { status: 500 });
  }
}

/**
 * DELETE /api/messages/channels — DM 채널 삭제
 * query: ?id=xxx
 */
export async function DELETE(request: NextRequest) {
  // 변이 요청: 출처 + CSRF 토큰 + 활성 사용자 확인 (기존 권한 확인은 아래 그대로)
  const mutation = await withMutation(request);
  if (mutation.error) return mutation.error;
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: '채널 ID 필수' }, { status: 400 });

    const admin = createAdminSupabaseClient();

    // 가입한 DM·그룹 채널만 삭제 — 부서 채널은 부서 API(departments DELETE)에서만 정리한다
    if (!(await isChannelMember(admin, id, authUserId))) return notChannelMember();
    const { data: channel } = await admin.from('channels').select('type').eq('id', id).maybeSingle();
    if (!channel) return NextResponse.json({ success: false, error: '채널을 찾을 수 없습니다.' }, { status: 404 });
    // 허용 목록: DM 은 참여자, 그룹은 관리자만(다른 멤버의 대화까지 지워진다). 부서·그 밖의 종류는 삭제 불가
    if (channel.type === 'group') {
      const { data: me } = await admin.from('users').select('role').eq('id', authUserId).maybeSingle();
      if (me?.role !== 'admin') {
        return NextResponse.json({ success: false, error: '그룹 대화방은 관리자만 삭제할 수 있습니다.' }, { status: 403 });
      }
    } else if (channel.type !== 'direct') {
      return NextResponse.json({ success: false, error: channel.type === 'department' ? '부서 채널은 삭제할 수 없습니다.' : '삭제할 수 없는 대화방입니다.' }, { status: 403 });
    }

    // 메시지 삭제 → 멤버십 삭제 → 채널 삭제
    try { await admin.from('messages').delete().eq('channel_id', id); } catch (e) { console.warn('[cleanup]', e); }
    try { await admin.from('channel_members').delete().eq('channel_id', id); } catch (e) { console.warn('[cleanup]', e); }
    const { error } = await admin.from('channels').delete().eq('id', id);

    if (error) return NextResponse.json({ success: false, error: '채널 삭제 실패' }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: '채널 삭제 중 오류' }, { status: 500 });
  }
}
