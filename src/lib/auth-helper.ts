import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './supabase/types';

/**
 * API 라우트에서 인증된 사용자 ID를 추출하는 헬퍼
 * Supabase Auth의 getUser()를 사용하여 RLS 정책과 호환되는 실제 UUID를 반환
 */
export async function getAuthUserId(
  supabase: SupabaseClient<Database>,
): Promise<string | null> {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) return null;
    return user.id;
  } catch {
    return null;
  }
}
