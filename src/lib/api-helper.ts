// =============================================================================
// CLIO API 헬퍼
// API 라우트 공통 패턴 추출 (인증, 에러 응답 등)
// =============================================================================

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import type { ApiResponse } from '@/lib/supabase/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

/** 인증된 Supabase 클라이언트와 userId를 반환, 실패 시 NextResponse 반환 */
export async function withAuth(): Promise<
  | { supabase: SupabaseClient<Database>; userId: string; error: null }
  | { supabase: null; userId: null; error: NextResponse }
> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return {
      supabase: null,
      userId: null,
      error: NextResponse.json<ApiResponse>(
        { success: false, error: '데이터베이스가 설정되지 않았습니다.' },
        { status: 503 },
      ),
    };
  }

  const userId = await getAuthUserId(supabase);
  if (!userId) {
    return {
      supabase: null,
      userId: null,
      error: NextResponse.json<ApiResponse>(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 },
      ),
    };
  }

  return { supabase, userId, error: null };
}

/** 표준 성공 응답 */
export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json<ApiResponse<T>>({ success: true, data }, { status });
}

/** 표준 에러 응답 */
export function fail(message: string, status = 500): NextResponse {
  return NextResponse.json<ApiResponse>({ success: false, error: message }, { status });
}
