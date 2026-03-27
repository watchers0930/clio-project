import { NextResponse } from 'next/server';
import type { ApiResponse, DashboardStats } from '@/lib/supabase/types';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';

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

    // 카운트 + 파일목록 + 부서목록 + 최근로그 병렬 조회
    const [r1, r2, r3, r4, r5, r6, r7] = await Promise.all([
      supabase.from('files').select('*', { count: 'exact', head: true }),
      supabase.from('documents').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('templates').select('*', { count: 'exact', head: true }),
      supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(10),
      supabase.from('files').select('id, name, department_id, created_at'),
      supabase.from('departments').select('id, name'),
    ]);

    const deptList = (r7.data ?? []) as Array<{ id: string; name: string }>;
    const deptMap = new Map(deptList.map((d) => [d.id, d.name]));

    // 파일 타입별 분류
    const fileList = (r6.data ?? []) as Array<{ id: string; name: string; department_id: string; created_at: string }>;
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
      total_files: r1.count ?? 0,
      total_documents: r2.count ?? 0,
      total_users: r3.count ?? 0,
      total_templates: r4.count ?? 0,
      recent_activity: r5.data ?? [],
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
