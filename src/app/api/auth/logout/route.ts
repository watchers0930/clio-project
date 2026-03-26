import { NextResponse } from 'next/server';
import type { ApiResponse } from '@/lib/supabase/types';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST() {
  try {
    // -----------------------------------------------------------------
    // Supabase Auth
    // -----------------------------------------------------------------
    const supabase = await createServerSupabaseClient();

    if (supabase) {
      const { error } = await supabase.auth.signOut();

      if (error) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: error.message },
          { status: 500 },
        );
      }

      return NextResponse.json<ApiResponse>({ success: true });
    }

    // -----------------------------------------------------------------
    // Mock fallback — nothing to clear server-side
    // -----------------------------------------------------------------
    return NextResponse.json<ApiResponse>({ success: true });
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: '로그아웃 처리 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
