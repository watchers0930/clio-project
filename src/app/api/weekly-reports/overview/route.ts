import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import { canViewAllWeeklyReports } from '@/lib/permissions';

/**
 * CEO/관리자 전용 — 전사 직원 주간업무 조회.
 * 주간업무 문서: title ~ '주간업무' + template_id IS NULL(빌트인).
 * 필터: employeeId(작성자)·departmentId(부서)·dateFrom/dateTo(작성일).
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });

    const admin = createAdminSupabaseClient();
    // 권한 판별용 본인 프로필은 admin으로 조회(세션 RLS/컬럼 제약 영향 배제, 본인 id라 안전)
    const { data: me, error: meErr } = await admin.from('users').select('role, rank_level').eq('id', authUserId).single();
    if (meErr) console.error('[weekly-reports/overview] me 조회 실패:', meErr.message);
    const myRole = (me as { role?: string } | null)?.role ?? '';
    const myRank = (me as { rank_level?: number | null } | null)?.rank_level;
    if (!me || !canViewAllWeeklyReports(myRole, myRank)) {
      console.error('[weekly-reports/overview] 권한 거부:', { authUserId, myRole, myRank });
      return NextResponse.json({ success: false, error: '대표이사 또는 관리자만 접근할 수 있습니다.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const departmentId = searchParams.get('departmentId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    let query = admin
      .from('documents')
      .select('id, title, content, status, created_at, created_by, author:created_by(name, rank_title, department_id, departments:department_id(name))')
      .ilike('title', '%주간%업무%')
      .is('template_id', null)
      .order('created_at', { ascending: false });

    if (employeeId) query = query.eq('created_by', employeeId);
    if (dateFrom) query = query.gte('created_at', dateFrom);
    if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59`);

    const { data: rows, error } = await query;
    if (error) {
      console.error('[weekly-reports/overview]', error.message);
      return NextResponse.json({ success: false, error: '주간업무 조회에 실패했습니다.' }, { status: 500 });
    }

    type AuthorJoin = { name?: string; rank_title?: string; department_id?: string | null; departments?: { name?: string } | null } | null;
    let reports = ((rows ?? []) as Array<Record<string, unknown>>).map((r) => {
      const author = r.author as AuthorJoin;
      return {
        id: r.id as string,
        title: r.title as string,
        content: (r.content as string) ?? '',
        status: r.status as string,
        createdAt: r.created_at as string,
        authorId: r.created_by as string,
        authorName: author?.name ?? '(알 수 없음)',
        authorRank: author?.rank_title ?? '',
        authorDeptId: author?.department_id ?? null,
        authorDept: author?.departments?.name ?? '미배정',
      };
    });

    if (departmentId) reports = reports.filter((x) => x.authorDeptId === departmentId);

    return NextResponse.json({ success: true, reports }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (err) {
    console.error('[weekly-reports/overview]', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ success: false, error: '주간업무 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
