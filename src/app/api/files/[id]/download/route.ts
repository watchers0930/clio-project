import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import { canAccessFile, getUserRoleInfo } from '@/lib/permissions';

/**
 * GET /api/files/[id]/download — Signed URL 발급 (60초 유효)
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ error: 'DB 미설정' }, { status: 503 });

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

    const admin = createAdminSupabaseClient();

    // 파일 정보 조회
    const { data: file, error } = await admin
      .from('files')
      .select('id, name, storage_path, uploaded_by')
      .eq('id', id)
      .single();

    if (error || !file || !file.storage_path) {
      return NextResponse.json({ error: '파일을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 권한 체크: canAccessFile (admin/소유자/같은부서/file_permissions)
    const roleInfo = await getUserRoleInfo(supabase, authUserId);
    const hasAccess = await canAccessFile(
      supabase,
      authUserId,
      roleInfo?.role ?? 'user',
      roleInfo?.department_id ?? null,
      id,
    );

    if (!hasAccess) {
      return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    // Signed URL 발급
    const { data: signed, error: signError } = await admin.storage
      .from('files')
      .createSignedUrl(file.storage_path, 60, {
        download: file.name,
      });

    if (signError || !signed?.signedUrl) {
      console.error('[download] signed URL error:', signError?.message);
      return NextResponse.json({ error: '다운로드 URL 생성에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, url: signed.signedUrl, name: file.name });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '알 수 없는 오류';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
