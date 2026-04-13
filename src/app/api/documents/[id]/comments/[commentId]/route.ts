import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';

// DELETE /api/documents/[id]/comments/[commentId] — 본인 댓글 삭제
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const { commentId } = await params;
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ success: false, error: '서버 오류' }, { status: 503 });

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

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
