import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/lib/supabase/types';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json<ApiResponse>({ success: false, error: '데이터베이스가 설정되지 않았습니다.' }, { status: 503 });
    }

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) {
      return NextResponse.json<ApiResponse>({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

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

    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json<ApiResponse>({ success: false, error: '데이터베이스가 설정되지 않았습니다.' }, { status: 503 });
    }

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) {
      return NextResponse.json<ApiResponse>({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.content !== undefined) updateData.content = body.content;
    if (body.department_id !== undefined) updateData.department_id = body.department_id;

    const { data, error } = await supabase
      .from('templates')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[templates/[id]/PUT]', error.message);
      return NextResponse.json<ApiResponse>({ success: false, error: '템플릿 수정에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json<ApiResponse>({ success: true, data });
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: '템플릿 수정 중 오류가 발생했습니다.' },
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

    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json<ApiResponse>({ success: false, error: '데이터베이스가 설정되지 않았습니다.' }, { status: 503 });
    }

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) {
      return NextResponse.json<ApiResponse>({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    void request; // lint

    const { error } = await supabase.from('templates').delete().eq('id', id);
    if (error) {
      console.error('[templates/[id]/DELETE]', error.message);
      return NextResponse.json<ApiResponse>({ success: false, error: '템플릿 삭제에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json<ApiResponse>({ success: true, data: { id } });
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: '템플릿 삭제 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
