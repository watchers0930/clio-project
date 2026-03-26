import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, FileRecord, PaginatedResponse } from '@/lib/supabase/types';
import { files, departments, users } from '@/lib/mock-data';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get('page') ?? 1));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') ?? 20)));
    const departmentId = searchParams.get('department_id');
    const status = searchParams.get('status');
    const q = searchParams.get('q')?.toLowerCase();

    let filtered = [...files];

    if (departmentId) {
      filtered = filtered.filter((f) => f.department_id === departmentId);
    }
    if (status) {
      filtered = filtered.filter((f) => f.status === status);
    }
    if (q) {
      filtered = filtered.filter(
        (f) => f.name.toLowerCase().includes(q) || f.original_name.toLowerCase().includes(q),
      );
    }

    // Sort by created_at descending
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total = filtered.length;
    const start = (page - 1) * limit;
    const paginated = filtered.slice(start, start + limit);

    return NextResponse.json<PaginatedResponse<FileRecord>>({
      success: true,
      data: paginated,
      total,
      page,
      limit,
    });
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: '파일 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, original_name, mime_type, size, department_id, user_id } = body;

    if (!name || !original_name || !mime_type || !department_id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '필수 필드가 누락되었습니다. (name, original_name, mime_type, department_id)' },
        { status: 400 },
      );
    }

    // Validate department exists
    if (!departments.find((d) => d.id === department_id)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '유효하지 않은 부서 ID입니다.' },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const newFile: FileRecord = {
      id: `file-${Date.now()}`,
      user_id: user_id ?? 'user-1',
      department_id,
      name,
      original_name,
      mime_type,
      size: size ?? 0,
      storage_path: `/files/${department_id}/${original_name}`,
      status: 'uploading',
      metadata: {},
      created_at: now,
      updated_at: now,
    };

    // In real implementation, file would be saved to Supabase Storage here
    return NextResponse.json<ApiResponse<FileRecord>>(
      { success: true, data: newFile },
      { status: 201 },
    );
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: '파일 업로드 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
