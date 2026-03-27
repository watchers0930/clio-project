import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

/**
 * Service Role Supabase 클라이언트 (RLS bypass)
 * 백그라운드 파일 처리 등 서버 내부 작업에서만 사용
 */
export function createAdminSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Supabase 환경변수가 설정되지 않았습니다.');
  }

  return createClient<Database>(url, key);
}
