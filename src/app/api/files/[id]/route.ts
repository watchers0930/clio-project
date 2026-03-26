import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, FileRecord } from '@/lib/supabase/types';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { files, users, departments } from '@/lib/mock-data';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    /* ── Supabase 연동 ── */
    const supabase = await createServerSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase
        .from('files')
        .select('*, departments:department_id(name), users:user_id(name)')
        .eq('id', id)
        .single();

      if (error || !data) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: '파일을 찾을 수 없습니다.' },
          { status: 404 },
        );
      }

      // departments, users 조인 결과를 평탄화
      const { departments: deptJoin, users: userJoin, ...fileData } = data as Record<string, unknown>;
      const dept = deptJoin as { name: string } | null;
      const user = userJoin as { name: string } | null;

      return NextResponse.json<ApiResponse>({
        success: true,
        data: {
          ...fileData,
          department_name: dept?.name,
          uploader_name: user?.name,
        },
      });
    }

    /* ── 폴백: mock 데이터 ── */
    const file = files.find((f) => f.id === id);

    if (!file) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '파일을 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    const uploader = users.find((u) => u.id === file.user_id);
    const dept = departments.find((d) => d.id === file.department_id);

    return NextResponse.json<ApiResponse<FileRecord & { uploader_name?: string; department_name?: string }>>({
      success: true,
      data: {
        ...file,
        uploader_name: uploader?.name,
        department_name: dept?.name,
      },
    });
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: '파일 상세 조회 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    /* ── Supabase 연동 ── */
    const supabase = await createServerSupabaseClient();
    if (supabase) {
      // 파일 정보 먼저 조회 (Storage 경로 + audit 용)
      const { data: file, error: findErr } = await supabase
        .from('files')
        .select('id, storage_path, original_name')
        .eq('id', id)
        .single();

      if (findErr || !file) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: '파일을 찾을 수 없습니다.' },
          { status: 404 },
        );
      }

      // Storage에서 파일 삭제
      if (file.storage_path) {
        await supabase.storage.from('files').remove([file.storage_path]);
      }

      // files 테이블에서 삭제
      const { error: delErr } = await supabase
        .from('files')
        .delete()
        .eq('id', id);

      if (delErr) throw delErr;

      // audit_logs 기록 (실패해도 무시)
      try {
        await supabase.from('audit_logs').insert({
          user_id: 'user-1',
          action: 'file.delete',
          target_type: 'file',
          target_id: id,
          details: { file_name: file.original_name },
        } as Record<string, unknown>);
      } catch { /* audit 실패는 무시 */ }

      return NextResponse.json<ApiResponse>({ success: true, data: { id } });
    }

    /* ── 폴백: mock ── */
    const fileIndex = files.findIndex((f) => f.id === id);

    if (fileIndex === -1) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '파일을 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    return NextResponse.json<ApiResponse>({ success: true, data: { id } });
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: '파일 삭제 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
