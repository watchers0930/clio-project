import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import { canDelegate } from '@/lib/approval/build-line';

export const maxDuration = 20;

// GET /api/approvals/by-document/[documentId]
// 이 문서의 결재 진행 상태 + 현재 로그인 사용자가 결재할 차례인지 반환
export async function GET(_request: NextRequest, { params }: { params: Promise<{ documentId: string }> }) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });

  const authUserId = await getAuthUserId(supabase);
  if (!authUserId) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

  const { documentId } = await params;
  const admin = createAdminSupabaseClient();

  const { data: req } = await admin
    .from('approval_requests')
    .select('id, requester_id, status, current_step')
    .eq('document_id', documentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!req) return NextResponse.json({ success: true, hasApproval: false });

  const { data: steps } = await admin
    .from('approval_steps')
    .select('step_order, approver_id, rank_title, status')
    .eq('request_id', req.id)
    .order('step_order', { ascending: true });
  const stepList = steps ?? [];

  const currentStep = stepList.find((s) => s.step_order === req.current_step);
  const isMyTurn = req.status === 'pending' && currentStep?.approver_id === authUserId;

  // 전결 권한(내 직위)
  let iCanDelegate = false;
  if (isMyTurn) {
    const { data: me } = await admin.from('users').select('rank_level').eq('id', authUserId).maybeSingle();
    iCanDelegate = canDelegate(me?.rank_level ?? null);
  }

  return NextResponse.json({
    success: true,
    hasApproval: true,
    requestId: req.id,
    status: req.status,           // pending | approved | rejected
    isMyTurn,
    myRankTitle: isMyTurn ? (currentStep?.rank_title ?? '') : null,
    iCanDelegate,
  });
}
