import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'DB 미설정' }, { status: 503 });
  const userId = await getAuthUserId(supabase);
  if (!userId) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const { id } = await params;

  // 소유자 확인
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: fileRow, error: fileErr } = await (supabase as any)
    .from('local_file_index')
    .select('id, file_name')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (fileErr || !fileRow) return NextResponse.json({ error: '파일 없음' }, { status: 404 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: chunks, error: chunkErr } = await (supabase as any)
    .from('local_file_chunks')
    .select('chunk_index, content')
    .eq('local_file_id', id)
    .order('chunk_index', { ascending: true });

  if (chunkErr) return NextResponse.json({ error: chunkErr.message }, { status: 500 });

  const text = (chunks ?? []).map((c: { content: string }) => c.content).join('\n\n');
  return NextResponse.json({ name: fileRow.file_name, text });
}
