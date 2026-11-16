import { withMutation } from '@/lib/http/mutation-guard';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import bcrypt from 'bcryptjs';

// POST — 비밀번호 검증
export async function POST(request: NextRequest) {
  // 변이 요청: 출처 + CSRF 토큰 + 활성 사용자 확인 (기존 권한 확인은 아래 그대로)
  const mutation = await withMutation(request);
  if (mutation.error) return mutation.error;
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: '서버 오류' }, { status: 500 });

  const userId = await getAuthUserId(supabase);
  if (!userId) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const body = await request.json();
  const { password } = body as { password: string };

  if (!password) return NextResponse.json({ valid: false }, { status: 400 });

  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from('users')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .select('memo_lock_hash' as any)
    .eq('id', userId)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hash = (data as any)?.memo_lock_hash as string | null | undefined;

  if (!hash) {
    return NextResponse.json({ valid: true }); // 잠금 미설정 시 통과
  }

  const valid = await bcrypt.compare(password, hash);
  return NextResponse.json({ valid });
}
