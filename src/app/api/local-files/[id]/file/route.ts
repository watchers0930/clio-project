import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';

/**
 * GET /api/local-files/[id]/file
 * 로컬 인덱싱 파일의 원본(Storage 사본) Signed URL 발급 → 웹 뷰어로 열기용.
 * 원본이 저장돼 있지 않으면(구 인덱싱 데이터) 404 반환 → 클라이언트가 텍스트 미리보기로 폴백.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'DB 미설정' }, { status: 503 });
  const userId = await getAuthUserId(supabase);
  if (!userId) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const { id } = await params;

  // 소유자 확인 + 파일 메타
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: fileRow, error: fileErr } = await (supabase as any)
    .from('local_file_index')
    .select('file_name, file_hash')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (fileErr || !fileRow?.file_hash) {
    return NextResponse.json({ error: '파일 없음' }, { status: 404 });
  }

  const ext = String(fileRow.file_name ?? '').split('.').pop()?.toLowerCase() ?? '';
  const storagePath = `local-originals/${userId}/${fileRow.file_hash}.${ext}`;

  const admin = createAdminSupabaseClient();
  const { data: signed, error: signError } = await admin.storage
    .from('files')
    .createSignedUrl(storagePath, 60);

  if (signError || !signed?.signedUrl) {
    // 원본 미저장(구 데이터) → 재동기화 필요
    return NextResponse.json({ error: '원본이 저장되어 있지 않습니다. 로컬 폴더를 다시 동기화해 주세요.', code: 'no_original' }, { status: 404 });
  }

  return NextResponse.json({ success: true, url: signed.signedUrl, name: fileRow.file_name });
}
