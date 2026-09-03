import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';

/**
 * 부서·직원 목록 조회 (휴가원 등 연동 폼용)
 * GET /api/org/members
 * 반환: { departments: [{id,name}], members: [{id,name,department_id,hire_date,phone}] }
 */
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

    const admin = createAdminSupabaseClient();

    const { data: departments } = await admin
      .from('departments')
      .select('id, name')
      .order('name', { ascending: true });

    // hire_date·phone 컬럼(마이그레이션 015) 미적용 시 폴백해서 이름 목록은 유지
    let members: unknown[] = [];
    const withCols = await admin
      .from('users')
      .select('id, name, department_id, hire_date, phone')
      .order('name', { ascending: true });
    if (withCols.error) {
      const basic = await admin
        .from('users')
        .select('id, name, department_id')
        .order('name', { ascending: true });
      members = (basic.data ?? []).map((m) => ({ ...m, hire_date: null, phone: null }));
    } else {
      members = withCols.data ?? [];
    }

    return NextResponse.json(
      { success: true, departments: departments ?? [], members },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch (err) {
    console.error('[org/members/GET]', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ success: false, error: '직원 목록 조회 실패' }, { status: 500 });
  }
}
