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
    const { data: comment } = await admin
      .from('document_comments')
      .select('id')
      .eq('id', commentId)
      .single();

    if (!comment) return NextResponse.json({ success: false, error: '댓글을 찾을 수 없습니다.' }, { status: 404 });

    const { error } = await admin.from('document_comments').update({
      status: nextStatus,
      applied_at: null,
      applied_by: null,
      applied_version_number: null,
    }).eq('id', commentId);

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
      .single();

    if (!comment) return NextResponse.json({ success: false, error: '댓글을 찾을 수 없습니다.' }, { status: 404 });
    if (comment.user_id !== authUserId) return NextResponse.json({ success: false, error: '본인 댓글만 삭제할 수 있습니다.' }, { status: 403 });

    const { error } = await admin.from('document_comments').delete().eq('id', commentId);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: '댓글 삭제 실패' }, { status: 500 });
  }
}
