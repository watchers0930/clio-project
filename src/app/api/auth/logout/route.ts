import { NextResponse, type NextRequest } from 'next/server';
import type { ApiResponse } from '@/lib/supabase/types';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { withSameOrigin } from '@/lib/http/mutation-guard';

export async function POST(request: NextRequest) {
  // 출처만 확인: 다른 사이트의 강제 로그아웃은 막고, 토큰이 만료된 상태에서도 로그아웃은 되게 한다
  const origin = await withSameOrigin(request);
  if (origin.error) return origin.error;
  try {
    const supabase = await createServerSupabaseClient();

    if (!supabase) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '데이터베이스가 설정되지 않았습니다.' },
        { status: 503 },
      );
    }

    const { error } = await supabase.auth.signOut();

    if (error) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json<ApiResponse>({ success: true });
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: '로그아웃 처리 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
