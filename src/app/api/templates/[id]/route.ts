import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, Template } from '@/lib/supabase/types';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { templates, departments } from '@/lib/mock-data';

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
        .from('templates')
        .select('*, departments:department_id(name)')
        .eq('id', id)
        .single();

      if (error || !data) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: '템플릿을 찾을 수 없습니다.' },
          { status: 404 },
        );
      }

      const { departments: deptJoin, ...tmplData } = data as Record<string, unknown>;
      const dept = deptJoin as { name: string } | null;

      return NextResponse.json<ApiResponse>({
        success: true,
        data: { ...tmplData, department_name: dept?.name },
      });
    }

    /* ── 폴백: mock 데이터 ── */
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
    const body = await request.json();

    /* ── Supabase 연동 ── */
    const supabase = await createServerSupabaseClient();
    if (supabase) {
      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body.name !== undefined) updateData.name = body.name;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.content !== undefined) updateData.content = body.content;
      if (body.is_active !== undefined) updateData.is_active = body.is_active;
      if (body.department_id !== undefined) updateData.department_id = body.department_id;

      const { data, error } = await supabase
        .from('templates')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json<ApiResponse>({ success: true, data });
    }

    /* ── 폴백: mock ── */
    const template = templates.find((t) => t.id === id);

    if (!template) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '템플릿을 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    /* ── Supabase 연동 ── */
    const supabase = await createServerSupabaseClient();
    if (supabase) {
      const { error } = await supabase
        .from('templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return NextResponse.json<ApiResponse>({ success: true, data: { id } });
    }

    /* ── 폴백 ── */
    return NextResponse.json<ApiResponse>({ success: true, data: { id } });
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: '템플릿 삭제 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
