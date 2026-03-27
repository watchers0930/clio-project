import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

    const admin = createAdminSupabaseClient();

    // 파일 정보 조회
    const { data: file, error } = await admin
      .from('files')
      .select('id, name, storage_path, uploaded_by, department_id')
      .eq('id', id)
      .single();

    if (error || !file) {
      return NextResponse.json({ success: false, error: '파일을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (!file.storage_path) {
      return NextResponse.json({ success: false, error: '다운로드할 수 있는 파일이 아닙니다.' }, { status: 400 });
    }

    // 접근 권한 확인: 소유자 / 같은 부서 / 공유받은 사용자
    const isOwner = file.uploaded_by === authUserId;
    if (!isOwner) {
      const { data: currentUser } = await admin.from('users').select('department_id').eq('id', authUserId).single();
      const sameDept = currentUser?.department_id && currentUser.department_id === file.department_id;

      if (!sameDept) {
        const { data: share } = await admin
          .from('file_shares')
          .select('id')
          .eq('file_id', id)
          .eq('shared_with', authUserId)
          .gt('expires_at', new Date().toISOString())
          .limit(1)
          .single();

        if (!share) {
          return NextResponse.json({ success: false, error: '이 파일에 대한 접근 권한이 없습니다.' }, { status: 403 });
        }
      }
    }

    // Signed URL 생성 (60초 유효)
    const { data: signedData, error: signedError } = await admin.storage
      .from('files')
      .createSignedUrl(file.storage_path, 60);

    if (signedError || !signedData?.signedUrl) {
      console.error('[download] signedUrl:', signedError?.message);
      return NextResponse.json({ success: false, error: '다운로드 URL 생성 실패' }, { status: 500 });
    }

    return NextResponse.json({ success: true, url: signedData.signedUrl, fileName: file.name });
  } catch {
    return NextResponse.json({ success: false, error: '다운로드 처리 중 오류' }, { status: 500 });
  }
}
