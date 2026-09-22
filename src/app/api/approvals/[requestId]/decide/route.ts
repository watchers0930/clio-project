import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import { createNotifications } from '@/lib/notifications/create-notification';
import { canDelegate } from '@/lib/approval/build-line';

export const maxDuration = 30;

type Action = 'approve' | 'reject' | 'delegate';

// POST /api/approvals/[requestId]/decide — 현재 단계 결재자가 승인/반려/전결 처리
// body { action: 'approve'|'reject'|'delegate', comment?: string }
export async function POST(request: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });

  const authUserId = await getAuthUserId(supabase);
  if (!authUserId) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

  const { requestId } = await params;
  let action: Action = 'approve';
  let comment = '';
  try {
    const b = await request.json();
    if (b?.action === 'reject' || b?.action === 'delegate' || b?.action === 'approve') action = b.action;
    comment = typeof b?.comment === 'string' ? b.comment.trim().slice(0, 1000) : '';
  } catch { /* */ }

  const admin = createAdminSupabaseClient();

  // 결재 건 + 현재 단계
  const { data: req } = await admin
    .from('approval_requests')
    .select('id, document_id, requester_id, status, current_step')
    .eq('id', requestId)
    .maybeSingle();
  if (!req) return NextResponse.json({ success: false, error: '결재 건을 찾을 수 없습니다.' }, { status: 404 });
  if (req.status !== 'pending') return NextResponse.json({ success: false, error: '이미 종결된 결재입니다.' }, { status: 409 });

  const { data: steps } = await admin
    .from('approval_steps')
    .select('id, step_order, approver_id, status, rank_title')
    .eq('request_id', requestId)
    .order('step_order', { ascending: true });
  const stepList = steps ?? [];
  const currentStep = stepList.find((s) => s.step_order === req.current_step);
  if (!currentStep) return NextResponse.json({ success: false, error: '현재 결재 단계를 찾을 수 없습니다.' }, { status: 500 });

  // 본인 결재 차례 검증 (IDOR 방지)
  if (currentStep.approver_id !== authUserId) {
    return NextResponse.json({ success: false, error: '현재 결재할 차례가 아닙니다.' }, { status: 403 });
  }

  // 결재자 서명·직위
  const { data: me } = await admin
    .from('users')
    .select('name, signature_path, rank_level')
    .eq('id', authUserId)
    .maybeSingle();
  const mySig = me?.signature_path ?? null;
  const nowIso = new Date().toISOString();

  const maxOrder = stepList.reduce((m, s) => Math.max(m, s.step_order), 0);

  const notifyRequester = async (type: 'approval_approved' | 'approval_rejected', title: string, body: string) => {
    await createNotifications(admin, {
      recipientIds: [req.requester_id],
      actorId: authUserId,
      type,
      title,
      body,
      link: `/documents/${req.document_id}`,
    });
  };

  // ── 반려 ──
  if (action === 'reject') {
    await admin.from('approval_steps').update({ status: 'rejected', comment, decided_at: nowIso }).eq('id', currentStep.id);
    await admin.from('approval_requests').update({ status: 'rejected', completed_at: nowIso }).eq('id', requestId);
    await admin.from('documents').update({ status: 'rejected' }).eq('id', req.document_id);
    await notifyRequester('approval_rejected', '결재 반려', `${me?.name ?? '결재자'}님이 반려했습니다.${comment ? ` 사유: ${comment}` : ''}`);
    return NextResponse.json({ success: true, result: 'rejected' });
  }

  // ── 전결 ── (이사급 이상만)
  if (action === 'delegate') {
    if (!canDelegate(me?.rank_level ?? null)) {
      return NextResponse.json({ success: false, error: '전결 권한이 없습니다. (이사급 이상만 전결 가능)' }, { status: 403 });
    }
    await admin.from('approval_steps').update({ status: 'delegated', signature_path: mySig, comment, decided_at: nowIso }).eq('id', currentStep.id);
    // 남은 상위 단계 생략 처리
    await admin.from('approval_steps').update({ status: 'skipped' }).eq('request_id', requestId).gt('step_order', req.current_step);
    await admin.from('approval_requests').update({ status: 'approved', current_step: req.current_step, completed_at: nowIso }).eq('id', requestId);
    await admin.from('documents').update({ status: 'approved' }).eq('id', req.document_id);
    await notifyRequester('approval_approved', '결재 완료 (전결)', `${me?.name ?? '결재자'}님이 전결로 결재를 완료했습니다.`);
    return NextResponse.json({ success: true, result: 'delegated' });
  }

  // ── 승인 ──
  await admin.from('approval_steps').update({ status: 'approved', signature_path: mySig, comment, decided_at: nowIso }).eq('id', currentStep.id);

  if (req.current_step >= maxOrder) {
    // 마지막 단계 → 결재 완료
    await admin.from('approval_requests').update({ status: 'approved', completed_at: nowIso }).eq('id', requestId);
    await admin.from('documents').update({ status: 'approved' }).eq('id', req.document_id);
    await notifyRequester('approval_approved', '결재 완료', '모든 결재가 완료되었습니다.');
    return NextResponse.json({ success: true, result: 'completed' });
  }

  // 다음 단계로 전이
  const nextOrder = req.current_step + 1;
  await admin.from('approval_requests').update({ current_step: nextOrder }).eq('id', requestId);
  const nextStep = stepList.find((s) => s.step_order === nextOrder);
  if (nextStep) {
    await createNotifications(admin, {
      recipientIds: [nextStep.approver_id],
      actorId: authUserId,
      type: 'approval_requested',
      title: '결재 요청',
      body: '결재 차례가 도착했습니다.',
      link: `/documents/${req.document_id}`,
    });
  }
  return NextResponse.json({ success: true, result: 'advanced', nextStep: nextOrder });
}
