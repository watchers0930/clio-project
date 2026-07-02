import { NextRequest, NextResponse } from 'next/server';
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

function ratio(part: number, whole: number) {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

export async function GET(request: NextRequest) {
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
    const requestedDays = Number(new URL(request.url).searchParams.get('days') ?? 30);
    const flowWindowDays = requestedDays === 7 ? 7 : 30;
    const flowWindowStartIso = new Date(Date.now() - flowWindowDays * 24 * 60 * 60 * 1000).toISOString();

    const [r1, r3, r4, r5, r6, r7, r8, r9, r10, r11, r12, r13] = await Promise.all([
      supabase.from('files').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('templates').select('*', { count: 'exact', head: true }),
      supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(10),
      supabase.from('files').select('id, name, department_id, created_at, uploaded_by'),
      supabase.from('departments').select('id, name'),
      // 문서 + 작성자 부서 (created_by → users.department_id)
      admin.from('documents').select('id, created_by, users:created_by(department_id)'),
      admin
        .from('audit_logs')
        .select('action, user_id, target_id, details, created_at')
        .gte('created_at', flowWindowStartIso),
      admin
        .from('documents')
        .select('id, status, created_at')
        .gte('created_at', flowWindowStartIso),
      admin
        .from('document_comments')
        .select('id, status, created_at')
        .gte('created_at', flowWindowStartIso),
      admin
        .from('document_permissions')
        .select('document_id'),
      admin
        .from('shared_links')
        .select('resource_id')
        .eq('resource_type', 'document'),
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
    const accessibleDocumentIdSet = new Set(accessibleDocList.map((doc) => doc.id));
    for (const doc of accessibleDocList) {
      const deptId = (doc.users as { department_id: string } | null)?.department_id;
      const deptName = deptId ? (deptMap.get(deptId) ?? '미지정') : '미지정';
      docDeptBreakdown[deptName] = (docDeptBreakdown[deptName] ?? 0) + 1;
    }

    const auditRows = (r9.data ?? []) as Array<{
      action: string;
      user_id: string | null;
      target_id?: string | null;
      details?: Record<string, unknown> | null;
      created_at: string;
    }>;
    const recentDocs = (r10.data ?? []) as Array<{ id: string; status: string; created_at: string }>;
    const recentComments = (r11.data ?? []) as Array<{ id: string; status: string; created_at: string }>;
    const documentPermissionRows = (r12.data ?? []) as Array<{ document_id: string }>;
    const sharedLinkRows = (r13.data ?? []) as Array<{ resource_id: string }>;

    const activeUsers = new Set(auditRows.map((row) => row.user_id).filter(Boolean));
    const searchUsers = new Set(auditRows.filter((row) => row.action === 'search').map((row) => row.user_id).filter(Boolean));
    const uploadCount = auditRows.filter((row) => row.action === 'file.upload').length;
    const createdDocCount = recentDocs.length;
    const completedDocCount = recentDocs.filter((row) => row.status === 'completed' || row.status === '완료').length;
    const reflectedCommentCount = recentComments.filter((row) => row.status === 'applied').length;
    const sharedDocumentIds = new Set<string>();
    documentPermissionRows.forEach((row) => {
      if (accessibleDocumentIdSet.has(row.document_id)) sharedDocumentIds.add(row.document_id);
    });
    sharedLinkRows.forEach((row) => {
      if (accessibleDocumentIdSet.has(row.resource_id)) sharedDocumentIds.add(row.resource_id);
    });

    const createdDocumentIds = new Set(
      auditRows
        .filter((row) => row.action === 'document.create' && row.target_id)
        .map((row) => row.target_id as string),
    );
    const sharedDocumentIdsInWindow = new Set(
      auditRows
        .filter((row) => row.action === 'document.share' || row.action === 'share.link.create')
        .map((row) => (row.target_id as string | undefined) ?? (typeof row.details?.resource_id === 'string' ? row.details.resource_id : null))
        .filter(Boolean) as string[],
    );
    const commentedDocumentIds = new Set(
      auditRows
        .filter((row) => row.action === 'document.comment.create' && row.target_id)
        .map((row) => row.target_id as string),
    );
    const reflectedDocumentIds = new Set(
      auditRows
        .filter((row) => row.action === 'document.comment.reflect' && row.target_id)
        .map((row) => row.target_id as string),
    );

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
      flow_window_days: flowWindowDays,
      flow_kpis: {
        upload_count_30d: uploadCount,
        search_usage_rate_30d: ratio(searchUsers.size, activeUsers.size),
        document_generation_completion_rate_30d: ratio(completedDocCount, createdDocCount),
        shared_document_count: sharedDocumentIds.size,
        comment_reflect_completion_rate_30d: ratio(reflectedCommentCount, recentComments.length),
      },
      document_flow_funnel_30d: {
        created: createdDocumentIds.size,
        shared: sharedDocumentIdsInWindow.size,
        commented: commentedDocumentIds.size,
        reflected: reflectedDocumentIds.size,
      },
      flow_diagnostics: {
        active_user_count: activeUsers.size,
        search_user_count: searchUsers.size,
        created_document_count: createdDocCount,
        completed_document_count: completedDocCount,
        total_comment_count: recentComments.length,
        reflected_comment_count: reflectedCommentCount,
      },
    };

    return NextResponse.json<ApiResponse<DashboardStats>>({ success: true, data: stats }, {
      headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=120' },
    });
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: '대시보드 통계 조회 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
