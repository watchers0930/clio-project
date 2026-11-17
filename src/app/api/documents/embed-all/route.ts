import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { embedDocument } from '@/lib/ai/embed-document';
import { withMutationOrInternal } from '@/lib/http/mutation-guard';
import { withAuth } from '@/lib/api-helper';
import { getUserRoleInfo, isAdmin } from '@/lib/permissions';

// 문서 검색 벡터 일괄 생성(관리용) — 서버 간 호출(x-internal-secret) 또는 관리자 세션(출처·CSRF 확인)
// body: { mode?: 'missing' | 'all' } — missing(기본)=벡터 없는 문서만, all=있는 것도 다시 생성(본문 정리 후 재색인용)
// 한 번에 최대 BATCH 건 — 남은 수(remaining)를 돌려주므로 0 이 될 때까지 다시 부르면 된다(문서가 늘어도 함수 시간 한도 안에서 끝남).
const BATCH = 50;

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
  // all 모드: 이 시각 이전에 만든 벡터만 다시 만든다 — 첫 호출 시각을 응답으로 돌려주고 다음 호출에 그대로 넘기면 이어서 진행
  const before = typeof body?.before === 'string' && !Number.isNaN(Date.parse(body.before)) ? body.before : new Date().toISOString();

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminSupabaseClient() as any;

    const { data: docs, error } = await admin.from('documents').select('id, title').not('content', 'is', null).order('created_at');
    if (error) {
      console.error('[embed-all] documents query error:', error.message);
      return NextResponse.json({ error: '문서 조회에 실패했습니다.' }, { status: 500 });
    }
    const { data: embedded, error: embErr } = await admin.from('document_embeddings').select('document_id, created_at');
    if (embErr) {
      console.error('[embed-all] embeddings query error:', embErr.message);
      return NextResponse.json({ error: '벡터 조회에 실패했습니다.' }, { status: 500 });
    }
    const vecAt = new Map<string, string>((embedded ?? []).map((e: { document_id: string; created_at: string }) => [e.document_id, e.created_at]));
    const all = (docs ?? []) as Array<{ id: string; title: string }>;
    const pending = all.filter((d) => {
      if (!vecAt.has(d.id)) return true;
      return mode === 'all' && Date.parse(vecAt.get(d.id)!) < Date.parse(before);
    });

    let success = 0;
    let failed = 0;
    for (const doc of pending.slice(0, BATCH)) {
      try {
        // 본문은 목록 조회 때가 아니라 지금 다시 읽는다(그사이 수정된 본문 기준)
        const { data: row } = await admin.from('documents').select('content').eq('id', doc.id).maybeSingle();
        if (!row) continue;
        // 지우지 않고 덮어쓴다(created_at 갱신) — 생성이 실패해도 기존 벡터는 남는다
        await embedDocument(doc.id, row.content ?? '');
        success++;
      } catch (e) {
        console.error('[embed-all] doc error:', doc.id, e instanceof Error ? e.message : e);
        failed++;
      }
      await new Promise((r) => setTimeout(r, 200)); // 임베딩 API 호출 속도 제한 방어
    }

    return NextResponse.json({ mode, before, total: all.length, processed: Math.min(pending.length, BATCH), success, failed, remaining: Math.max(0, pending.length - BATCH) });
  } catch (e) {
    console.error('[embed-all] error:', e);
    return NextResponse.json({ error: '백필 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
