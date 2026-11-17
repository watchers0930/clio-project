import { withMutation } from '@/lib/http/mutation-guard';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import { recordAuditEvent } from '@/lib/audit';
import { canAccessDocument, getUserRoleInfo } from '@/lib/permissions';

// PATCH /api/documents/[id]/comments/[commentId] — 댓글 상태 변경
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  // 변이 요청: 출처 + CSRF 토큰 + 활성 사용자 확인 (기존 권한 확인은 아래 그대로)
  const mutation = await withMutation(req);
  if (mutation.error) return mutation.error;
  try {
    const { id: documentId, commentId } = await params;
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ success: false, error: '서버 오류' }, { status: 503 });

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

    const roleInfo = await getUserRoleInfo(supabase, authUserId);
    if (!roleInfo) return NextResponse.json({ success: false, error: '사용자 정보 없음' }, { status: 403 });

    const canAccess = await canAccessDocument(supabase, authUserId, roleInfo.role, roleInfo.department_id, documentId);
    if (!canAccess) return NextResponse.json({ success: false, error: '문서 접근 권한이 없습니다.' }, { status: 403 });

    const body = await req.json();
    const nextStatus = body.status as 'pending' | 'held' | undefined;
    if (!nextStatus || !['pending', 'held'].includes(nextStatus)) {
      return NextResponse.json({ success: false, error: '유효하지 않은 상태입니다.' }, { status: 400 });
    }

    const admin = createAdminSupabaseClient();
    // 이 문서의 댓글만(서버 권한이라 경로의 문서와 묶지 않으면 남의 문서 댓글 상태를 바꿀 수 있었다)
    const { data: comment } = await admin
      .from('document_comments')
      .select('id, status')
      .eq('id', commentId)
      .eq('document_id', documentId)
      .maybeSingle();

    if (!comment) return NextResponse.json({ success: false, error: '댓글을 찾을 수 없습니다.' }, { status: 404 });
    // 반영된 댓글은 반영 기록(버전·반영자)을 지우지 않도록 되돌리지 않는다 — 화면도 보류/다시 검토만 제공한다
    if (comment.status === 'applied') {
      return NextResponse.json({ success: false, error: '이미 반영된 댓글은 상태를 바꿀 수 없습니다.' }, { status: 409 });
    }

    const { error } = await admin.from('document_comments').update({ status: nextStatus })
      .eq('id', commentId)
      .eq('document_id', documentId)
      .neq('status', 'applied');

    if (error) throw error;

    await recordAuditEvent(admin, {
      userId: authUserId,
      action: 'document.comment.status',
      targetType: 'document',
      targetId: documentId,
      details: {
        comment_id: commentId,
        status: nextStatus,
      },
    });

    return NextResponse.json({ success: true, status: nextStatus });
  } catch {
    return NextResponse.json({ success: false, error: '댓글 상태 변경 실패' }, { status: 500 });
  }
}

// DELETE /api/documents/[id]/comments/[commentId] — 본인 댓글 삭제
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  // 변이 요청: 출처 + CSRF 토큰 + 활성 사용자 확인 (기존 권한 확인은 아래 그대로)
  const mutation = await withMutation(_req);
  if (mutation.error) return mutation.error;
  try {
    const { id: documentId, commentId } = await params;
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ success: false, error: '서버 오류' }, { status: 503 });

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

    const roleInfo = await getUserRoleInfo(supabase, authUserId);
    if (!roleInfo) return NextResponse.json({ success: false, error: '사용자 정보 없음' }, { status: 403 });

    const canAccess = await canAccessDocument(supabase, authUserId, roleInfo.role, roleInfo.department_id, documentId);
    if (!canAccess) return NextResponse.json({ success: false, error: '문서 접근 권한이 없습니다.' }, { status: 403 });

    const admin = createAdminSupabaseClient();

    // 본인 댓글인지 확인
    const { data: comment } = await admin
      .from('document_comments')
      .select('user_id')
      .eq('id', commentId)
      .eq('document_id', documentId)
      .maybeSingle();

    if (!comment) return NextResponse.json({ success: false, error: '댓글을 찾을 수 없습니다.' }, { status: 404 });
    if (comment.user_id !== authUserId) return NextResponse.json({ success: false, error: '본인 댓글만 삭제할 수 있습니다.' }, { status: 403 });

    const { error } = await admin.from('document_comments').delete().eq('id', commentId).eq('document_id', documentId);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: '댓글 삭제 실패' }, { status: 500 });
  }
}
