import { NextResponse } from 'next/server';
import type { ApiResponse } from '@/lib/supabase/types';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST() {
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
