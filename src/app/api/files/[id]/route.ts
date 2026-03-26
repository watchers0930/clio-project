import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, FileRecord } from '@/lib/supabase/types';
import { files, users, departments } from '@/lib/mock-data';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
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
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const fileIndex = files.findIndex((f) => f.id === id);

    if (fileIndex === -1) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '파일을 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    // In real implementation, also delete from Supabase Storage
    return NextResponse.json<ApiResponse>({ success: true, data: { id } });
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: '파일 삭제 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
