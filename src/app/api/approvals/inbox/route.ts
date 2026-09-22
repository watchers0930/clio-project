import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import { canDelegate } from '@/lib/approval/build-line';

export const maxDuration = 20;

// GET /api/approvals/inbox — 내가 지금 결재해야 할 문서 목록 + 내가 올린 진행중 결재
export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });

  const authUserId = await getAuthUserId(supabase);
  if (!authUserId) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

  const admin = createAdminSupabaseClient();

  // 내 직위(전결 가능 여부 표시용)
  const { data: me } = await admin.from('users').select('rank_level').eq('id', authUserId).maybeSingle();
  const iCanDelegate = canDelegate(me?.rank_level ?? null);

  // 내가 결재자로 걸린 대기 단계
  const { data: mySteps } = await admin
    .from('approval_steps')
    .select('id, request_id, step_order, rank_title, status')
    .eq('approver_id', authUserId)
    .eq('status', 'waiting');

  const reqIds = Array.from(new Set((mySteps ?? []).map((s) => s.request_id)));
  const inbox: Array<Record<string, unknown>> = [];

  if (reqIds.length > 0) {
    const { data: reqs } = await admin
      .from('approval_requests')
      .select('id, document_id, requester_id, status, current_step, created_at')
      .in('id', reqIds)
      .eq('status', 'pending');

    const docIds = Array.from(new Set((reqs ?? []).map((r) => r.document_id)));
    const requesterIds = Array.from(new Set((reqs ?? []).map((r) => r.requester_id)));
    const { data: docs } = await admin.from('documents').select('id, title').in('id', docIds.length ? docIds : ['']);
    const { data: reqUsers } = await admin.from('users').select('id, name').in('id', requesterIds.length ? requesterIds : ['']);
    const docTitle = new Map((docs ?? []).map((d) => [d.id, d.title]));
    const userName = new Map((reqUsers ?? []).map((u) => [u.id, u.name]));

    for (const r of reqs ?? []) {
      // 내 단계가 '현재 결재 차례'인 것만 결재함에 노출
      const myStep = (mySteps ?? []).find((s) => s.request_id === r.id && s.step_order === r.current_step);
      if (!myStep) continue;
      inbox.push({
        requestId: r.id,
        documentId: r.document_id,
        documentTitle: docTitle.get(r.document_id) ?? '(제목 없음)',
        requesterName: userName.get(r.requester_id) ?? '',
        stepOrder: r.current_step,
        rankTitle: myStep.rank_title,
        createdAt: r.created_at,
      });
    }
  }

  // 내가 올린 진행중 결재(상신함)
  const { data: mine } = await admin
    .from('approval_requests')
    .select('id, document_id, status, current_step, created_at')
    .eq('requester_id', authUserId)
    .order('created_at', { ascending: false })
    .limit(50);
  const mineDocIds = Array.from(new Set((mine ?? []).map((r) => r.document_id)));
  const { data: mineDocs } = await admin.from('documents').select('id, title').in('id', mineDocIds.length ? mineDocIds : ['']);
  const mineTitle = new Map((mineDocs ?? []).map((d) => [d.id, d.title]));
  const outbox = (mine ?? []).map((r) => ({
    requestId: r.id,
    documentId: r.document_id,
    documentTitle: mineTitle.get(r.document_id) ?? '(제목 없음)',
    status: r.status,
    currentStep: r.current_step,
    createdAt: r.created_at,
  }));

  return NextResponse.json({ success: true, iCanDelegate, inbox, outbox });
}
