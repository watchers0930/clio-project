import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';

/**
 * PUT /api/auth/password — 본인 비밀번호 변경
 * body: { currentPassword, newPassword }
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

    const { newPassword } = await request.json();

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ success: false, error: '새 비밀번호는 6자 이상이어야 합니다.' }, { status: 400 });
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      return NextResponse.json({ success: false, error: '비밀번호 변경 실패: ' + error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: '비밀번호 변경 중 오류' }, { status: 500 });
  }
}
