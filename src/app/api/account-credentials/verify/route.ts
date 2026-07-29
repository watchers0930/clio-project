import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import bcrypt from 'bcryptjs';

// POST — 계정관리 진입 비밀번호 검증
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: '서버 오류' }, { status: 500 });

  const userId = await getAuthUserId(supabase);
  if (!userId) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const { password } = await request.json() as { password?: string };
  if (!password) return NextResponse.json({ valid: false }, { status: 400 });

  const admin = createAdminSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .from('users')
    .select('account_lock_hash')
    .eq('id', userId)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hash = (data as any)?.account_lock_hash as string | null | undefined;
  if (!hash) return NextResponse.json({ valid: false, notSet: true });

  const valid = await bcrypt.compare(password, hash);
  return NextResponse.json({ valid });
}
