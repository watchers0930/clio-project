// =============================================================================
// CLIO - 브라우저용 Supabase 클라이언트
// 클라이언트 컴포넌트에서 사용
// =============================================================================

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './types';

// ⚠️ env 값 끝에 개행/공백이 딸려오면 Realtime WebSocket URL의 apikey에 %0A가 붙어
// 연결이 CHANNEL_ERROR로 실패한다(REST 요청은 헤더라 관대해서 티가 안 남).
// 반드시 trim으로 방어한다.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

/**
 * 브라우저 측 Supabase 클라이언트 생성
 * 환경변수 미설정 시 null 반환 (mock 데이터 모드로 폴백)
 */
export function createClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}

/** Supabase 환경변수 설정 여부 확인 */
export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}
