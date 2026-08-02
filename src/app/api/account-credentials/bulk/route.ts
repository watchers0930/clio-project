import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import { encryptPassword } from '@/lib/crypto/credentials';

interface BulkItem {
  site_name: string;
  site_url?: string;
  username: string;
  password: string;
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: '서버 오류' }, { status: 500 });

  const userId = await getAuthUserId(supabase);
  if (!userId) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const body = await request.json() as { items?: BulkItem[] };
  const items = body.items;

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: '가져올 항목이 없습니다.' }, { status: 400 });
  }

  const rows = items
    .filter((item) => item.site_name?.trim() && item.username?.trim() && item.password?.trim())
    .map((item) => ({
      user_id: userId,
      site_name: item.site_name.trim(),
      site_url: (item.site_url ?? '').trim(),
      username: item.username.trim(),
      enc_password: encryptPassword(item.password),
    }));

  if (rows.length === 0) {
    return NextResponse.json({ error: '유효한 항목이 없습니다.' }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from('account_credentials')
    .insert(rows);

  if (error) return NextResponse.json({ error: (error as { message: string }).message }, { status: 500 });

  return NextResponse.json({ success: true, data: { count: rows.length } });
}
