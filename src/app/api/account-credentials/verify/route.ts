import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';

// POST — 현재 로그인 비밀번호로 계정관리 진입 검증
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: '서버 오류' }, { status: 500 });

  const userId = await getAuthUserId(supabase);
  if (!userId) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const { password } = await request.json() as { password?: string };
  if (!password) return NextResponse.json({ valid: false }, { status: 400 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ valid: false }, { status: 400 });

  // 현재 이메일 + 입력 비밀번호로 Supabase Auth 재인증
  const { error } = await supabase.auth.signInWithPassword({
    email: user.email,
    password,
  });

  return NextResponse.json({ valid: !error });
}
