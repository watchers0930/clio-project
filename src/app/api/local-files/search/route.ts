import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import { generateEmbedding } from '@/lib/ai/embeddings';

const MATCH_THRESHOLD = 0.3;
const MATCH_COUNT = 5;

interface LocalChunkRow {
  id: string;
  local_file_id: string;
  content: string;
  similarity: number;
  file_name: string;
  file_path: string;
  file_type: string;
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'DB 미설정' }, { status: 503 });
  const userId = await getAuthUserId(supabase);
  if (!userId) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const { query } = await req.json() as { query: string };
  if (!query?.trim()) return NextResponse.json({ results: [] });

  const embedding = await generateEmbedding(query);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('match_local_file_chunks', {
    query_embedding: embedding,
    match_threshold: MATCH_THRESHOLD,
    match_count: MATCH_COUNT,
    p_user_id: userId,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const seen = new Set<string>();
  const results = ((data ?? []) as LocalChunkRow[])
    .filter((row) => {
      if (seen.has(row.local_file_id)) return false;
      seen.add(row.local_file_id);
      return true;
    })
    .map((row) => ({
      id: row.local_file_id,
      name: row.file_name,
      path: row.file_path,
      fileType: row.file_type,
      excerpt: row.content.slice(0, 200),
      relevance: Math.round(row.similarity * 100),
      source: 'local' as const,
    }));

  return NextResponse.json({ results });
}
