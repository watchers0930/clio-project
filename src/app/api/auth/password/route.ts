import { NextRequest, NextResponse } from 'next/server';
import { withMutation } from '@/lib/http/mutation-guard';
import { parsePasswordChange } from '@/lib/auth/password-change-rules';
import { verifyCurrentPassword } from '@/lib/auth/password-change';

/**
 * PUT /api/auth/password — 본인 비밀번호 변경
 * body: { currentPassword, newPassword }
 * 현재 비밀번호를 다시 확인한 뒤에만 바꾸고, 바꾼 뒤에는 다른 기기의 세션을 모두 끝낸다(지금 세션은 유지).
 */
export async function PUT(request: NextRequest) {
  // 변이 요청: 출처 + CSRF 토큰 + 활성 사용자 확인
  const mutation = await withMutation(request);
  if (mutation.error) return mutation.error;
  try {
    const input = parsePasswordChange(await request.json().catch(() => null));
    if (!input.ok) return NextResponse.json({ success: false, error: input.error }, { status: 400 });

    const { data: { user }, error: userErr } = await mutation.supabase.auth.getUser();
    if (userErr || !user?.email) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

    const check = await verifyCurrentPassword(user.email, input.currentPassword);
    if (check === 'wrong') return NextResponse.json({ success: false, error: '현재 비밀번호가 올바르지 않습니다.' }, { status: 400 });
    if (check === 'error') return NextResponse.json({ success: false, error: '비밀번호 확인 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 503 });

    // current_password: Supabase Auth 설정 'Require current password when updating' 이 켜져 있으면 인증 서버가 직접 확인한다
    // (앱 API 를 거치지 않고 Supabase Auth 를 직접 부르는 경로까지 막힘). 위 사전 확인은 틀린 비밀번호를 정확히 안내하기 위함
    const { error } = await mutation.supabase.auth.updateUser({ password: input.newPassword, current_password: input.currentPassword });
    if (error) {
      console.error('[password/PUT] update:', error.code ?? error.message);
      const weak = error.code === 'weak_password' || error.code === 'same_password';
      return NextResponse.json(
        { success: false, error: weak ? '사용할 수 없는 비밀번호입니다. 다른 비밀번호를 입력해 주세요.' : '비밀번호 변경에 실패했습니다.' },
        { status: weak ? 400 : 500 },
      );
    }

    // 비밀번호가 새어 바꾸는 경우를 대비해 다른 기기 세션은 끝낸다 — 실패해도 변경 자체는 완료이므로 기록만
    const { error: othersErr } = await mutation.supabase.auth.signOut({ scope: 'others' });
    if (othersErr) console.error('[password/PUT] sign out others:', othersErr.message);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[password/PUT]', err);
    return NextResponse.json({ success: false, error: '비밀번호 변경 중 오류' }, { status: 500 });
  }
}
