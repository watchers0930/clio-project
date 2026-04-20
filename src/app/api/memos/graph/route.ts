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
  content: string | null;
  color: string;
}

interface EmbRow {
  memo_id: string;
  embedding: string | number[];
}

const MAX_EMBEDDED = 100;
const SIMILARITY_THRESHOLD = 0.7;

// 한글/영문 의미 있는 단어 추출 (2자 이상, 조사·불용어 제외)
const STOP_WORDS = new Set(['이다', '이고', '있다', '없다', '하다', '되다', '그리고', '하지만', '또는', '및', 'the', 'a', 'an', 'is', 'are', 'to', 'of', 'in', 'for', 'on', 'with']);

function extractKeywords(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .split(/[\s,.?!()[\]{}<>/\\|@#$%^&*+=~`'";\n\t]+/)
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
  return new Set(words);
}

function hasKeywordOverlap(a: MemoRow, b: MemoRow): boolean {
  const aWords = extractKeywords((a.title ?? '') + ' ' + (a.content ?? ''));
  const bWords = extractKeywords((b.title ?? '') + ' ' + (b.content ?? ''));
  for (const w of aWords) {
    if (bWords.has(w)) return true;
  }
  return false;
}

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
      .select('id, title, content, color')
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

    const memoMap = new Map(allMemos.map((m) => [m.id, m]));
    const linkedPairs = new Set<string>();
    const links: { source: string; target: string; similarity: number; type: 'semantic' | 'keyword' }[] = [];

    // 1) 임베딩 유사도 기반 연결
    for (let i = 0; i < parsedEmbeddings.length; i++) {
      for (let j = i + 1; j < parsedEmbeddings.length; j++) {
        const sim = cosineSimilarity(
          parsedEmbeddings[i].embedding,
          parsedEmbeddings[j].embedding,
        );
        if (sim >= SIMILARITY_THRESHOLD) {
          const key = [parsedEmbeddings[i].memo_id, parsedEmbeddings[j].memo_id].sort().join(':');
          linkedPairs.add(key);
          links.push({
            source: parsedEmbeddings[i].memo_id,
            target: parsedEmbeddings[j].memo_id,
            similarity: Math.round(sim * 1000) / 1000,
            type: 'semantic',
          });
        }
      }
    }

    // 2) 제목+내용 공통 키워드 기반 연결 (중복 제외)
    for (let i = 0; i < allMemos.length; i++) {
      for (let j = i + 1; j < allMemos.length; j++) {
        const key = [allMemos[i].id, allMemos[j].id].sort().join(':');
        if (linkedPairs.has(key)) continue;
        const memoA = memoMap.get(allMemos[i].id);
        const memoB = memoMap.get(allMemos[j].id);
        if (memoA && memoB && hasKeywordOverlap(memoA, memoB)) {
          linkedPairs.add(key);
          links.push({
            source: allMemos[i].id,
            target: allMemos[j].id,
            similarity: 0.5,
            type: 'keyword',
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
