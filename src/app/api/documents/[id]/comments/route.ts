import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import { recordAuditEvent } from '@/lib/audit';
import { canAccessDocument, getUserRoleInfo } from '@/lib/permissions';

async function loadUserNameMap(admin: ReturnType<typeof createAdminSupabaseClient>, userIds: string[]) {
  if (userIds.length === 0) return new Map<string, string>();
  const { data: users, error } = await admin
    .from('users')
    .select('id, name')
    .in('id', userIds);
  if (error) throw error;
  return new Map((users ?? []).map((user) => [user.id, user.name]));
}

// GET /api/documents/[id]/comments — 댓글 목록 (작성자 이름 포함)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params;
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ success: false, error: '서버 오류' }, { status: 503 });

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

    const roleInfo = await getUserRoleInfo(supabase, authUserId);
    if (!roleInfo) return NextResponse.json({ success: false, error: '사용자 정보 없음' }, { status: 403 });

    const canAccess = await canAccessDocument(supabase, authUserId, roleInfo.role, roleInfo.department_id, documentId);
    if (!canAccess) return NextResponse.json({ success: false, error: '문서 접근 권한이 없습니다.' }, { status: 403 });

    const admin = createAdminSupabaseClient();
    const { data, error } = await admin
      .from('document_comments')
      .select('id, content, created_at, user_id, status, applied_at, applied_version_number')
      .eq('document_id', documentId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    const userNameMap = await loadUserNameMap(admin, [...new Set((data ?? []).map((comment) => comment.user_id).filter(Boolean))]);

    const comments = (data ?? []).map((c) => ({
      id: c.id,
      content: c.content,
      created_at: c.created_at,
      user_id: c.user_id,
      status: c.status ?? 'pending',
      applied_at: c.applied_at ?? null,
      applied_version_number: c.applied_version_number ?? null,
      user_name: userNameMap.get(c.user_id) ?? '알 수 없음',
    }));

    return NextResponse.json({ success: true, comments });
  } catch (error) {
    console.error('[document-comments/GET]', error);
    return NextResponse.json({ success: false, error: '댓글 조회 실패' }, { status: 500 });
  }
}

// POST /api/documents/[id]/comments — 댓글 작성
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params;
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ success: false, error: '서버 오류' }, { status: 503 });

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

    const roleInfo = await getUserRoleInfo(supabase, authUserId);
    if (!roleInfo) return NextResponse.json({ success: false, error: '사용자 정보 없음' }, { status: 403 });

    const canAccess = await canAccessDocument(supabase, authUserId, roleInfo.role, roleInfo.department_id, documentId);
    if (!canAccess) return NextResponse.json({ success: false, error: '문서 접근 권한이 없습니다.' }, { status: 403 });

    const body = await req.json();
    const content = (body.content ?? '').trim();
    if (!content) return NextResponse.json({ success: false, error: '댓글 내용을 입력해주세요.' }, { status: 400 });

    // user_id 확인 (users 테이블 기준)
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('id', authUserId)
      .single();
    if (!userData) return NextResponse.json({ success: false, error: '사용자 정보 없음' }, { status: 403 });

    const admin = createAdminSupabaseClient();
    const { data, error } = await admin
      .from('document_comments')
      .insert({ document_id: documentId, user_id: authUserId, content })
      .select('id, content, created_at, user_id, status, applied_at, applied_version_number')
      .single();

    if (error) throw error;
    const userNameMap = await loadUserNameMap(admin, [authUserId]);

    await recordAuditEvent(admin, {
      userId: authUserId,
      action: 'document.comment.create',
      targetType: 'document',
      targetId: documentId,
      details: {
        comment_id: data.id,
        content_length: content.length,
      },
    });

    return NextResponse.json({
      success: true,
      comment: {
        id: data.id,
        content: data.content,
        created_at: data.created_at,
        user_id: data.user_id,
        status: data.status ?? 'pending',
        applied_at: data.applied_at ?? null,
        applied_version_number: data.applied_version_number ?? null,
        user_name: userNameMap.get(authUserId) ?? '알 수 없음',
      },
    });
  } catch (error) {
    console.error('[document-comments/POST]', error);
    return NextResponse.json({ success: false, error: '댓글 작성 실패' }, { status: 500 });
  }
}
