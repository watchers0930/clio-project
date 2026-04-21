import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import OpenAI from 'openai';

interface ClusterInput {
  memoIds: string[];
}

interface MemoRow {
  id: string;
  title: string;
  created_by: string;
}

function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY 미설정');
  return new OpenAI({ apiKey });
}

async function nameCluster(openai: OpenAI, titles: string[]): Promise<string | null> {
  try {
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: '메모 제목들을 보고 공통 주제를 10자 이내 한국어 명사구로 답하세요. 오직 명사구만 출력, 설명 금지.',
        },
        { role: 'user', content: titles.join(', ') },
      ],
      max_tokens: 30,
      temperature: 0.3,
    });
    return resp.choices[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });
    }
    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) {
      return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });
    }

    const body = await request.json() as { clusters?: ClusterInput[] };
    const clusters = body.clusters;

    if (!Array.isArray(clusters) || clusters.length === 0) {
      return NextResponse.json({ success: false, error: '클러스터 배열 필요' }, { status: 400 });
    }
    if (clusters.length > 20) {
      return NextResponse.json({ success: false, error: '클러스터 수 초과 (최대 20개)' }, { status: 400 });
    }

    const allIds = clusters.flatMap((c) => c.memoIds);
    const admin = createAdminSupabaseClient();
    const { data: memosRaw, error } = await admin
      .from('memos')
      .select('id, title, created_by')
      .in('id', allIds);

    if (error || !memosRaw) {
      return NextResponse.json({ success: false, error: '메모 조회 실패' }, { status: 500 });
    }

    const memoMap = new Map<string, MemoRow>();
    for (const m of memosRaw as unknown as MemoRow[]) {
      if (m.created_by === authUserId) memoMap.set(m.id, m);
    }

    const openai = getOpenAI();
    const results = await Promise.all(
      clusters.map(async (cluster, index) => {
        const ownedIds = cluster.memoIds.filter((id) => memoMap.has(id));
        if (ownedIds.length < 2) return { index, name: null, memoIds: cluster.memoIds };
        const titles = ownedIds.map((id) => memoMap.get(id)!.title);
        const name = await nameCluster(openai, titles);
        return { index, name, memoIds: cluster.memoIds };
      }),
    );

    return NextResponse.json({ success: true, data: results });
  } catch (err) {
    console.error('[memos/graph/clusters/POST]', err);
    return NextResponse.json({ success: false, error: '서버 오류' }, { status: 500 });
  }
}
