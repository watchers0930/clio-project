import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import { getUserRoleInfo, isAdmin } from '@/lib/permissions';

/**
 * GET /api/files/[id]/share — 파일 공유 현황 조회
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: fileId } = await params;
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });

    const { data, error } = await supabase
      .from('file_permissions')
      .select('*, users:granted_to_user(id, name, email), departments:granted_to_dept(id, name), granter:granted_by(name)')
      .eq('file_id', fileId);

    if (error) {
      console.error('[files/share/GET]', error.message);
      return NextResponse.json({ success: false, error: '공유 현황 조회 실패' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch {
    return NextResponse.json({ success: false, error: '공유 현황 조회 중 오류' }, { status: 500 });
  }
}

/**
 * POST /api/files/[id]/share — 파일에 읽기 권한 부여
 * body: { userId?: string, departmentId?: string, permission?: 'read' | 'edit' }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: fileId } = await params;
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

    const roleInfo = await getUserRoleInfo(supabase, authUserId);
    if (!roleInfo) return NextResponse.json({ success: false, error: '사용자 정보 없음' }, { status: 403 });

    // 파일 소유자 또는 admin/manager만 공유 가능
    const { data: file } = await supabase
      .from('files')
      .select('uploaded_by, department_id')
      .eq('id', fileId)
      .single();

    if (!file) return NextResponse.json({ success: false, error: '파일을 찾을 수 없습니다.' }, { status: 404 });

    const canShare = isAdmin(roleInfo.role)
      || file.uploaded_by === authUserId
      || (roleInfo.role === 'manager' && file.department_id === roleInfo.department_id);

    if (!canShare) {
      return NextResponse.json({ success: false, error: '파일 공유 권한이 없습니다.' }, { status: 403 });
    }

    const { userId, departmentId, permission } = await request.json();
    if (!userId && !departmentId) {
      return NextResponse.json({ success: false, error: '공유 대상 (사용자 또는 부서)이 필요합니다.' }, { status: 400 });
    }

    const { data, error } = await supabase.from('file_permissions').insert({
      file_id: fileId,
      granted_to_user: userId ?? null,
      granted_to_dept: departmentId ?? null,
      permission: permission ?? 'read',
      granted_by: authUserId,
    }).select().single();

    if (error) {
      console.error('[files/share/POST]', error.message);
      return NextResponse.json({ success: false, error: '권한 부여 실패' }, { status: 500 });
    }

    // audit_logs
    await supabase.from('audit_logs').insert({
      user_id: authUserId,
      action: 'file.share',
      target_type: 'file',
      target_id: fileId,
      details: { shared_with_user: userId, shared_with_dept: departmentId, permission: permission ?? 'read' },
    }).then(() => {}, () => {});

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, error: '파일 공유 중 오류' }, { status: 500 });
  }
}

/**
 * DELETE /api/files/[id]/share — 공유 권한 제거
 * query: ?permissionId=xxx
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: fileId } = await params;
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const permissionId = searchParams.get('permissionId');
    if (!permissionId) return NextResponse.json({ success: false, error: 'permissionId 필수' }, { status: 400 });

    const { error } = await supabase
      .from('file_permissions')
      .delete()
      .eq('id', permissionId)
      .eq('file_id', fileId);

    if (error) {
      console.error('[files/share/DELETE]', error.message);
      return NextResponse.json({ success: false, error: '권한 제거 실패' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: '권한 제거 중 오류' }, { status: 500 });
  }
}
