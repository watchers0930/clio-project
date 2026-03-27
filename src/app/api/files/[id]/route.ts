import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/lib/supabase/types';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import { canDeleteFile, getUserRoleInfo } from '@/lib/permissions';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json<ApiResponse>({ success: false, error: '데이터베이스가 설정되지 않았습니다.' }, { status: 503 });
    }

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) {
      return NextResponse.json<ApiResponse>({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('files')
      .select('*, departments:department_id(name), uploader:uploaded_by(name)')
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '파일을 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    const { departments: deptJoin, uploader: userJoin, ...fileData } = data as Record<string, unknown>;
    const dept = deptJoin as { name: string } | null;
    const user = userJoin as { name: string } | null;

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        ...fileData,
        department_name: dept?.name,
        uploader_name: user?.name,
      },
    });
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: '파일 상세 조회 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json<ApiResponse>({ success: false, error: '데이터베이스가 설정되지 않았습니다.' }, { status: 503 });
    }

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) {
      return NextResponse.json<ApiResponse>({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    // 권한 확인
    const roleInfo = await getUserRoleInfo(supabase, authUserId);
    const userRole = roleInfo?.role ?? 'user';
    const userDeptId = roleInfo?.department_id ?? null;

    const allowed = await canDeleteFile(supabase, authUserId, userRole, userDeptId, id);
    if (!allowed) {
      return NextResponse.json<ApiResponse>({ success: false, error: '파일 삭제 권한이 없습니다.' }, { status: 403 });
    }

    // 파일 정보 먼저 조회
    const { data: file, error: findErr } = await supabase
      .from('files')
      .select('id, storage_path, name')
      .eq('id', id)
      .single();

    if (findErr || !file) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '파일을 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    // Storage에서 파일 삭제
    if (file.storage_path) {
      await supabase.storage.from('files').remove([file.storage_path]);
    }

    // DB에서 삭제
    const { error: delErr } = await supabase.from('files').delete().eq('id', id);
    if (delErr) {
      console.error('[files/DELETE]', delErr.message);
      return NextResponse.json<ApiResponse>({ success: false, error: '파일 삭제에 실패했습니다.' }, { status: 500 });
    }

    // audit_logs 기록
    await supabase.from('audit_logs').insert({
      user_id: authUserId,
      action: 'file.delete',
      target_type: 'file',
      target_id: id,
      details: { file_name: file.name },
    }).catch(() => {});

    return NextResponse.json<ApiResponse>({ success: true, data: { id } });
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: '파일 삭제 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
