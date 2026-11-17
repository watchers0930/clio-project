import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { embedDocument } from '@/lib/ai/embed-document';
import { withMutationOrInternal } from '@/lib/http/mutation-guard';
import { withAuth } from '@/lib/api-helper';
import { getUserRoleInfo, isAdmin } from '@/lib/permissions';

// 문서 검색 벡터 일괄 생성(관리용) — 서버 간 호출(x-internal-secret) 또는 관리자 세션(출처·CSRF 확인)
// body: { mode?: 'missing' | 'all', before?: ISO, cursor?: 문서 id }
//   missing(기본)=벡터 없는 원본 문서만 / all=before 시각 이전에 만든 벡터도 다시 생성(본문 정리 후 재색인용)
// 한 번에 최대 BATCH 건을 문서 id 순으로 처리하고 nextCursor 를 돌려준다 — nextCursor 가 null 이 될 때까지
// 응답의 before·nextCursor 를 그대로 넘겨 다시 부르면 끝난다(빈 본문·실패 문서가 있어도 커서가 앞으로만 가므로 멈추지 않음).
// 검색은 원본 문서(parent_id 없음)만 보여주므로 버전·스냅샷 행은 대상이 아니다.
const BATCH = 50;
const PAGE = 1000; // PostgREST 기본 최대 행 수 — 넘으면 조용히 잘리므로 페이지로 나눠 읽는다

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function readAll<T>(query: (from: number, to: number) => any): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) return rows;
  }
}

export async function POST(request: NextRequest) {
  const guard = await withMutationOrInternal(request);
  if (guard.error) return guard.error;
  if (!guard.internal) {
    const auth = await withAuth();
    if (auth.error) return auth.error;
    const roleInfo = await getUserRoleInfo(auth.supabase, auth.userId);
    if (!roleInfo || !isAdmin(roleInfo.role)) {
      return NextResponse.json({ error: '관리자만 실행할 수 있습니다.' }, { status: 403 });
    }
  }

  const body = await request.json().catch(() => ({}));
  const mode = body?.mode === 'all' ? 'all' : 'missing';
  const now = Date.now();
  // all 모드 기준 시각 — 첫 호출 시각을 돌려주고 다음 호출에 그대로 넘긴다. 미래 시각은 끝나지 않으므로 현재로 자른다.
  const parsedBefore = typeof body?.before === 'string' ? Date.parse(body.before) : NaN;
  const before = new Date(Number.isNaN(parsedBefore) ? now : Math.min(parsedBefore, now)).toISOString();
  const cursor = typeof body?.cursor === 'string' ? body.cursor : '';

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminSupabaseClient() as any;

    const docs = await readAll<{ id: string }>((from, to) =>
      admin.from('documents').select('id').is('parent_id', null).not('content', 'is', null).order('id').range(from, to));
    const embedded = await readAll<{ document_id: string; created_at: string }>((from, to) =>
      admin.from('document_embeddings').select('document_id, created_at').order('document_id').range(from, to));
    const vecAt = new Map(embedded.map((e) => [e.document_id, e.created_at]));

    const pending = docs.filter((d) => {
      if (!vecAt.has(d.id)) return true;
      return mode === 'all' && Date.parse(vecAt.get(d.id)!) < Date.parse(before);
    });
    const ahead = pending.filter((d) => d.id > cursor); // id 순 커서 — 앞으로만 진행
    const batch = ahead.slice(0, BATCH);

    let success = 0;
    let empty = 0;
    let failed = 0;
    for (const doc of batch) {
      try {
        // 본문은 목록 조회 때가 아니라 지금 다시 읽는다(그사이 수정된 본문 기준)
        const { data: row } = await admin.from('documents').select('content').eq('id', doc.id).maybeSingle();
        if (!row) continue;
        // 지우지 않고 덮어쓴다(created_at 갱신) — 생성이 실패해도 기존 벡터는 남는다
        const result = await embedDocument(doc.id, row.content ?? '');
        if (result === 'empty') empty++;
        else success++;
      } catch (e) {
        console.error('[embed-all] doc error:', doc.id, e instanceof Error ? e.message : e);
        failed++;
      }
      await new Promise((r) => setTimeout(r, 200)); // 임베딩 API 호출 속도 제한 방어
    }

    const nextCursor = ahead.length > BATCH ? batch[batch.length - 1].id : null;
    return NextResponse.json({
      mode, before, total: docs.length, processed: batch.length, success, empty, failed,
      remaining: Math.max(0, ahead.length - batch.length), nextCursor,
    });
  } catch (e) {
    console.error('[embed-all] error:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: '백필 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
