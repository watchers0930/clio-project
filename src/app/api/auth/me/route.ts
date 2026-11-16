import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, User } from '@/lib/supabase/types';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { NOT_REGISTERED_CODE } from '@/lib/http/auth-codes';

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

    // 프로필은 위에서 검증한 사용자 id 로 서버 권한 조회 — 쿠키 세션과 Bearer 토큰이 달라도 같은 사람을 본다
    const { data: profile, error: profileError } = await createAdminSupabaseClient()
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    // 조회 오류(일시 장애)는 500 — 클라이언트가 로그아웃하지 않는다
    if (profileError) {
      console.error('[auth/me] profile', profileError.message);
      return NextResponse.json<ApiResponse>(
        { success: false, error: '사용자 정보를 불러오지 못했습니다.' },
        { status: 500 },
      );
    }

    // 직원 명부(users)에 정말 없는 계정만 403 + code — 클라이언트는 이때만 세션을 끊는다(user_metadata 폴백 없음)
    if (!profile) {
      return NextResponse.json(
        { success: false, error: '등록되지 않은 계정입니다. 관리자에게 문의해주세요.', code: NOT_REGISTERED_CODE },
        { status: 403 },
      );
    }

    const user: User = {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      position: profile.position ?? '',
      department_id: profile.department_id,
      role: profile.role as User['role'],
      avatar_url: profile.avatar_url,
      signature_path: profile.signature_path ?? null,
      sidebar_menus: (profile.sidebar_menus as string[] | null) ?? [],
      rank_level: (profile as { rank_level?: number | null }).rank_level ?? null,
      rank_title: (profile as { rank_title?: string | null }).rank_title ?? null,
      created_at: profile.created_at,
    };

    return NextResponse.json<ApiResponse<User>>({ success: true, data: user });
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: '사용자 정보 조회 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
