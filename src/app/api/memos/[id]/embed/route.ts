/**
 * POST /api/memos/[id]/embed
 * 메모 임베딩 생성·갱신 (fire-and-forget 용도)
 * - 인증 확인 + 메모 소유권 확인
 * - title + "\n" + content 임베딩 생성 후 memo_embeddings UPSERT
 * - 해당 user_id의 memo_groups 캐시 즉시 삭제 (무효화)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import { generateEmbedding } from '@/lib/ai/embeddings';

// memo_embeddings, memo_groups 테이블은 마이그레이션으로 추가되어
// generated types에 아직 없으므로 unknown 경유 캐스팅 사용
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rawFrom(admin: ReturnType<typeof createAdminSupabaseClient>, table: string): any {
  return (admin as unknown as Record<string, (t: string) => unknown>).from(table);
}

interface MemoRow {
  id: string;
  title: string;
  content: string | null;
  created_by: string;
}

export async function POST(
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
      .select('id, title, content, created_by')
      .eq('id', id)
      .single();

    const memo = memoRaw as unknown as MemoRow | null;

    if (memoError || !memo) {
      return NextResponse.json({ success: false, error: '메모 없음' }, { status: 404 });
    }
    if (memo.created_by !== authUserId) {
      return NextResponse.json({ success: false, error: '권한 없음' }, { status: 403 });
    }

    // 임베딩 생성
    const text = `${memo.title}\n${memo.content ?? ''}`.trim();
    const embedding = await generateEmbedding(text);

    // memo_embeddings UPSERT
    const { error: upsertError } = await rawFrom(admin, 'memo_embeddings')
      .upsert({ memo_id: id, embedding: JSON.stringify(embedding) }, { onConflict: 'memo_id' });

    if (upsertError) {
      console.error('[embed/POST] upsert error:', upsertError.message);
      return NextResponse.json({ success: false, error: '임베딩 저장 실패' }, { status: 500 });
    }

    // 만료된 캐시만 삭제 (유효 캐시는 TTL 동안 유지)
    const { error: deleteError } = await rawFrom(admin, 'memo_groups')
      .delete()
      .eq('user_id', authUserId)
      .lt('expires_at', new Date().toISOString());

    if (deleteError) {
      // 캐시 삭제 실패는 치명적이지 않으므로 경고만 출력
      console.warn('[embed/POST] cache delete warn:', deleteError.message);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[embed/POST] error:', err);
    return NextResponse.json({ success: false, error: '서버 오류' }, { status: 500 });
  }
}
