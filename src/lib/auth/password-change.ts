import { createClient } from '@supabase/supabase-js';

// 본인 비밀번호 변경 서버 전용 — 열린 세션(자리 비운 PC 등) 하나만으로 비밀번호를 바꿔 계정을 빼앗지 못하게 현재 비밀번호를 다시 확인한다.
// 입력 규칙은 password-change-rules.ts
/**
 * 현재 비밀번호 확인 — 쿠키를 건드리지 않는 일회용 클라이언트로 로그인해 보고, 확인용으로 생긴 세션은 바로 그 세션만 끝낸다.
 * (요청자의 쿠키 세션으로 로그인하면 세션이 바뀌어 CSRF 토큰이 무효가 된다)
 */
export async function verifyCurrentPassword(email: string, password: string): Promise<'ok' | 'wrong' | 'error'> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) return 'error';
  const probe = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await probe.auth.signInWithPassword({ email, password });
  if (error) return error.code === 'invalid_credentials' ? 'wrong' : 'error';
  if (data.session) {
    const { error: outErr } = await probe.auth.signOut({ scope: 'local' });
    if (outErr) console.error('[password] probe session sign-out:', outErr.message);
  }
  return 'ok';
}
