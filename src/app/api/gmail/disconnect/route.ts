import { withMutation } from '@/lib/http/mutation-guard';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';

// DELETE /api/gmail/disconnect — Gmail 연결 해제
export async function DELETE(request: NextRequest) {
  // 변이 요청: 출처 + CSRF 토큰 + 활성 사용자 확인 (기존 권한 확인은 아래 그대로)
  const mutation = await withMutation(request);
  if (mutation.error) return mutation.error;
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: '서버 오류' }, { status: 500 });

  const userId = await getAuthUserId(supabase);
  if (!userId) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const admin = createAdminSupabaseClient();

  // Gmail 소스 파일 청크 삭제 (file_chunks는 file_id CASCADE로 자동 삭제)
  await admin.from('files').delete().eq('uploaded_by', userId).eq('source', 'gmail');

  // 연결 정보 삭제
  await admin.from('user_google_connections').delete().eq('user_id', userId);

  return NextResponse.json({ success: true });
}
