import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import { canAccessDocument, canManageDocument, getUserRoleInfo } from '@/lib/permissions';

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

    const { data, error } = await supabase
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

    const { userId, departmentId, permission } = await request.json();
    if (!userId && !departmentId) {
      return NextResponse.json({ success: false, error: '공유 대상이 필요합니다.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('document_permissions')
      .insert({
        document_id: documentId,
        granted_to_user: userId ?? null,
        granted_to_dept: departmentId ?? null,
        permission: permission ?? 'read',
        granted_by: authUserId,
      })
      .select()
      .single();

    if (error) {
      console.error('[documents/share/POST]', error.message);
      return NextResponse.json({ success: false, error: '권한 부여 실패' }, { status: 500 });
    }

    await supabase.from('audit_logs').insert({
      user_id: authUserId,
      action: 'document.share',
      target_type: 'document',
      target_id: documentId,
      details: { shared_with_user: userId, shared_with_dept: departmentId, permission: permission ?? 'read' },
    }).then(() => {}, () => {});

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, error: '문서 공유 중 오류' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
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

    const canShare = await canManageDocument(supabase, authUserId, roleInfo.role, documentId);
    if (!canShare) {
      return NextResponse.json({ success: false, error: '문서 공유 권한이 없습니다.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const permissionId = searchParams.get('permissionId');
    if (!permissionId) return NextResponse.json({ success: false, error: 'permissionId 필수' }, { status: 400 });

    const { error } = await supabase
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
