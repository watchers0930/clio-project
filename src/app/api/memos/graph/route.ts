import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import type { MemoGraphData, GraphNode, GraphLink } from '@/types/memo-graph';

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

interface EmbeddingRow {
  memo_id: string;
  embedding: string | number[];
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, ma = 0, mb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    ma += a[i] * a[i];
    mb += b[i] * b[i];
  }
  const denom = Math.sqrt(ma) * Math.sqrt(mb);
  return denom === 0 ? 0 : dot / denom;
}

function extractWords(text: string): string[] {
  const words = new Set<string>();
  const korean = text.match(/[가-힣]{2,}/g) ?? [];
  const english = text.match(/[a-zA-Z]{3,}/g) ?? [];
  korean.forEach((w) => {
    words.add(w);
    // 2글자 슬라이딩 — "메모기능을" → "메모","기능" 등 복합어 분해
    for (let i = 0; i + 2 <= w.length; i++) words.add(w.slice(i, i + 2));
  });
  english.forEach((w) => words.add(w.toLowerCase()));
  return Array.from(words);
}

/** 제목 간 공통 단어 수 (정확한 단어 단위) */
function titleOverlapScore(titleA: string, titleB: string): number {
  const wordsA = extractWords(titleA);
  if (wordsA.length === 0) return 0;
  const wordsB = new Set(extractWords(titleB));
  const matches = wordsA.filter((w) => wordsB.has(w)).length;
  return matches / Math.max(wordsA.length, wordsB.size);
}

/** A 제목 단어가 B 내용에 포함되는지 (정확한 단어 단위) */
function titleInContentScore(titleA: string, contentB: string | null): number {
  const wordsA = extractWords(titleA);
  if (wordsA.length === 0 || !contentB) return 0;
  const contentWords = new Set(extractWords(contentB));
  const matches = wordsA.filter((w) => contentWords.has(w)).length;
  return matches / wordsA.length;
}

const TITLE_THRESHOLD = 0.15;
const CONTENT_THRESHOLD = 0.2;
const SEMANTIC_THRESHOLD = 0.78;

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

    // 사용자 메모 전체 조회
    const { data: memosRaw, error: memosError } = await admin
      .from('memos')
      .select('id, title, content, color')
      .eq('created_by', authUserId);

    if (memosError) {
      return NextResponse.json({ success: false, error: '메모 조회 실패' }, { status: 500 });
    }

    const memos = (memosRaw ?? []) as MemoRow[];
    if (memos.length === 0) {
      return NextResponse.json({ success: true, data: { nodes: [], links: [] } });
    }

    // 임베딩 조회
    const memoIds = memos.map((m) => m.id);
    const { data: embeddingsRaw } = await rawFrom(admin, 'memo_embeddings')
      .select('memo_id, embedding')
      .in('memo_id', memoIds);

    const embeddingMap = new Map<string, number[]>();
    for (const row of (embeddingsRaw ?? []) as EmbeddingRow[]) {
      const vec = typeof row.embedding === 'string'
        ? (JSON.parse(row.embedding) as number[])
        : row.embedding;
      embeddingMap.set(row.memo_id, vec);
    }

    // 노드 생성
    const nodes: GraphNode[] = memos.map((m) => ({
      id: m.id,
      title: m.title,
      content: m.content,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      color: m.color as any,
      hasEmbedding: embeddingMap.has(m.id),
    }));

    // 링크 생성: 모든 쌍 비교
    const links: GraphLink[] = [];
    for (let i = 0; i < memos.length; i++) {
      for (let j = i + 1; j < memos.length; j++) {
        const a = memos[i];
        const b = memos[j];

        // 1순위: 제목 간 동일 단어 → 실선 (title)
        const titleScore = Math.max(
          titleOverlapScore(a.title, b.title),
          titleOverlapScore(b.title, a.title),
        );
        if (titleScore >= TITLE_THRESHOLD) {
          links.push({ source: a.id, target: b.id, similarity: titleScore, type: 'title' });
          continue;
        }

        // 2순위: 제목 단어가 상대 내용에 포함 → 점선 (content)
        const contentScore = Math.max(
          titleInContentScore(a.title, b.content),
          titleInContentScore(b.title, a.content),
        );
        if (contentScore >= CONTENT_THRESHOLD) {
          links.push({ source: a.id, target: b.id, similarity: contentScore, type: 'content' });
          continue;
        }

        // 3순위: 임베딩 의미 유사도 → 점선 (semantic)
        const vecA = embeddingMap.get(a.id);
        const vecB = embeddingMap.get(b.id);
        if (vecA && vecB) {
          const sim = cosineSimilarity(vecA, vecB);
          if (sim >= SEMANTIC_THRESHOLD) {
            links.push({ source: a.id, target: b.id, similarity: sim, type: 'semantic' });
          }
        }
      }
    }

    const data: MemoGraphData = { nodes, links };
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('[memos/graph/GET]', err);
    return NextResponse.json({ success: false, error: '서버 오류' }, { status: 500 });
  }
}
