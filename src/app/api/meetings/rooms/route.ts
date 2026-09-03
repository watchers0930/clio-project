import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import { ensureRoom, createMeetingToken } from '@/lib/daily/rooms';

/**
 * 화상회의 방 생성/입장 API
 * POST /api/meetings/rooms
 * body: { eventId?: string }  — 있으면 해당 일정에 방 연결, 없으면 즉석 방
 * 반환: { success, data: { roomUrl, token } }
 */
export async function POST(request: NextRequest) {
  try {
    if (!process.env.DAILY_API_KEY) {
      return NextResponse.json(
        { success: false, error: '화상회의가 설정되지 않았습니다' },
        { status: 503 },
      );
    }

    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

    // 입력 검증: eventId는 선택, 있으면 UUID 형식이어야 함
    const body = (await request.json().catch(() => ({}))) as { eventId?: unknown };
    const eventId = typeof body.eventId === 'string' ? body.eventId.trim() : undefined;
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (eventId && !UUID_RE.test(eventId)) {
      return NextResponse.json({ success: false, error: '잘못된 일정 ID' }, { status: 400 });
    }

    const admin = createAdminSupabaseClient();

    // 표시 이름 조회
    const { data: me } = await admin.from('users').select('name').eq('id', authUserId).single();
    const userName = me?.name || '참가자';

    let roomName: string;
    let roomUrl: string;

    if (eventId) {
      // 일정 연결 방: 존재 확인. 방 이름은 eventId로 결정론적 생성 →
      // ensureRoom 이 멱등(있으면 재사용)이라 DB에 URL을 저장할 필요가 없다.
      const { data: event, error } = await admin
        .from('events')
        .select('id')
        .eq('id', eventId)
        .single();

      if (error || !event) {
        return NextResponse.json({ success: false, error: '일정을 찾을 수 없습니다' }, { status: 404 });
      }

      const room = await ensureRoom(`clio-${eventId}`);
      roomName = room.name;
      roomUrl = room.url;
    } else {
      // 즉석 방: 저장하지 않음.
      const room = await ensureRoom(`clio-adhoc-${randomUUID()}`, 4 * 60 * 60);
      roomName = room.name;
      roomUrl = room.url;
    }

    // 로그인한 CLIO 멤버는 모두 owner → 게스트 노킹 입장을 승인할 수 있음
    const token = await createMeetingToken(roomName, userName, true);

    return NextResponse.json(
      { success: true, data: { roomUrl, token } },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch (err) {
    // ⚠️ Daily API 키가 포함될 수 있는 원본은 로깅하지 않고 메시지만 기록
    console.error('[meetings/rooms/POST]', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ success: false, error: '화상회의 방 생성 실패' }, { status: 500 });
  }
}
