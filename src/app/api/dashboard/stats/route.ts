import { NextResponse } from 'next/server';
import type { ApiResponse, DashboardStats } from '@/lib/supabase/types';
import { files, documents, users, templates, auditLogs, departments } from '@/lib/mock-data';

export async function GET() {
  try {
    // File type breakdown
    const fileTypeBreakdown: Record<string, number> = {};
    for (const file of files) {
      const ext = file.original_name.split('.').pop()?.toLowerCase() ?? 'unknown';
      fileTypeBreakdown[ext] = (fileTypeBreakdown[ext] ?? 0) + 1;
    }

    // Department breakdown (file count per department)
    const departmentBreakdown: Record<string, number> = {};
    for (const file of files) {
      const dept = departments.find((d) => d.id === file.department_id);
      const deptName = dept?.name ?? '미지정';
      departmentBreakdown[deptName] = (departmentBreakdown[deptName] ?? 0) + 1;
    }

    // Recent activity — latest 10 logs
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
