import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, Template, PaginatedResponse } from '@/lib/supabase/types';
import { templates, departments } from '@/lib/mock-data';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get('page') ?? 1));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') ?? 20)));
    const departmentId = searchParams.get('department_id');
    const type = searchParams.get('type');

    let filtered = templates.filter((t) => t.is_active);

    if (departmentId) {
      filtered = filtered.filter((t) => t.department_id === departmentId);
    }
    if (type) {
      filtered = filtered.filter((t) => t.type === type);
    }

    const total = filtered.length;
    const start = (page - 1) * limit;
    const paginated = filtered.slice(start, start + limit);

    return NextResponse.json<PaginatedResponse<Template>>({
      success: true,
      data: paginated,
      total,
      page,
      limit,
    });
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: '템플릿 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, department_id, type, content } = body;

    if (!name || !department_id || !type) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '필수 필드가 누락되었습니다. (name, department_id, type)' },
        { status: 400 },
      );
    }

    if (!departments.find((d) => d.id === department_id)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '유효하지 않은 부서 ID입니다.' },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const newTemplate: Template = {
      id: `tmpl-${Date.now()}`,
      name,
      description: description ?? '',
      department_id,
      type,
      content: content ?? { placeholders: [], structure: {} },
      is_active: true,
      created_at: now,
      updated_at: now,
    };

    return NextResponse.json<ApiResponse<Template>>(
      { success: true, data: newTemplate },
      { status: 201 },
    );
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: '템플릿 생성 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
