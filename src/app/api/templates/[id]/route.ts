import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, Template } from '@/lib/supabase/types';
import { templates, departments } from '@/lib/mock-data';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const template = templates.find((t) => t.id === id);

    if (!template) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '템플릿을 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    const dept = departments.find((d) => d.id === template.department_id);

    return NextResponse.json<ApiResponse<Template & { department_name?: string }>>({
      success: true,
      data: { ...template, department_name: dept?.name },
    });
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: '템플릿 상세 조회 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const template = templates.find((t) => t.id === id);

    if (!template) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '템플릿을 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    const body = await request.json();
    const updated: Template = {
      ...template,
      name: body.name ?? template.name,
      description: body.description ?? template.description,
      content: body.content ?? template.content,
      is_active: body.is_active ?? template.is_active,
      updated_at: new Date().toISOString(),
    };

    return NextResponse.json<ApiResponse<Template>>({ success: true, data: updated });
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: '템플릿 수정 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
