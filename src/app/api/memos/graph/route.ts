import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import { cosineSimilarity } from '@/lib/ai/memo-clustering';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rawFrom(admin: ReturnType<typeof createAdminSupabaseClient>, table: string): any {
  return (admin as unknown as Record<string, (t: string) => unknown>).from(table);
}

interface MemoRow {
  id: string;
  title: string;
  color: string;
}

interface EmbRow {
  memo_id: string;
  embedding: string | number[];
}

const MAX_EMBEDDED = 100;
const SIMILARITY_THRESHOLD = 0.7;

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });
    }
    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) {
      return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });
    }

    const admin = createAdminSupabaseClient();

    const { data: memosRaw, error: memosError } = await admin
      .from('memos')
      .select('id, title, color')
      .eq('created_by', authUserId)
      .order('updated_at', { ascending: false });

    if (memosError) {
      console.error('[graph/GET] memos error:', memosError.message);
      return NextResponse.json({ success: false, error: '메모 조회 실패' }, { status: 500 });
    }

    const allMemos = (memosRaw as unknown as MemoRow[]) ?? [];
    if (allMemos.length === 0) {
      return NextResponse.json({ success: true, nodes: [], links: [] });
    }

    const { data: embRaw } = await rawFrom(admin, 'memo_embeddings')
      .select('memo_id, embedding')
      .in('memo_id', allMemos.map((m) => m.id))
      .limit(MAX_EMBEDDED);

    const embRows = (embRaw as EmbRow[] | null) ?? [];
    const embeddedIds = new Set(embRows.map((e) => e.memo_id));

    const nodes = allMemos.map((m) => ({
      id: m.id,
      title: m.title,
      color: m.color,
      hasEmbedding: embeddedIds.has(m.id),
    }));

    const parsedEmbeddings = embRows.map((e) => ({
      memo_id: e.memo_id,
      embedding: typeof e.embedding === 'string'
        ? (JSON.parse(e.embedding) as number[])
        : (e.embedding as number[]),
    }));

    const links: { source: string; target: string; similarity: number }[] = [];

    for (let i = 0; i < parsedEmbeddings.length; i++) {
      for (let j = i + 1; j < parsedEmbeddings.length; j++) {
        const sim = cosineSimilarity(
          parsedEmbeddings[i].embedding,
          parsedEmbeddings[j].embedding,
        );
        if (sim >= SIMILARITY_THRESHOLD) {
          links.push({
            source: parsedEmbeddings[i].memo_id,
            target: parsedEmbeddings[j].memo_id,
            similarity: Math.round(sim * 1000) / 1000,
          });
        }
      }
    }

    return NextResponse.json({ success: true, nodes, links });
  } catch (err) {
    console.error('[graph/GET] error:', err);
    return NextResponse.json({ success: false, error: '서버 오류' }, { status: 500 });
  }
}
