import { NextResponse } from 'next/server';
import type { ApiResponse, DashboardStats, AuditLog, DbAuditLog } from '@/lib/supabase/types';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import { filterAccessibleDocumentRows, filterAccessibleFileRows, getUserRoleInfo } from '@/lib/permissions';

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

    const roleInfo = await getUserRoleInfo(supabase, authUserId);
    if (!roleInfo) {
      return NextResponse.json<ApiResponse>({ success: false, error: '사용자 정보가 없습니다.' }, { status: 403 });
    }

    const admin = createAdminSupabaseClient();

    // 병렬 조회
    const [r1, r3, r4, r5, r6, r7, r8] = await Promise.all([
      supabase.from('files').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('templates').select('*', { count: 'exact', head: true }),
      supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(10),
      supabase.from('files').select('id, name, department_id, created_at, uploaded_by'),
      supabase.from('departments').select('id, name'),
      // 문서 + 작성자 부서 (created_by → users.department_id)
      admin.from('documents').select('id, created_by, users:created_by(department_id)'),
    ]);

    const deptList = (r7.data ?? []) as Array<{ id: string; name: string }>;
    const deptMap = new Map(deptList.map((d) => [d.id, d.name]));

    // 파일 타입별 분류 + 업로드 추이
    const fileList = (r6.data ?? []) as Array<{
      id: string;
      name: string;
      department_id: string | null;
      created_at: string;
      uploaded_by: string | null;
    }>;
    const accessibleFileList = await filterAccessibleFileRows(
      supabase,
      authUserId,
      roleInfo.role,
      roleInfo.department_id,
      fileList,
    );
    const fileTypeBreakdown: Record<string, number> = {};
    const uploadWeekMap: Record<string, number> = {};

    for (const f of accessibleFileList) {
      const ext = f.name.split('.').pop()?.toLowerCase() ?? 'unknown';
      fileTypeBreakdown[ext] = (fileTypeBreakdown[ext] ?? 0) + 1;
      const wk = toWeekKey(f.created_at);
      uploadWeekMap[wk] = (uploadWeekMap[wk] ?? 0) + 1;
    }

    // 부서별 파일 수
    const departmentBreakdown: Record<string, number> = {};
    for (const f of accessibleFileList) {
      const deptName = f.department_id ? (deptMap.get(f.department_id) ?? '미지정') : '미지정';
      departmentBreakdown[deptName] = (departmentBreakdown[deptName] ?? 0) + 1;
    }

    // 최근 8주 업로드 추이
    const weekKeys = lastNWeeks(8);
    const uploadTrend = weekKeys.map((wk) => ({
      week: wk,
      label: wk.split('-W')[1] + '주차',
      count: uploadWeekMap[wk] ?? 0,
    }));

    // 부서별 문서 생성량
    const docList = (r8.data ?? []) as Array<{ id: string; created_by: string; users: { department_id: string } | null }>;
    const accessibleDocList = await filterAccessibleDocumentRows(
      supabase,
      authUserId,
      roleInfo.role,
      roleInfo.department_id,
      docList,
    );
    const { data: derivedDocRows } = await admin
      .from('documents')
      .select('id, origin_document_id')
      .not('origin_document_id', 'is', null);
    const accessibleDerivedDocCount = ((derivedDocRows ?? []) as Array<{ id: string; origin_document_id: string | null }>)
      .filter((doc) => accessibleDocList.some((accessibleDoc) => accessibleDoc.id === doc.id))
      .length;
    const docDeptBreakdown: Record<string, number> = {};
    for (const doc of accessibleDocList) {
      const deptId = (doc.users as { department_id: string } | null)?.department_id;
      const deptName = deptId ? (deptMap.get(deptId) ?? '미지정') : '미지정';
      docDeptBreakdown[deptName] = (docDeptBreakdown[deptName] ?? 0) + 1;
    }

    const stats: DashboardStats = {
      total_files: accessibleFileList.length,
      total_documents: accessibleDocList.length,
      total_users: r3.count ?? 0,
      total_templates: r4.count ?? 0,
      role: roleInfo.role,
      department_name: roleInfo.department_id ? (deptMap.get(roleInfo.department_id) ?? '미지정') : '미지정',
      scope_label: roleInfo.role === 'admin'
        ? '관리자 권한 기준으로 전체 파일과 문서 현황을 보고 있습니다.'
        : roleInfo.department_id
          ? `본인 문서와 ${deptMap.get(roleInfo.department_id) ?? '소속 부서'} 기준 접근 가능한 파일·문서만 집계합니다.`
          : '본인 문서와 직접 공유된 파일·문서만 집계합니다.',
      scope_hint: roleInfo.role === 'admin'
        ? '대시보드 차트와 요약 카드가 조직 전체 범위를 반영합니다.'
        : `전사 전체 파일 ${r1.count ?? 0}건이 아니라 현재 접근 가능한 파일 ${accessibleFileList.length}건 기준으로 계산합니다.`,
      accessible_department_count: Object.keys(departmentBreakdown).length,
      recent_activity: ((r5.data ?? []) as DbAuditLog[]).map((log): AuditLog => ({
        id: log.id,
        user_id: log.user_id ?? '',
        action: log.action,
        target_type: log.target_type ?? undefined,
        target_id: log.target_id ?? undefined,
        details: log.details ?? {},
        created_at: log.created_at,
      })),
      file_type_breakdown: fileTypeBreakdown,
      department_breakdown: departmentBreakdown,
      upload_trend: uploadTrend,
      doc_dept_breakdown: docDeptBreakdown,
      derived_document_count: accessibleDerivedDocCount,
    };

    return NextResponse.json<ApiResponse<DashboardStats>>({ success: true, data: stats });
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: '대시보드 통계 조회 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
