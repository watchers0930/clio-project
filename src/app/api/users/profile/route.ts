import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';

/**
 * 로그인 사용자 본인 프로필 (재직증명서 등 자동입력용)
 * GET /api/users/profile
 * 반환: { success, data: { name, resident_no, address, department, position, hire_date, phone } }
 */
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

    const admin = createAdminSupabaseClient();
    const { data } = await admin
      .from('users')
      .select('name, resident_no, address, position, hire_date, phone, departments:department_id(name)')
      .eq('id', authUserId)
      .single();

    const dept = (data as { departments?: { name?: string } | null } | null)?.departments;
    const p = (data ?? {}) as Record<string, unknown>;

    return NextResponse.json(
      {
        success: true,
        data: {
          name: (p.name as string) ?? '',
          resident_no: (p.resident_no as string) ?? '',
          address: (p.address as string) ?? '',
          department: dept?.name ?? '',
          position: (p.position as string) ?? '',
          hire_date: (p.hire_date as string) ?? '',
          phone: (p.phone as string) ?? '',
        },
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch (err) {
    console.error('[users/profile/GET]', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ success: false, error: '프로필 조회 실패' }, { status: 500 });
  }
}
