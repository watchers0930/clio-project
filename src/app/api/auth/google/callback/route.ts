import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import { OAUTH_STATE_COOKIE, oauthStateMatches } from '@/lib/google/oauth-state';
import { createOAuthClient } from '@/lib/google/oauth';
import { google } from 'googleapis';

// GET /api/auth/google/callback — Google OAuth 콜백, 토큰 저장 후 설정 페이지로 이동
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'https://clioai.vercel.app';

  if (error || !code) {
    return NextResponse.redirect(`${origin}/settings?tab=gmail&error=cancelled`);
  }

  // 같은 브라우저에서 시작한 연동인지(state) 확인 — 다른 사람이 시작한 연동을 이 계정에 붙이지 않는다
  if (!oauthStateMatches(request.cookies.get(OAUTH_STATE_COOKIE)?.value, searchParams.get('state'))) {
    return NextResponse.redirect(`${origin}/settings?tab=gmail&error=session_expired`);
  }

  // 연결 대상은 쿠키 값이 아니라 지금 로그인한 사용자(위조 불가)
  const supabase = await createServerSupabaseClient();
  const userId = supabase ? await getAuthUserId(supabase) : null;
  if (!userId) {
    return NextResponse.redirect(`${origin}/settings?tab=gmail&error=session_expired`);
  }

  try {
    const oauth2Client = createOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      return NextResponse.redirect(`${origin}/settings?tab=gmail&error=no_token`);
    }

    // Gmail 권한 동의 여부 확인 (부분 동의 방지)
    // gmail.modify는 읽기·휴지통이동을 모두 포함. 하위 호환으로 readonly도 허용(읽기·검색만 가능, 삭제는 불가).
    const grantedScope = tokens.scope ?? '';
    if (!grantedScope.includes('gmail.modify') && !grantedScope.includes('gmail.readonly')) {
      return NextResponse.redirect(`${origin}/settings?tab=gmail&error=scope`);
    }

    // 사용자 이메일 조회
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();
    const email = userInfo.email ?? '';

    const admin = createAdminSupabaseClient();

    await admin.from('user_google_connections').upsert({
      user_id: userId,
      email,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      scope: grantedScope, // 재동의 여부(삭제 권한 보유) 판별에 사용
      sync_enabled: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    // 임시 쿠키 삭제 후 성공 리다이렉트
    const response = NextResponse.redirect(`${origin}/settings?tab=gmail&success=connected`);
    response.cookies.delete(OAUTH_STATE_COOKIE);
    return response;
  } catch (err) {
    console.error('[google/callback]', err);
    const msg = err instanceof Error ? err.message.slice(0, 100) : String(err).slice(0, 100);
    return NextResponse.redirect(`${origin}/settings?tab=gmail&error=server&msg=${encodeURIComponent(msg)}`);
  }
}
