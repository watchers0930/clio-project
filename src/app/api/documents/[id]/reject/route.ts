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

    const body = await request.json().catch(() => ({}));
    const comment = body.comment;

    if (!comment || comment.trim().length === 0) {
      return NextResponse.json({ success: false, error: '반려 사유를 입력해주세요.' }, { status: 400 });
    }

    const admin = createAdminSupabaseClient();

    // 대기 중인 결재 확인 (내가 결재자)
    const { data: approval, error: findErr } = await admin
      .from('approvals')
      .select('id, document_id, requester_id')
      .eq('document_id', id)
      .eq('approver_id', authUserId)
      .eq('status', 'pending')
      .order('requested_at', { ascending: false })
      .limit(1)
      .single();

    if (findErr || !approval) {
      return NextResponse.json({ success: false, error: '결재 대기 건이 없습니다.' }, { status: 404 });
    }

    // 결재 반려
    const { error: updateErr } = await admin
      .from('approvals')
      .update({
        status: 'rejected',
        comment: comment.trim(),
        decided_at: new Date().toISOString(),
      })
      .eq('id', approval.id);

    if (updateErr) {
      console.error('[reject]', updateErr.message);
      return NextResponse.json({ success: false, error: '반려 처리 실패' }, { status: 500 });
    }

    // 문서 상태 변경
    await admin
      .from('documents')
      .update({ status: 'rejected' })
      .eq('id', id);

    // 감사 로그
    const { data: doc } = await admin
      .from('documents')
      .select('title')
      .eq('id', id)
      .single();

    await admin.from('audit_logs').insert({
      user_id: authUserId,
      action: 'document.reject',
      target_type: 'document',
      target_id: id,
      details: { title: doc?.title ?? '', comment: comment.trim() },
    }).then(() => {}, () => {});

    return NextResponse.json({
      success: true,
      data: { documentId: id, status: 'rejected' },
    });
  } catch (err) {
    console.error('[reject]', err);
    return NextResponse.json({ success: false, error: '서버 오류' }, { status: 500 });
  }
}
