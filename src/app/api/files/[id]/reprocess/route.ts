import { NextRequest, NextResponse, after } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: fileId } = await params;
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ error: 'DB 미설정' }, { status: 503 });

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

    // 파일 소유자 확인 (본인 파일만 재처리 허용)
    const admin = createAdminSupabaseClient();
    const { data: file, error } = await admin
      .from('files')
      .select('id, name, uploaded_by, storage_path')
      .eq('id', fileId)
      .single();

    if (error || !file) return NextResponse.json({ error: '파일을 찾을 수 없습니다.' }, { status: 404 });
    if (file.uploaded_by !== authUserId) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    if (!file.storage_path) return NextResponse.json({ error: '파일 데이터가 없습니다.' }, { status: 400 });

    // 기존 청크 삭제 후 status 초기화
    await admin.from('file_chunks').delete().eq('file_id', fileId);
    await admin.from('files').update({ status: 'processing' }).eq('id', fileId);

    // 응답 후 처리 (after로 Vercel 함수 종료 후에도 실행 보장)
    const baseUrl = request.nextUrl.origin;
    const secret = process.env.INTERNAL_API_SECRET || '';
    after(async () => {
      try {
        await fetch(`${baseUrl}/api/files/process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': secret },
          body: JSON.stringify({ fileId }),
        });
      } catch (e) {
        console.error('[reprocess] process call failed:', e);
      }
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[reprocess] error:', err);
    return NextResponse.json({ error: '재처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
