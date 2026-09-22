import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import { isAdmin, getUserRoleInfo } from '@/lib/permissions';

export const maxDuration = 20;

// GET /api/approvals/[requestId] — 결재 건 진행 상세(단계별 상태·결재자·직위)
export async function GET(_request: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });

  const authUserId = await getAuthUserId(supabase);
  if (!authUserId) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

  const { requestId } = await params;
  const admin = createAdminSupabaseClient();

  const { data: req } = await admin
    .from('approval_requests')
    .select('id, document_id, requester_id, status, current_step, created_at, completed_at')
    .eq('id', requestId)
    .maybeSingle();
  if (!req) return NextResponse.json({ success: false, error: '결재 건을 찾을 수 없습니다.' }, { status: 404 });

  const { data: steps } = await admin
    .from('approval_steps')
    .select('step_order, approver_id, rank_title, status, comment, decided_at')
    .eq('request_id', requestId)
    .order('step_order', { ascending: true });
  const stepList = steps ?? [];

  // 접근 권한: 신청자·결재선상 결재자·admin
  const roleInfo = await getUserRoleInfo(supabase, authUserId);
  const isParticipant =
    req.requester_id === authUserId ||
    stepList.some((s) => s.approver_id === authUserId) ||
    (roleInfo && isAdmin(roleInfo.role));
  if (!isParticipant) return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });

  const approverIds = Array.from(new Set(stepList.map((s) => s.approver_id)));
  const { data: users } = await admin.from('users').select('id, name').in('id', approverIds.length ? approverIds : ['']);
  const nameById = new Map((users ?? []).map((u) => [u.id, u.name]));

  const timeline = stepList.map((s) => ({
    stepOrder: s.step_order,
    approverName: nameById.get(s.approver_id) ?? '',
    rankTitle: s.rank_title,
    status: s.status, // approved | waiting | rejected | delegated | skipped
    comment: s.comment,
    decidedAt: s.decided_at,
    isCurrent: req.status === 'pending' && s.step_order === req.current_step,
  }));

  return NextResponse.json({
    success: true,
    request: {
      id: req.id,
      documentId: req.document_id,
      status: req.status,
      currentStep: req.current_step,
      createdAt: req.created_at,
      completedAt: req.completed_at,
    },
    timeline,
  });
}
