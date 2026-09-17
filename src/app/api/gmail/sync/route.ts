import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import { syncGmailForUser, GmailSyncError } from '@/lib/google/gmail-sync';

export const maxDuration = 60;

// POST /api/gmail/sync — 최근 6개월 받은편지함 증분 동기화 (본문+첨부 내용)
// body { auto?: boolean } — auto=true면 쿨다운 내 재호출 시 즉시 스킵
// body { reindex?: boolean } — 기존 Gmail 파일을 모두 지우고 처음부터 재인덱싱
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ error: '서버 오류' }, { status: 500 });

    const userId = await getAuthUserId(supabase);
    if (!userId) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

    let isAuto = false;
    let isReindex = false;
    try {
      const body = await request.json();
      isAuto = body?.auto === true;
      isReindex = body?.reindex === true;
    } catch { /* body 없음 */ }

    const admin = createAdminSupabaseClient();
    const result = await syncGmailForUser(admin, userId, { auto: isAuto, reindex: isReindex });

    if (result.skipped) {
      return NextResponse.json({ success: true, skipped: true, synced: 0 });
    }
    return NextResponse.json({ success: true, synced: result.synced, errors: result.errors });
  } catch (err) {
    if (err instanceof GmailSyncError && err.code === 'NOT_CONNECTED') {
      return NextResponse.json({ error: 'Gmail이 연결되어 있지 않습니다.' }, { status: 400 });
    }
    const raw = err instanceof Error ? err.message : String(err);
    // refresh token 만료·취소 → 재연결 필요
    if (raw.includes('invalid_grant')) {
      return NextResponse.json({
        error: 'Gmail 연결이 만료되었습니다. 설정에서 "다시 연결"을 눌러 재연결해 주세요.',
        code: 'invalid_grant',
      }, { status: 401 });
    }
    // Gmail 읽기 권한 미동의 → 재연결하며 권한 체크 필요
    if (raw.includes('insufficient authentication scopes') || raw.includes('insufficient_scope') || raw.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT')) {
      return NextResponse.json({
        error: 'Gmail 읽기 권한이 없습니다. "다시 연결" 후 동의 화면에서 Gmail 접근 권한에 반드시 체크해 주세요.',
        code: 'insufficient_scope',
      }, { status: 403 });
    }
    console.error('[gmail/sync] 치명적 오류:', err);
    return NextResponse.json({ error: raw.slice(0, 200) }, { status: 500 });
  }
}
