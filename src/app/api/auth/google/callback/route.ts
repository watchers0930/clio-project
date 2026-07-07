import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
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

  // 임시 쿠키에서 userId 가져오기
  const userId = request.cookies.get('google_oauth_uid')?.value;
  if (!userId) {
    return NextResponse.redirect(`${origin}/settings?tab=gmail&error=session_expired`);
  }

  try {
    const oauth2Client = createOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      return NextResponse.redirect(`${origin}/settings?tab=gmail&error=no_token`);
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
      sync_enabled: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    // 임시 쿠키 삭제 후 성공 리다이렉트
    const response = NextResponse.redirect(`${origin}/settings?tab=gmail&success=connected`);
    response.cookies.delete('google_oauth_uid');
    return response;
  } catch (err) {
    console.error('[google/callback]', err);
    const msg = err instanceof Error ? err.message.slice(0, 100) : String(err).slice(0, 100);
    return NextResponse.redirect(`${origin}/settings?tab=gmail&error=server&msg=${encodeURIComponent(msg)}`);
  }
}
