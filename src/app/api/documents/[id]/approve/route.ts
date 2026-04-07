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
    const comment = body.comment ?? null;

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

    // 결재 승인
    const { error: updateErr } = await admin
      .from('approvals')
      .update({
        status: 'approved',
        comment,
        decided_at: new Date().toISOString(),
      })
      .eq('id', approval.id);

    if (updateErr) {
      console.error('[approve]', updateErr.message);
      return NextResponse.json({ success: false, error: '승인 처리 실패' }, { status: 500 });
    }

    // 문서 상태 변경
    await admin
      .from('documents')
      .update({ status: 'approved' })
      .eq('id', id);

    // 감사 로그
    const { data: doc } = await admin
      .from('documents')
      .select('title')
      .eq('id', id)
      .single();

    await admin.from('audit_logs').insert({
      user_id: authUserId,
      action: 'document.approve',
      target_type: 'document',
      target_id: id,
      details: { title: doc?.title ?? '', comment },
    }).then(() => {}, () => {});

    return NextResponse.json({
      success: true,
      data: { documentId: id, status: 'approved' },
    });
  } catch (err) {
    console.error('[approve]', err);
    return NextResponse.json({ success: false, error: '서버 오류' }, { status: 500 });
  }
}
