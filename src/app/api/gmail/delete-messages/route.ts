import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import { getGmailClientForUser } from '@/lib/google/gmail-client';
import { trashGmailMessages } from '@/lib/google/gmail-delete';

export const maxDuration = 60;

// 한 요청에서 삭제(휴지통 이동) 가능한 최대 건수. 실수로 인한 대량 삭제를 막는 상한.
const MAX_DELETE_PER_REQUEST = 1000;

// POST /api/gmail/delete-messages — 선택한 메일을 Gmail 휴지통으로 이동 + 로컬 동기화분 정리
// body { messageIds: string[] } — 미리보기(search-messages)에서 사용자가 확인·선택한 id 목록
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ error: '서버 오류' }, { status: 500 });

    const userId = await getAuthUserId(supabase);
    if (!userId) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

    let messageIds: string[] = [];
    try {
      const body = await request.json();
      if (Array.isArray(body?.messageIds)) {
        // 서버 재검증: 문자열만, 중복 제거, 상한 적용 (클라이언트 입력을 신뢰하지 않는다)
        messageIds = Array.from(
          new Set(body.messageIds.filter((v: unknown): v is string => typeof v === 'string' && v.length > 0)),
        );
      }
    } catch { /* body 없음 */ }

    if (messageIds.length === 0) {
      return NextResponse.json({ error: '삭제할 메일을 선택해 주세요.' }, { status: 400 });
    }
    if (messageIds.length > MAX_DELETE_PER_REQUEST) {
      return NextResponse.json(
        { error: `한 번에 최대 ${MAX_DELETE_PER_REQUEST}건까지 삭제할 수 있습니다.` },
        { status: 400 },
      );
    }

    const admin = createAdminSupabaseClient();
    const client = await getGmailClientForUser(admin, userId);
    if (!client) return NextResponse.json({ error: 'Gmail이 연결되어 있지 않습니다.' }, { status: 400 });

    if (!client.scope.includes('gmail.modify')) {
      return NextResponse.json(
        { error: '메일 삭제 권한이 없습니다. 설정에서 Gmail을 다시 연결해 주세요.', code: 'need_reconnect' },
        { status: 403 },
      );
    }

    // 1) Gmail 휴지통으로 이동 (사용자 본인 토큰 → 본인 메일함만 대상, 타인 메일 불가)
    const moved = await trashGmailMessages(client.gmail, messageIds);

    // 2) Gmail 이동 성공 후에만 로컬 동기화분 정리 (file_chunks는 CASCADE)
    //    로컬에 없던 메일도 있으므로 삭제 건수와 무관하게 external_id 매칭분만 정리.
    await admin
      .from('files')
      .delete()
      .eq('uploaded_by', userId)
      .eq('source', 'gmail')
      .in('external_id', messageIds);

    return NextResponse.json({ success: true, trashed: moved });
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    if (raw.includes('invalid_grant')) {
      return NextResponse.json({ error: 'Gmail 연결이 만료되었습니다. 설정에서 다시 연결해 주세요.', code: 'invalid_grant' }, { status: 401 });
    }
    if (raw.includes('insufficient') || raw.includes('Insufficient') || raw.includes('ACCESS_TOKEN_SCOPE')) {
      return NextResponse.json({ error: '메일 삭제 권한이 없습니다. 설정에서 Gmail을 다시 연결해 주세요.', code: 'need_reconnect' }, { status: 403 });
    }
    console.error('[gmail/delete-messages]', raw);
    return NextResponse.json({ error: '메일 삭제에 실패했습니다.' }, { status: 500 });
  }
}
