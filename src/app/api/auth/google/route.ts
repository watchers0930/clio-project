import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import { getAuthUrl } from '@/lib/google/oauth';
import { OAUTH_STATE_COOKIE, createOAuthState } from '@/lib/google/oauth-state';

// GET /api/auth/google — 로그인 확인 후 state 를 쿠키에 저장하고 Google OAuth URL로 리다이렉트
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const userId = supabase ? await getAuthUserId(supabase) : null;

    if (!userId) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const state = createOAuthState();
    const response = NextResponse.redirect(getAuthUrl(state));

    // 콜백에서 같은 브라우저인지 확인할 state (5분). 사용자 식별은 콜백에서 로그인 세션으로 한다
    response.cookies.set(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 300,
      path: '/',
    });

    return response;
  } catch (err) {
    console.error('[auth/google]', err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
