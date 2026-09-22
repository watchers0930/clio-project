import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import { createNotifications } from '@/lib/notifications/create-notification';
import { buildApprovalLine, type OrgMember } from '@/lib/approval/build-line';

export const maxDuration = 30;

// 결재 깊이 미설정 템플릿의 기본값(담당 + 직속 상위 1명).
const DEFAULT_DEPTH = 2;

// POST /api/approvals — 문서 상신(결재 올리기)
// body { documentId } — 본인이 작성한 문서만 상신 가능
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });

  const authUserId = await getAuthUserId(supabase);
  if (!authUserId) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

  let documentId = '';
  try { const b = await request.json(); documentId = typeof b?.documentId === 'string' ? b.documentId : ''; } catch { /* */ }
  if (!documentId) return NextResponse.json({ success: false, error: '문서 id가 필요합니다.' }, { status: 400 });

  const admin = createAdminSupabaseClient();

  // 문서 조회 + 본인 문서 검증
  const { data: doc } = await admin
    .from('documents')
    .select('id, title, template_id, created_by')
    .eq('id', documentId)
    .maybeSingle();
  if (!doc) return NextResponse.json({ success: false, error: '문서를 찾을 수 없습니다.' }, { status: 404 });
  if (doc.created_by !== authUserId) {
    return NextResponse.json({ success: false, error: '본인이 작성한 문서만 상신할 수 있습니다.' }, { status: 403 });
  }

  // 진행 중 결재 중복 방지
  const { data: existing } = await admin
    .from('approval_requests')
    .select('id, status')
    .eq('document_id', documentId)
    .eq('status', 'pending')
    .maybeSingle();
  if (existing) return NextResponse.json({ success: false, error: '이미 결재가 진행 중입니다.' }, { status: 409 });

  // 결재 깊이
  let depth = DEFAULT_DEPTH;
  if (doc.template_id) {
    const { data: tmpl } = await admin.from('templates').select('approval_depth').eq('id', doc.template_id).maybeSingle();
    const d = (tmpl?.approval_depth ?? null) as number | null;
    if (d && d >= 1) depth = d;
  }
  // 결재란 3칸 양식(품의서 기안/검토/승인, 휴가원 담당/관리/대표)은 3단계 결재
  if (/품의서|휴가원/.test(doc.title ?? '')) depth = 3;

  // 조직도 + 신청자 서명
  const { data: members } = await admin
    .from('users')
    .select('id, name, email, manager_user_id, rank_level, rank_title, signature_path');
  const byId = new Map<string, OrgMember>((members ?? []).map((m: OrgMember) => [m.id, m]));
  const requesterSig = (members ?? []).find((m: { id: string; signature_path?: string | null }) => m.id === authUserId)?.signature_path ?? null;

  const line = buildApprovalLine(authUserId, byId, depth);
  if (line.length < 2) {
    return NextResponse.json(
      { success: false, error: '결재선을 만들 수 없습니다. 조직도에서 직속 상위자를 설정해 주세요.', code: 'no_approver' },
      { status: 400 },
    );
  }

  // 결재 건 생성 — 담당(step1)은 상신과 동시에 승인 처리, 첫 결재자는 step2
  const { data: req, error: reqErr } = await admin
    .from('approval_requests')
    .insert({ document_id: documentId, requester_id: authUserId, status: 'pending', current_step: 2 })
    .select('id')
    .single();
  if (reqErr || !req) return NextResponse.json({ success: false, error: '상신에 실패했습니다.' }, { status: 500 });

  const nowIso = new Date().toISOString();
  const stepRows = line.map((s) => ({
    request_id: req.id,
    step_order: s.step_order,
    approver_id: s.approver_id,
    rank_title: s.rank_title,
    status: s.step_order === 1 ? 'approved' : 'waiting',
    signature_path: s.step_order === 1 ? requesterSig : null,
    decided_at: s.step_order === 1 ? nowIso : null,
  }));
  const { error: stepErr } = await admin.from('approval_steps').insert(stepRows);
  if (stepErr) {
    await admin.from('approval_requests').delete().eq('id', req.id);
    return NextResponse.json({ success: false, error: '결재선 생성에 실패했습니다.' }, { status: 500 });
  }

  // 문서 상태 표시(선택) + 첫 결재자 알림
  await admin.from('documents').update({ status: 'in_approval' }).eq('id', documentId);
  const firstApprover = line.find((s) => s.step_order === 2);
  if (firstApprover) {
    await createNotifications(admin, {
      recipientIds: [firstApprover.approver_id],
      actorId: authUserId,
      type: 'approval_requested',
      title: '결재 요청',
      body: `${doc.title} 문서의 결재를 요청했습니다.`,
      link: `/documents/${documentId}`,
    });
  }

  return NextResponse.json({ success: true, requestId: req.id, line });
}
