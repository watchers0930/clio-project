import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, LoginResponse } from '@/lib/supabase/types';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, department_id } = await request.json();

    if (!email || !password || !name) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '이메일, 비밀번호, 이름은 필수입니다.' },
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
    const cookiesToSet: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookies) {
          cookies.forEach(({ name, value, options }) => {
            cookiesToSet.push({ name, value, options: options as Record<string, unknown> });
            try { cookieStore.set(name, value, options); } catch (e) { console.warn('[signup]', e); }
          });
        },
      },
    });

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, department_id: department_id ?? null, role: 'user' },
      },
    });

    if (authError || !authData.user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: authError?.message ?? '회원가입에 실패했습니다.' },
        { status: 400 },
      );
    }

    // users 테이블에 프로필 INSERT
    const { error: insertError } = await supabase.from('users').insert({
      id: authData.user.id,
      email,
      name,
      position: '',
      department_id: department_id ?? null,
      role: 'user',
      avatar_url: null,
    });

    if (insertError) {
      console.error('[signup] users insert error:', insertError.message);
    }

    const user = {
      id: authData.user.id,
      email,
      name,
      position: '',
      department_id: department_id ?? null,
      role: 'user' as const,
      avatar_url: null,
      created_at: authData.user.created_at,
    };

    const response = NextResponse.json<ApiResponse<LoginResponse>>({
      success: true,
      data: {
        token: authData.session?.access_token ?? '',
        user,
      },
    });

    for (const cookie of cookiesToSet) {
      response.cookies.set(cookie.name, cookie.value, cookie.options);
    }

    return response;
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: '회원가입 처리 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
