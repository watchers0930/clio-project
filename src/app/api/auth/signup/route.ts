import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, LoginResponse } from '@/lib/supabase/types';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, department_id } = await request.json();

    if (!email || !password || !name) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '이메일, 비밀번호, 이름은 필수입니다.' },
        { status: 400 },
      );
    }

    const supabase = await createServerSupabaseClient();

    if (!supabase) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '데이터베이스가 설정되지 않았습니다.' },
        { status: 503 },
      );
    }

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
      department_id: department_id ?? null,
      role: 'user' as const,
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
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: '회원가입 처리 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
