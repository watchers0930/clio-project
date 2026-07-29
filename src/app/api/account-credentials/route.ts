import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import { encryptPassword, decryptPassword } from '@/lib/crypto/credentials';

type CredRow = { id: string; site_name: string; site_url: string; username: string; enc_password: string; created_at: string };

// GET — 목록 조회
export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: '서버 오류' }, { status: 500 });

  const userId = await getAuthUserId(supabase);
  if (!userId) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('account_credentials')
    .select('id, site_name, site_url, username, enc_password, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: (error as { message: string }).message }, { status: 500 });

  const rows = ((data ?? []) as CredRow[]).map((r) => ({
    id: r.id,
    site_name: r.site_name,
    site_url: r.site_url ?? '',
    username: r.username,
    password: decryptPassword(r.enc_password),
    created_at: r.created_at,
  }));

  return NextResponse.json({ data: rows });
}

// POST — 추가
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: '서버 오류' }, { status: 500 });

  const userId = await getAuthUserId(supabase);
  if (!userId) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const body = await request.json() as { site_name?: string; site_url?: string; username?: string; password?: string };
  const { site_name, site_url, username, password } = body;

  if (!site_name?.trim() || !username?.trim() || !password?.trim()) {
    return NextResponse.json({ error: '사이트명, 아이디, 비밀번호는 필수입니다.' }, { status: 400 });
  }

  const enc_password = encryptPassword(password);

  const admin = createAdminSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from('account_credentials')
    .insert({ user_id: userId, site_name: site_name.trim(), site_url: (site_url ?? '').trim(), username: username.trim(), enc_password })
    .select('id, site_name, site_url, username, created_at')
    .single();

  if (error) return NextResponse.json({ error: (error as { message: string }).message }, { status: 500 });

  const row = data as { id: string; site_name: string; site_url: string; username: string; created_at: string };
  return NextResponse.json({ data: { ...row, password } });
}
