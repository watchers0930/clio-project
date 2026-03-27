import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, LoginResponse } from '@/lib/supabase/types';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '이메일과 비밀번호를 입력해주세요.' },
        { status: 400 },
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '데이터베이스가 설정되지 않았습니다.' },
        { status: 503 },
      );
    }

    const cookieStore = await cookies();

    // 쿠키 설정을 추적하여 응답에 포함
    const cookiesToSet: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookies) {
          cookies.forEach(({ name, value, options }) => {
            cookiesToSet.push({ name, value, options: options as Record<string, unknown> });
            try { cookieStore.set(name, value, options); } catch {}
          });
        },
      },
    });

    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({ email, password });

    if (authError || !authData.user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: authError?.message ?? '로그인에 실패했습니다.' },
        { status: 401 },
      );
    }

    // users 테이블에서 프로필 조회
    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    const user = profile ?? {
      id: authData.user.id,
      email: authData.user.email!,
      name: authData.user.user_metadata?.name ?? email.split('@')[0],
      department_id: authData.user.user_metadata?.department_id ?? null,
      role: authData.user.user_metadata?.role ?? 'user',
      avatar_url: null,
      created_at: authData.user.created_at,
    };

    // 응답 생성 후 쿠키 설정
    const response = NextResponse.json<ApiResponse<LoginResponse>>({
      success: true,
      data: {
        token: authData.session?.access_token ?? '',
        user,
      },
    });

    // Supabase가 설정하려는 쿠키를 응답에 명시적으로 포함
    for (const cookie of cookiesToSet) {
      response.cookies.set(cookie.name, cookie.value, cookie.options);
    }

    return response;
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: '로그인 처리 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
