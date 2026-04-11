import { NextResponse } from 'next/server';
import type { ApiResponse, DashboardStats } from '@/lib/supabase/types';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';

/** ISO 날짜 → YYYY-WW (주차) */
function toWeekKey(dateStr: string): string {
  const d = new Date(dateStr);
  const start = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** 최근 N주 키 배열 생성 */
function lastNWeeks(n: number): string[] {
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i * 7);
    keys.push(toWeekKey(d.toISOString()));
  }
  // 중복 제거 유지
  return [...new Set(keys)];
}

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json<ApiResponse>({ success: false, error: '데이터베이스가 설정되지 않았습니다.' }, { status: 503 });
    }

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) {
      return NextResponse.json<ApiResponse>({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const admin = createAdminSupabaseClient();

    // 병렬 조회
    const [r1, r2, r3, r4, r5, r6, r7, r8, r9] = await Promise.all([
      supabase.from('files').select('*', { count: 'exact', head: true }),
      supabase.from('documents').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('templates').select('*', { count: 'exact', head: true }),
      supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(10),
      supabase.from('files').select('id, name, department_id, created_at'),
      supabase.from('departments').select('id, name'),
      // 결재 전체 현황 (admin으로 조회)
      admin.from('approvals').select('status'),
      // 문서 + 작성자 부서 (created_by → users.department_id)
      admin.from('documents').select('id, created_by, users:created_by(department_id)'),
    ]);

    const deptList = (r7.data ?? []) as Array<{ id: string; name: string }>;
    const deptMap = new Map(deptList.map((d) => [d.id, d.name]));

    // 파일 타입별 분류 + 업로드 추이
    const fileList = (r6.data ?? []) as Array<{ id: string; name: string; department_id: string; created_at: string }>;
    const fileTypeBreakdown: Record<string, number> = {};
    const uploadWeekMap: Record<string, number> = {};

    for (const f of fileList) {
      const ext = f.name.split('.').pop()?.toLowerCase() ?? 'unknown';
      fileTypeBreakdown[ext] = (fileTypeBreakdown[ext] ?? 0) + 1;
      const wk = toWeekKey(f.created_at);
      uploadWeekMap[wk] = (uploadWeekMap[wk] ?? 0) + 1;
    }

    // 부서별 파일 수
    const departmentBreakdown: Record<string, number> = {};
    for (const f of fileList) {
      const deptName = deptMap.get(f.department_id) ?? '미지정';
      departmentBreakdown[deptName] = (departmentBreakdown[deptName] ?? 0) + 1;
    }

    // 최근 8주 업로드 추이
    const weekKeys = lastNWeeks(8);
    const uploadTrend = weekKeys.map((wk) => ({
      week: wk,
      label: wk.split('-W')[1] + '주차',
      count: uploadWeekMap[wk] ?? 0,
    }));

    // 결재 현황
    const approvalList = (r8.data ?? []) as Array<{ status: string }>;
    const approvalStats = {
      pending: approvalList.filter((a) => a.status === 'pending').length,
      approved: approvalList.filter((a) => a.status === 'approved').length,
      rejected: approvalList.filter((a) => a.status === 'rejected').length,
      total: approvalList.length,
    };

    // 부서별 문서 생성량
    const docList = (r9.data ?? []) as Array<{ id: string; created_by: string; users: { department_id: string } | null }>;
    const docDeptBreakdown: Record<string, number> = {};
    for (const doc of docList) {
      const deptId = (doc.users as { department_id: string } | null)?.department_id;
      const deptName = deptId ? (deptMap.get(deptId) ?? '미지정') : '미지정';
      docDeptBreakdown[deptName] = (docDeptBreakdown[deptName] ?? 0) + 1;
    }

    // 결재 대기 건수 (내 건)
    let pendingApprovals = 0;
    try {
      const { count } = await admin
        .from('approvals')
        .select('*', { count: 'exact', head: true })
        .eq('approver_id', authUserId)
        .eq('status', 'pending');
      pendingApprovals = count ?? 0;
    } catch {}

    const stats: DashboardStats = {
      total_files: r1.count ?? 0,
      total_documents: r2.count ?? 0,
      total_users: r3.count ?? 0,
      total_templates: r4.count ?? 0,
      pending_approvals: pendingApprovals,
      recent_activity: r5.data ?? [],
      file_type_breakdown: fileTypeBreakdown,
      department_breakdown: departmentBreakdown,
      upload_trend: uploadTrend,
      approval_stats: approvalStats,
      doc_dept_breakdown: docDeptBreakdown,
    };

    return NextResponse.json<ApiResponse<DashboardStats>>({ success: true, data: stats });
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: '대시보드 통계 조회 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
