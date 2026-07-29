import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import { encryptPassword } from '@/lib/crypto/credentials';

// PATCH — 수정
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: '서버 오류' }, { status: 500 });

  const userId = await getAuthUserId(supabase);
  if (!userId) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const body = await request.json() as { site_name?: string; username?: string; password?: string };
  const { site_name, username, password } = body;

  if (!site_name?.trim() || !username?.trim() || !password?.trim()) {
    return NextResponse.json({ error: '사이트명, 아이디, 비밀번호는 필수입니다.' }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from('account_credentials')
    .update({
      site_name: site_name.trim(),
      username: username.trim(),
      enc_password: encryptPassword(password),
    })
    .eq('id', id)
    .eq('user_id', userId);

  if (error) return NextResponse.json({ error: (error as { message: string }).message }, { status: 500 });

  return NextResponse.json({ success: true });
}

// DELETE — 삭제
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: '서버 오류' }, { status: 500 });

  const userId = await getAuthUserId(supabase);
  if (!userId) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const admin = createAdminSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from('account_credentials')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) return NextResponse.json({ error: (error as { message: string }).message }, { status: 500 });

  return NextResponse.json({ success: true });
}
