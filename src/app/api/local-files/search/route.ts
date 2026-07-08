import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import { generateEmbedding } from '@/lib/ai/embeddings';

const MATCH_THRESHOLD = 0.15;
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

interface FileIndexRow {
  id: string;
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

  // 파일명 검색 + 청크 내용 키워드 검색 + 벡터 검색 병행
  const [embeddingResult, nameSearchResult, contentSearchResult] = await Promise.allSettled([
    generateEmbedding(query),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('local_file_index')
      .select('id, file_name, file_path, file_type')
      .eq('user_id', userId)
      .ilike('file_name', `%${query}%`)
      .limit(MATCH_COUNT),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('local_file_chunks')
      .select('local_file_id, content, local_file_index!inner(file_name, file_path, file_type, user_id)')
      .eq('local_file_index.user_id', userId)
      .ilike('content', `%${query}%`)
      .limit(MATCH_COUNT),
  ]);

  const seen = new Set<string>();
  const results: ReturnType<typeof makeResult>[] = [];

  // 1. 파일명 매칭 결과 먼저 (정확도 높음)
  if (nameSearchResult.status === 'fulfilled') {
    const nameRows = (nameSearchResult.value.data ?? []) as FileIndexRow[];
    for (const row of nameRows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      results.push(makeResult(row.id, row.file_name, row.file_path, row.file_type, `파일: ${row.file_name}`, 95));
    }
  }

  // 2. 청크 내용 키워드 검색 (파일명 미매칭 시 보완)
  if (contentSearchResult.status === 'fulfilled') {
    const chunkRows = (contentSearchResult.value.data ?? []) as Array<{
      local_file_id: string;
      content: string;
      local_file_index: { file_name: string; file_path: string; file_type: string };
    }>;
    for (const row of chunkRows) {
      if (seen.has(row.local_file_id)) continue;
      seen.add(row.local_file_id);
      const idx = row.local_file_index;
      results.push(makeResult(row.local_file_id, idx.file_name, idx.file_path, idx.file_type, row.content.slice(0, 200), 80));
    }
  }

  // 3. 벡터 검색 결과 추가 (중복 제외)
  if (embeddingResult.status === 'fulfilled') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc('match_local_file_chunks', {
      query_embedding: embeddingResult.value,
      match_threshold: MATCH_THRESHOLD,
      match_count: MATCH_COUNT,
      p_user_id: userId,
    });

    if (!error) {
      for (const row of ((data ?? []) as LocalChunkRow[])) {
        if (seen.has(row.local_file_id)) continue;
        seen.add(row.local_file_id);
        results.push(makeResult(row.local_file_id, row.file_name, row.file_path, row.file_type, row.content.slice(0, 200), Math.round(row.similarity * 100)));
      }
    }
  }

  return NextResponse.json({ results });
}

function makeResult(id: string, name: string, path: string, fileType: string, excerpt: string, relevance: number) {
  return { id, name, path, fileType, excerpt, relevance, source: 'local' as const };
}
