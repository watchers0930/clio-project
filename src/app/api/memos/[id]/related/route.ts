/**
 * GET /api/memos/[id]/related
 * 특정 메모와 유사한 메모 최대 3개 반환
 * - 인증 확인 + 메모 소유권 확인
 * - 임베딩 없으면 빈 배열 반환 (에러 없이)
 * - match_memo_embeddings RPC 호출 (threshold: 0.75, count: 3)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';

// memo_embeddings 테이블은 마이그레이션으로 추가되어 generated types에 없으므로 캐스팅 사용
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rawFrom(admin: ReturnType<typeof createAdminSupabaseClient>, table: string): any {
  return (admin as unknown as Record<string, (t: string) => unknown>).from(table);
}

interface MemoBasic {
  id: string;
  created_by: string;
}

interface EmbeddingRow {
  embedding: string | number[];
}

interface MatchResult {
  memo_id: string;
  similarity: number;
}

interface MemoTitle {
  id: string;
  title: string;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // 인증 확인
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });
    }
    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) {
      return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });
    }

    // 메모 소유권 확인
    const admin = createAdminSupabaseClient();
    const { data: memoRaw, error: memoError } = await admin
      .from('memos')
      .select('id, created_by')
      .eq('id', id)
      .single();

    const memo = memoRaw as unknown as MemoBasic | null;

    if (memoError || !memo) {
      return NextResponse.json({ success: false, error: '메모 없음' }, { status: 404 });
    }
    if (memo.created_by !== authUserId) {
      return NextResponse.json({ success: false, error: '권한 없음' }, { status: 403 });
    }

    // 해당 메모의 임베딩 조회
    const { data: embRaw } = await rawFrom(admin, 'memo_embeddings')
      .select('embedding')
      .eq('memo_id', id)
      .single();

    const embRow = embRaw as EmbeddingRow | null;

    // 임베딩 없으면 빈 배열 반환
    if (!embRow) {
      return NextResponse.json({ success: true, data: [] });
    }

    // match_memo_embeddings RPC 호출
    const queryEmbedding =
      typeof embRow.embedding === 'string'
        ? JSON.parse(embRow.embedding)
        : embRow.embedding;

    const { data: matchesRaw, error: rpcError } = await admin.rpc(
      'match_memo_embeddings' as never,
      {
        query_embedding: queryEmbedding,
        match_user_id: authUserId,
        exclude_memo_id: id,
        match_count: 3,
        similarity_threshold: 0.75,
      } as never,
    );

    if (rpcError) {
      console.error('[related/GET] rpc error:', rpcError.message);
      return NextResponse.json({ success: false, error: '유사도 검색 실패' }, { status: 500 });
    }

    const matches = (matchesRaw as MatchResult[] | null) ?? [];

    if (matches.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // memo_id로 제목 조회
    const memoIds = matches.map((m) => m.memo_id);
    const { data: relatedRaw, error: memosError } = await admin
      .from('memos')
      .select('id, title')
      .in('id', memoIds);

    if (memosError) {
      console.error('[related/GET] memos fetch error:', memosError.message);
      return NextResponse.json({ success: false, error: '메모 조회 실패' }, { status: 500 });
    }

    const relatedMemos = (relatedRaw as unknown as MemoTitle[]) ?? [];
    const titleMap = new Map(relatedMemos.map((m) => [m.id, m.title]));

    const data = matches
      .map((m) => ({
        id: m.memo_id,
        title: titleMap.get(m.memo_id) ?? '',
        similarity: m.similarity,
      }))
      .filter((m) => m.title !== '');

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('[related/GET] error:', err);
    return NextResponse.json({ success: false, error: '서버 오류' }, { status: 500 });
  }
}
