import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, LoginResponse } from '@/lib/supabase/types';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '이메일과 비밀번호를 입력해주세요.' },
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
      department_id: authData.user.user_metadata?.department_id ?? authData.user.user_metadata?.department ?? null,
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
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: '로그인 처리 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
