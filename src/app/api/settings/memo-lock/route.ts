import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import bcrypt from 'bcryptjs';

// GET — 잠금 설정 여부 조회
export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: '서버 오류' }, { status: 500 });

  const userId = await getAuthUserId(supabase);
  if (!userId) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from('users')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .select('memo_lock_hash' as any)
    .eq('id', userId)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return NextResponse.json({ enabled: !!(data as any)?.memo_lock_hash });
}

// POST — 비밀번호 설정(변경) / null 전달 시 해제
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: '서버 오류' }, { status: 500 });

  const userId = await getAuthUserId(supabase);
  if (!userId) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const body = await request.json();
  const { password } = body as { password: string | null };

  const admin = createAdminSupabaseClient();

  if (!password) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await admin.from('users').update({ memo_lock_hash: null } as any).eq('id', userId);
    return NextResponse.json({ success: true, enabled: false });
  }

  if (typeof password !== 'string' || password.length < 4) {
    return NextResponse.json({ error: '비밀번호는 4자 이상이어야 합니다.' }, { status: 400 });
  }

  const hash = await bcrypt.hash(password, 10);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await admin.from('users').update({ memo_lock_hash: hash } as any).eq('id', userId);

  return NextResponse.json({ success: true, enabled: true });
}
