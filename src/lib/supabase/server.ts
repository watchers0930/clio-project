// =============================================================================
// CLIO - 서버용 Supabase 클라이언트
// 서버 컴포넌트, API 라우트, 서버 액션에서 사용
// =============================================================================

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * 서버 측 Supabase 클라이언트 생성
 * 쿠키 기반 세션 관리 포함
 * 환경변수 미설정 시 null 반환 (mock 데이터 모드로 폴백)
 */
export async function createServerSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // 서버 컴포넌트에서 setAll 호출 시 실패 가능 — 무시해도 안전
        }
      },
    },
  });
}

/** Supabase 환경변수 설정 여부 확인 */
export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}
