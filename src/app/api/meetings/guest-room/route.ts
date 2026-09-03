import { NextRequest, NextResponse } from 'next/server';
import { getRoom } from '@/lib/daily/rooms';

/**
 * 게스트(비로그인) 방 조회 API — 공개 엔드포인트
 * POST /api/meetings/guest-room  body: { room: string }
 * - CLIO 방(clio-*)이고 실제 존재할 때만 roomUrl 반환. 방 생성은 하지 않음.
 * - 게스트는 토큰 없이 이 URL로 노킹 입장 → 호스트 승인.
 * 반환: { success, data: { roomUrl } }
 */
export async function POST(request: NextRequest) {
  try {
    if (!process.env.DAILY_API_KEY) {
      return NextResponse.json({ success: false, error: '화상회의 미설정' }, { status: 503 });
    }

    const body = (await request.json().catch(() => ({}))) as { room?: unknown };
    const room = typeof body.room === 'string' ? body.room.trim() : '';

    // 방 이름 형식 검증: clio- 로 시작하는 안전 문자만 (임의 방 조회 차단)
    if (!/^clio-[A-Za-z0-9_-]{1,54}$/.test(room)) {
      return NextResponse.json({ success: false, error: '잘못된 회의 링크' }, { status: 400 });
    }

    const found = await getRoom(room);
    if (!found) {
      return NextResponse.json(
        { success: false, error: '종료되었거나 존재하지 않는 회의입니다' },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { success: true, data: { roomUrl: found.url } },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch (err) {
    console.error('[meetings/guest-room/POST]', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ success: false, error: '회의 조회 실패' }, { status: 500 });
  }
}
