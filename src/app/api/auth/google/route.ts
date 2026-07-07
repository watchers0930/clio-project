import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import { getAuthUrl } from '@/lib/google/oauth';

// GET /api/auth/google — 세션에서 userId 읽어 쿠키 저장 후 Google OAuth URL로 리다이렉트
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const userId = supabase ? await getAuthUserId(supabase) : null;

    if (!userId) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const url = getAuthUrl();
    const response = NextResponse.redirect(url);

    // 콜백에서 userId를 읽기 위해 임시 httpOnly 쿠키 저장 (5분)
    response.cookies.set('google_oauth_uid', userId, {
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
