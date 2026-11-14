import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import { canAccessFile, getUserRoleInfo, isAdmin } from '@/lib/permissions';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createNotifications } from '@/lib/notifications/create-notification';
import { uuid } from '@/lib/attendance/date';

type ServerClient = NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>;

/**
 * 공유 권한 확인: 파일 소유자 또는 admin, 같은 부서 manager.
 * 파일 행은 service role 로 읽는다 — 사용자 세션 RLS 로 읽으면 admin 이 다른 부서 파일에서 404 가 난다.
 * 반환: 'missing'(파일 없음) | 'denied' | 'ok'
 */
async function shareAccess(supabase: ServerClient, fileId: string, userId: string): Promise<'missing' | 'denied' | 'ok'> {
  const roleInfo = await getUserRoleInfo(supabase, userId);
  if (!roleInfo) return 'denied';
  const { data: file } = await createAdminSupabaseClient()
    .from('files')
    .select('uploaded_by, department_id')
    .eq('id', fileId)
    .maybeSingle();
  if (!file) return 'missing';
  const canShare = isAdmin(roleInfo.role)
    || file.uploaded_by === userId
    || (roleInfo.role === 'manager' && file.department_id === roleInfo.department_id);
  return canShare ? 'ok' : 'denied';
}

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

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

    // 파일을 볼 수 있는 사람만 공유 현황 조회 (문서 공유 GET 과 같은 규칙)
    const roleInfo = await getUserRoleInfo(supabase, authUserId);
    if (!roleInfo || !(await canAccessFile(supabase, authUserId, roleInfo.role, roleInfo.department_id, fileId))) {
      return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const { data, error } = await createAdminSupabaseClient()
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

    // 파일 소유자 또는 admin/manager만 공유 가능
    const access = await shareAccess(supabase, fileId, authUserId);
    if (access === 'missing') return NextResponse.json({ success: false, error: '파일을 찾을 수 없습니다.' }, { status: 404 });
    if (access === 'denied') return NextResponse.json({ success: false, error: '파일 공유 권한이 없습니다.' }, { status: 403 });

    const { userId, departmentId, permission } = await request.json();
    if (!userId && !departmentId) {
      return NextResponse.json({ success: false, error: '공유 대상 (사용자 또는 부서)이 필요합니다.' }, { status: 400 });
    }
    // service role 로 넣으므로 값 형식을 서버에서 확인한다
    if ((userId && !uuid(userId)) || (departmentId && !uuid(departmentId))
      || (permission !== undefined && permission !== 'read' && permission !== 'edit')) {
      return NextResponse.json({ success: false, error: '공유 요청 값이 올바르지 않습니다.' }, { status: 400 });
    }

    // file_permissions 쓰기는 사용자 세션이 막혀 있다(055) — 위 공유 권한 확인 후 service role 로 넣는다
    const { data, error } = await createAdminSupabaseClient().from('file_permissions').insert({
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

    // 공유 대상(사용자 또는 부서 구성원)에게 알림. best-effort.
    try {
      const admin = createAdminSupabaseClient();
      let recipientIds: string[] = [];
      if (userId) {
        recipientIds = [userId];
      } else if (departmentId) {
        const { data: deptUsers } = await admin.from('users').select('id').eq('department_id', departmentId);
        recipientIds = (deptUsers ?? []).map((u) => u.id);
      }
      const [{ data: actor }, { data: fileRow }] = await Promise.all([
        admin.from('users').select('name').eq('id', authUserId).single(),
        admin.from('files').select('name').eq('id', fileId).single(),
      ]);
      await createNotifications(admin, {
        recipientIds,
        actorId: authUserId,
        type: 'file_shared',
        title: `${actor?.name ?? '누군가'}님이 파일을 공유했습니다`,
        body: fileRow?.name ?? null,
        link: '/files',
      });
    } catch (e) {
      console.error('[files/share] notify', e);
    }

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

    // 공유한 사람(소유자·admin·같은 부서 manager)만 권한 제거 — 쓰기는 service role(055)
    const access = await shareAccess(supabase, fileId, authUserId);
    if (access === 'missing') return NextResponse.json({ success: false, error: '파일을 찾을 수 없습니다.' }, { status: 404 });
    if (access === 'denied') return NextResponse.json({ success: false, error: '파일 공유 권한이 없습니다.' }, { status: 403 });

    const { error } = await createAdminSupabaseClient()
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
