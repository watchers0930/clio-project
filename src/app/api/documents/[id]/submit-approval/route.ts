import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });
    }

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) {
      return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });
    }

    const { approverId } = await request.json();
    if (!approverId) {
      return NextResponse.json({ success: false, error: '결재자를 선택해주세요.' }, { status: 400 });
    }

    if (approverId === authUserId) {
      return NextResponse.json({ success: false, error: '본인에게 결재를 요청할 수 없습니다.' }, { status: 400 });
    }

    const admin = createAdminSupabaseClient();

    // 문서 확인: 작성자 본인 + 상신 가능 상태
    const { data: doc, error: docErr } = await admin
      .from('documents')
      .select('id, title, status, created_by')
      .eq('id', id)
      .single();

    if (docErr || !doc) {
      return NextResponse.json({ success: false, error: '문서를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (doc.created_by !== authUserId) {
      return NextResponse.json({ success: false, error: '본인 문서만 결재 요청할 수 있습니다.' }, { status: 403 });
    }

    if (doc.status !== 'completed' && doc.status !== 'rejected') {
      return NextResponse.json({ success: false, error: '완료 또는 반려 상태만 결재 요청 가능합니다.' }, { status: 400 });
    }

    // 결재자 존재 확인
    const { data: approver } = await admin
      .from('users')
      .select('id, name')
      .eq('id', approverId)
      .single();

    if (!approver) {
      return NextResponse.json({ success: false, error: '결재자를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 기존 pending 결재 취소 (재요청 시)
    await admin
      .from('approvals')
      .update({ status: 'rejected', comment: '새 결재 요청으로 대체됨', decided_at: new Date().toISOString() })
      .eq('document_id', id)
      .eq('status', 'pending')
      .then(() => {}, () => {});

    // 결재 생성
    const { data: approval, error: approvalErr } = await admin
      .from('approvals')
      .insert({
        document_id: id,
        requester_id: authUserId,
        approver_id: approverId,
        status: 'pending',
      })
      .select()
      .single();

    if (approvalErr) {
      console.error('[submit-approval]', approvalErr.message);
      return NextResponse.json({ success: false, error: '결재 요청 실패' }, { status: 500 });
    }

    // 문서 상태 변경
    await admin
      .from('documents')
      .update({ status: 'submitted' })
      .eq('id', id);

    // 감사 로그
    await admin.from('audit_logs').insert({
      user_id: authUserId,
      action: 'document.submit_approval',
      target_type: 'document',
      target_id: id,
      details: { approver_id: approverId, approver_name: approver.name, title: doc.title },
    }).then(() => {}, () => {});

    return NextResponse.json({
      success: true,
      data: {
        approvalId: approval.id,
        documentId: id,
        approverName: approver.name,
        status: 'pending',
      },
    });
  } catch (err) {
    console.error('[submit-approval]', err);
    return NextResponse.json({ success: false, error: '서버 오류' }, { status: 500 });
  }
}
