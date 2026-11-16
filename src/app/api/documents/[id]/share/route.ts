import { withMutation } from '@/lib/http/mutation-guard';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import { recordAuditEvent } from '@/lib/audit';
import { canAccessDocument, canManageDocument, getUserRoleInfo } from '@/lib/permissions';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { parseShareInput } from '@/lib/documents/share-input';
import { createNotifications } from '@/lib/notifications/create-notification';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: documentId } = await params;
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

    const roleInfo = await getUserRoleInfo(supabase, authUserId);
    if (!roleInfo) return NextResponse.json({ success: false, error: '사용자 정보 없음' }, { status: 403 });

    const canAccess = await canAccessDocument(supabase, authUserId, roleInfo.role, roleInfo.department_id, documentId);
    if (!canAccess) {
      return NextResponse.json({ success: false, error: '문서 접근 권한이 없습니다.' }, { status: 403 });
    }

    // 권한 표는 서버 권한으로만 읽고 쓴다(사용자 세션 정책은 058 에서 본인 행으로 좁힘). 접근 확인은 위에서 끝남
    const { data, error } = await createAdminSupabaseClient()
      .from('document_permissions')
      .select('*, users:granted_to_user(id, name, email), departments:granted_to_dept(id, name), granter:granted_by(name)')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[documents/share/GET]', error.message);
      return NextResponse.json({ success: false, error: '공유 현황 조회 실패' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch {
    return NextResponse.json({ success: false, error: '공유 현황 조회 중 오류' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // 변이 요청: 출처 + CSRF 토큰 + 활성 사용자 확인 (기존 권한 확인은 아래 그대로)
  const mutation = await withMutation(request);
  if (mutation.error) return mutation.error;
  try {
    const { id: documentId } = await params;
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

    const roleInfo = await getUserRoleInfo(supabase, authUserId);
    if (!roleInfo) return NextResponse.json({ success: false, error: '사용자 정보 없음' }, { status: 403 });

    const canShare = await canManageDocument(supabase, authUserId, roleInfo.role, documentId);
    if (!canShare) {
      return NextResponse.json({ success: false, error: '문서 공유 권한이 없습니다.' }, { status: 403 });
    }

    const parsed = parseShareInput(await request.json().catch(() => null));
    if (!parsed.ok) return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
    const { userId, departmentId, permission } = parsed;

    // 권한 부여는 서버 권한으로만 — 사용자 세션의 직접 INSERT 는 058 에서 차단(자기 자신에게 권한 부여 방지).
    // service role 은 RLS 를 거치지 않으므로 대상이 실제로 있는지(활성 사용자·부서) 여기서 확인한다
    const admin = createAdminSupabaseClient();
    const { data: target } = userId
      ? await admin.from('users').select('id').eq('id', userId).eq('is_active', true).maybeSingle()
      : await admin.from('departments').select('id').eq('id', departmentId as string).maybeSingle();
    if (!target) return NextResponse.json({ success: false, error: '공유 대상을 찾을 수 없습니다.' }, { status: 400 });

    const { data, error } = await admin
      .from('document_permissions')
      .insert({
        document_id: documentId,
        granted_to_user: userId,
        granted_to_dept: departmentId,
        permission,
        granted_by: authUserId,
      })
      .select()
      .single();

    if (error) {
      console.error('[documents/share/POST]', error.message);
      return NextResponse.json({ success: false, error: '권한 부여 실패' }, { status: 500 });
    }

    await recordAuditEvent(supabase, {
      userId: authUserId,
      action: 'document.share',
      targetType: 'document',
      targetId: documentId,
      details: { shared_with_user: userId, shared_with_dept: departmentId, permission },
    });

    // 공유 대상(사용자 또는 부서 구성원)에게 알림. best-effort.
    try {
      let recipientIds: string[] = [];
      if (userId) {
        recipientIds = [userId];
      } else if (departmentId) {
        const { data: deptUsers } = await admin.from('users').select('id').eq('department_id', departmentId);
        recipientIds = (deptUsers ?? []).map((u) => u.id);
      }
      const [{ data: actor }, { data: doc }] = await Promise.all([
        admin.from('users').select('name').eq('id', authUserId).single(),
        admin.from('documents').select('title').eq('id', documentId).single(),
      ]);
      await createNotifications(admin, {
        recipientIds,
        actorId: authUserId,
        type: 'document_shared',
        title: `${actor?.name ?? '누군가'}님이 문서를 공유했습니다`,
        body: doc?.title ?? null,
        link: `/documents/${documentId}`,
      });
    } catch (e) {
      console.error('[documents/share] notify', e);
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, error: '문서 공유 중 오류' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // 변이 요청: 출처 + CSRF 토큰 + 활성 사용자 확인 (기존 권한 확인은 아래 그대로)
  const mutation = await withMutation(request);
  if (mutation.error) return mutation.error;
  try {
    const { id: documentId } = await params;
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

    const roleInfo = await getUserRoleInfo(supabase, authUserId);
    if (!roleInfo) return NextResponse.json({ success: false, error: '사용자 정보 없음' }, { status: 403 });

    const canShare = await canManageDocument(supabase, authUserId, roleInfo.role, documentId);
    if (!canShare) {
      return NextResponse.json({ success: false, error: '문서 공유 권한이 없습니다.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const permissionId = searchParams.get('permissionId');
    if (!permissionId) return NextResponse.json({ success: false, error: 'permissionId 필수' }, { status: 400 });

    // 권한 제거도 서버 권한으로만 — 사용자 세션의 직접 DELETE 는 058 에서 차단
    const { error } = await createAdminSupabaseClient()
      .from('document_permissions')
      .delete()
      .eq('id', permissionId)
      .eq('document_id', documentId);

    if (error) {
      console.error('[documents/share/DELETE]', error.message);
      return NextResponse.json({ success: false, error: '권한 제거 실패' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: '권한 제거 중 오류' }, { status: 500 });
  }
}
