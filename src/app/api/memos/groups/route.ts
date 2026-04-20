/**
 * GET /api/memos/groups
 * 전체 메모 그룹 조회 (클러스터링 캐시 포함)
 * - 유효 캐시 HIT: memo_ids로 memos JOIN 후 반환
 * - 캐시 MISS: 전체 임베딩 로드 → 클러스터링 → GPT-4o-mini 그룹명 → 캐시 저장
 */

import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import { clusterMemos } from '@/lib/ai/memo-clustering';

// memo_embeddings, memo_groups 테이블은 generated types에 없으므로 캐스팅 사용
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rawFrom(admin: ReturnType<typeof createAdminSupabaseClient>, table: string): any {
  return (admin as unknown as Record<string, (t: string) => unknown>).from(table);
}

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (_openai) return _openai;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.');
  _openai = new OpenAI({ apiKey });
  return _openai;
}

interface MemoRow {
  id: string;
  title: string;
  content: string | null;
  color: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

interface CachedGroup {
  id: string;
  name: string;
  memo_ids: string[];
}

interface EmbRow {
  memo_id: string;
  embedding: string | number[];
}

/** GPT-4o-mini로 그룹명 생성 (10자 이내) */
async function generateGroupName(titles: string[]): Promise<string> {
  const openai = getOpenAI();
  const prompt =
    `다음 메모 제목들을 보고, 이 메모들의 공통 주제를 나타내는 짧은 그룹명(10자 이내)을 하나만 응답하세요.\n` +
    `메모 제목: ${titles.slice(0, 3).join(', ')}\n` +
    `응답 예시: SNS 마케팅, 기술 스택 검토, 신규 기능 아이디어`;

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 30,
    temperature: 0.3,
  });
  return (res.choices[0]?.message?.content ?? '기타').trim().slice(0, 10);
}

export async function GET() {
  try {
    // 인증 확인
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });
    }
    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) {
      return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });
    }

    const admin = createAdminSupabaseClient();

    // 유효 캐시 조회
    const { data: cachedRaw } = await rawFrom(admin, 'memo_groups')
      .select('id, name, memo_ids')
      .eq('user_id', authUserId)
      .gt('expires_at', new Date().toISOString());

    const cachedGroups = (cachedRaw as CachedGroup[] | null) ?? [];

    if (cachedGroups.length > 0) {
      // 캐시 HIT: 모든 memo_ids 수집 후 한 번에 조회
      const allMemoIds = cachedGroups.flatMap((g) => g.memo_ids);
      const { data: memosRaw } = await admin
        .from('memos')
        .select('id, title, content, color, is_pinned, created_at, updated_at')
        .in('id', allMemoIds)
        .eq('created_by', authUserId);

      const memos = (memosRaw as unknown as MemoRow[]) ?? [];
      const memoMap = new Map(memos.map((m) => [m.id, m]));
      const data = cachedGroups.map((g) => ({
        id: g.id,
        name: g.name,
        memos: g.memo_ids.map((mid) => memoMap.get(mid)).filter(Boolean),
      }));

      return NextResponse.json({ success: true, data, ungrouped: [] });
    }

    // 캐시 MISS: 전체 메모 + 임베딩 로드
    const { data: allMemosRaw, error: memosError } = await admin
      .from('memos')
      .select('id, title, content, color, is_pinned, created_at, updated_at')
      .eq('created_by', authUserId)
      .order('updated_at', { ascending: false });

    if (memosError) {
      console.error('[groups/GET] memos error:', memosError.message);
      return NextResponse.json({ success: false, error: '메모 조회 실패' }, { status: 500 });
    }

    const allMemos = (allMemosRaw as unknown as MemoRow[]) ?? [];
    if (allMemos.length === 0) {
      return NextResponse.json({ success: true, data: [], ungrouped: [] });
    }

    const { data: embRaw } = await rawFrom(admin, 'memo_embeddings')
      .select('memo_id, embedding')
      .in('memo_id', allMemos.map((m) => m.id));

    const embRows = (embRaw as EmbRow[] | null) ?? [];
    const embeddedIds = new Set(embRows.map((e) => e.memo_id));

    // 임베딩 없는 메모는 ungrouped
    const ungroupedSet = new Set(
      allMemos.filter((m) => !embeddedIds.has(m.id)).map((m) => m.id),
    );

    const embeddingRows = embRows.map((e) => ({
      memo_id: e.memo_id,
      embedding: typeof e.embedding === 'string'
        ? (JSON.parse(e.embedding) as number[])
        : (e.embedding as number[]),
    }));

    // 클러스터링
    const clusters = clusterMemos(embeddingRows, 0.75);

    // 클러스터에 속하지 않는 임베딩 메모도 ungrouped
    const groupedIds = new Set<string>();
    for (const ids of clusters.values()) {
      for (const mid of ids) groupedIds.add(mid);
    }
    for (const m of allMemos) {
      if (embeddedIds.has(m.id) && !groupedIds.has(m.id)) {
        ungroupedSet.add(m.id);
      }
    }

    const memoMap = new Map(allMemos.map((m) => [m.id, m]));

    // 각 클러스터 그룹명 생성 — 병렬 처리
    const clusterEntries = [...clusters.entries()].map(([, ids]) => {
      const clusterMemoObjs = ids
        .map((mid) => memoMap.get(mid))
        .filter((m): m is MemoRow => m !== undefined);
      return { ids, clusterMemoObjs, titles: clusterMemoObjs.map((m) => m.title) };
    });

    const groupNames = await Promise.all(
      clusterEntries.map(({ titles }) =>
        generateGroupName(titles).catch((err) => {
          console.warn('[groups/GET] group name gen failed:', err);
          return '기타';
        })
      )
    );

    // 일괄 INSERT
    const insertRows = clusterEntries.map(({ ids }, i) => ({
      user_id: authUserId,
      name: groupNames[i],
      memo_ids: ids,
    }));

    const { data: insertedRaw } = await rawFrom(admin, 'memo_groups')
      .insert(insertRows)
      .select('id, name, memo_ids');

    const insertedList = (insertedRaw as { id: string; name: string; memo_ids: string[] }[] | null) ?? [];

    const groups: Array<{ id: string; name: string; memos: MemoRow[] }> = clusterEntries.map(
      ({ clusterMemoObjs }, i) => {
        const inserted = insertedList[i];
        return {
          id: inserted?.id ?? crypto.randomUUID(),
          name: inserted?.name ?? groupNames[i],
          memos: clusterMemoObjs,
        };
      }
    );

    const ungrouped = allMemos.filter((m) => ungroupedSet.has(m.id));

    return NextResponse.json({ success: true, data: groups, ungrouped });
  } catch (err) {
    console.error('[groups/GET] error:', err);
    return NextResponse.json({ success: false, error: '서버 오류' }, { status: 500 });
  }
}
