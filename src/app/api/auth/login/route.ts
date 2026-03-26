import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, LoginResponse } from '@/lib/supabase/types';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { users } from '@/lib/mock-data';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '이메일과 비밀번호를 입력해주세요.' },
        { status: 400 },
      );
    }

    // -----------------------------------------------------------------------
    // Supabase Auth
    // -----------------------------------------------------------------------
    const supabase = await createServerSupabaseClient();

    if (supabase) {
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({ email, password });

      if (authError || !authData.user) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: authError?.message ?? '로그인에 실패했습니다.' },
          { status: 401 },
        );
      }

      // Fetch profile from users table (with department name)
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      const user = profile ?? {
        id: authData.user.id,
        email: authData.user.email!,
        name: authData.user.user_metadata?.name ?? email.split('@')[0],
        department: authData.user.user_metadata?.department ?? '',
        role: authData.user.user_metadata?.role ?? 'user',
        avatar_url: null,
        created_at: authData.user.created_at,
      };

      return NextResponse.json<ApiResponse<LoginResponse>>({
        success: true,
        data: {
          token: authData.session?.access_token ?? '',
          user,
        },
      });
    }

    // -----------------------------------------------------------------------
    // Mock fallback (Supabase 미설정)
    // -----------------------------------------------------------------------
    const user = users.find((u) => u.email === email);

    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '등록되지 않은 이메일입니다.' },
        { status: 401 },
      );
    }

    const mockToken = Buffer.from(
      JSON.stringify({ sub: user.id, email: user.email, role: user.role, iat: Date.now() }),
    ).toString('base64url');

    return NextResponse.json<ApiResponse<LoginResponse>>({
      success: true,
      data: { token: `mock.${mockToken}.sig`, user },
    });
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: '로그인 처리 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
