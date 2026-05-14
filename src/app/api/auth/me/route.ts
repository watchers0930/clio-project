import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, User } from '@/lib/supabase/types';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    if (!supabase) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '데이터베이스가 설정되지 않았습니다.' },
        { status: 503 },
      );
    }

    const authHeader = request.headers.get('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : null;

    const {
      data: { user: authUser },
      error: authError,
    } = bearerToken
      ? await supabase.auth.getUser(bearerToken)
      : await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '인증 토큰이 필요합니다.' },
        { status: 401 },
      );
    }

    // users 테이블에서 프로필 조회
    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single();

    const user: User = profile
      ? {
          id: profile.id,
          email: profile.email,
          name: profile.name,
          position: profile.position ?? '',
          department_id: profile.department_id,
          role: profile.role as User['role'],
          avatar_url: profile.avatar_url,
          created_at: profile.created_at,
        }
      : {
          id: authUser.id,
          email: authUser.email!,
          name: authUser.user_metadata?.name ?? authUser.email!.split('@')[0],
          position: '',
          department_id: null,
          role: 'user',
          avatar_url: null,
          created_at: authUser.created_at,
        };

    return NextResponse.json<ApiResponse<User>>({ success: true, data: user });
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: '사용자 정보 조회 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
