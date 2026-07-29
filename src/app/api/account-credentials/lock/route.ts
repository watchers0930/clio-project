import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import bcrypt from 'bcryptjs';

// GET — 비밀번호 설정 여부 조회
export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: '서버 오류' }, { status: 500 });

  const userId = await getAuthUserId(supabase);
  if (!userId) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const admin = createAdminSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .from('users')
    .select('account_lock_hash')
    .eq('id', userId)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return NextResponse.json({ enabled: !!(data as any)?.account_lock_hash });
}

// POST — 비밀번호 설정
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: '서버 오류' }, { status: 500 });

  const userId = await getAuthUserId(supabase);
  if (!userId) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const { password } = await request.json() as { password?: string };
  if (!password || password.length < 4) {
    return NextResponse.json({ error: '비밀번호는 4자 이상이어야 합니다.' }, { status: 400 });
  }

  const hash = await bcrypt.hash(password, 10);
  const admin = createAdminSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any)
    .from('users')
    .update({ account_lock_hash: hash })
    .eq('id', userId);

  return NextResponse.json({ success: true });
}
