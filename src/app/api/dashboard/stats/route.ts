import { NextResponse } from 'next/server';
import type { ApiResponse, DashboardStats } from '@/lib/supabase/types';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { files, documents, users, templates, auditLogs, departments } from '@/lib/mock-data';

export async function GET() {
  try {
    /* ── Supabase 연동 ── */
    const supabase = await createServerSupabaseClient();
    if (supabase) {
      // 카운트 쿼리 병렬 실행
      const filesRes = supabase.from('files').select('*', { count: 'exact', head: true });
      const docsRes = supabase.from('documents').select('*', { count: 'exact', head: true });
      const usersRes = supabase.from('users').select('*', { count: 'exact', head: true });
      const templatesRes = supabase.from('templates').select('*', { count: 'exact', head: true });
      const logsRes = supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(10);
      const allFilesRes = supabase.from('files').select('*');
      const deptsRes = supabase.from('departments').select('*');

      const [r1, r2, r3, r4, r5, r6, r7] = await Promise.all([
        filesRes, docsRes, usersRes, templatesRes, logsRes, allFilesRes, deptsRes,
      ]);

      const filesCount = r1.count;
      const docsCount = r2.count;
      const usersCount = r3.count;
      const templatesCount = r4.count;
      const recentLogs = r5.data;
      const allFiles = r6.data;
      const depts = r7.data;

      const deptList = (depts ?? []) as Array<{ id: string; name: string }>;
      const deptMap = new Map(deptList.map((d) => [d.id, d.name]));

      // 파일 타입별 분류
      const fileList = (allFiles ?? []) as Array<{ id: string; name: string; department_id: string; created_at: string }>;
      const fileTypeBreakdown: Record<string, number> = {};
      for (const f of fileList) {
        const ext = f.name.split('.').pop()?.toLowerCase() ?? 'unknown';
        fileTypeBreakdown[ext] = (fileTypeBreakdown[ext] ?? 0) + 1;
      }

      // 부서별 파일 수
      const departmentBreakdown: Record<string, number> = {};
      for (const f of fileList) {
        const deptName = deptMap.get(f.department_id) ?? '미지정';
        departmentBreakdown[deptName] = (departmentBreakdown[deptName] ?? 0) + 1;
      }

      const stats: DashboardStats = {
        total_files: filesCount ?? 0,
        total_documents: docsCount ?? 0,
        total_users: usersCount ?? 0,
        total_templates: templatesCount ?? 0,
        recent_activity: recentLogs ?? [],
        file_type_breakdown: fileTypeBreakdown,
        department_breakdown: departmentBreakdown,
      };

      return NextResponse.json<ApiResponse<DashboardStats>>({ success: true, data: stats });
    }

    /* ── 폴백: mock 데이터 ── */
    const fileTypeBreakdown: Record<string, number> = {};
    for (const file of files) {
      const fileName = file.original_name ?? file.name;
      const ext = fileName.split('.').pop()?.toLowerCase() ?? 'unknown';
      fileTypeBreakdown[ext] = (fileTypeBreakdown[ext] ?? 0) + 1;
    }

    const departmentBreakdown: Record<string, number> = {};
    for (const file of files) {
      const dept = departments.find((d) => d.id === file.department_id);
      const deptName = dept?.name ?? '미지정';
      departmentBreakdown[deptName] = (departmentBreakdown[deptName] ?? 0) + 1;
    }

    const recentActivity = [...auditLogs]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10);

    const stats: DashboardStats = {
      total_files: files.length,
      total_documents: documents.length,
      total_users: users.length,
      total_templates: templates.filter((t) => t.is_active).length,
      recent_activity: recentActivity,
      file_type_breakdown: fileTypeBreakdown,
      department_breakdown: departmentBreakdown,
    };

    return NextResponse.json<ApiResponse<DashboardStats>>({ success: true, data: stats });
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: '대시보드 통계 조회 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
