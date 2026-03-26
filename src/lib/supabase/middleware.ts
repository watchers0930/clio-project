// =============================================================================
// CLIO - Supabase 미들웨어 헬퍼
// 요청/응답 쿠키를 통한 세션 자동 갱신
// =============================================================================

import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * 미들웨어에서 Supabase 세션을 갱신하는 헬퍼
 * - 만료된 토큰 자동 리프레시
 * - 쿠키를 요청/응답 양쪽에 동기화
 *
 * @returns { supabase, response } 또는 환경변수 미설정 시 null
 */
export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // 환경변수 미설정 시 Supabase 세션 관리 건너뛰기
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // 요청 쿠키에도 반영 (서버 컴포넌트에서 읽을 수 있도록)
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );

        // 응답에도 쿠키 설정
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // getUser()를 호출해 세션 자동 갱신 트리거
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { user, response: supabaseResponse };
}
