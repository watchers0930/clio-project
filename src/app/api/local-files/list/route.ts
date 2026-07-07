import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';

export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'DB 미설정' }, { status: 503 });
  const userId = await getAuthUserId(supabase);
  if (!userId) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('local_file_index')
    .select('id, file_name, file_path, file_type, file_size, file_hash, chunk_count, last_synced_at')
    .eq('user_id', userId)
    .order('last_synced_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ files: data ?? [] });
}
