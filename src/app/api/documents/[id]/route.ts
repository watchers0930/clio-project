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
      .from('documents')
      .select('*, templates:template_id(name)')
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '문서를 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    const { templates: tmplJoin, ...docData } = data as Record<string, unknown>;
    const tmpl = tmplJoin as { name: string } | null;

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { ...docData, template_name: tmpl?.name },
    });
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: '문서 상세 조회 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { content, status, title } = body as { content?: string; status?: string; title?: string };

    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'DB 미설정' }, { status: 503 });
    }

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) {
      return NextResponse.json<ApiResponse>({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const updates: Record<string, unknown> = {};
    if (content !== undefined) updates.content = content;
    if (status !== undefined) updates.status = status;
    if (title !== undefined) updates.title = title;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: '수정할 내용이 없습니다.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('documents')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[documents/[id]/PATCH]', error.message);
      return NextResponse.json<ApiResponse>({ success: false, error: '문서 수정에 실패했습니다.' }, { status: 500 });
    }

    await supabase.from('audit_logs').insert({
      user_id: authUserId,
      action: status ? 'document.status_change' : 'document.edit',
      target_type: 'document',
      target_id: id,
      details: { ...updates },
    }).then(() => {}, () => {});

    return NextResponse.json<ApiResponse>({ success: true, data });
  } catch {
    return NextResponse.json<ApiResponse>({ success: false, error: '문서 수정 중 오류' }, { status: 500 });
  }
}

export async function DELETE(
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

    const { error } = await supabase.from('documents').delete().eq('id', id);
    if (error) {
      console.error('[documents/[id]/DELETE]', error.message);
      return NextResponse.json<ApiResponse>({ success: false, error: '문서 삭제에 실패했습니다.' }, { status: 500 });
    }

    if (authUserId) {
      await supabase.from('audit_logs').insert({
        user_id: authUserId,
        action: 'document.delete',
        target_type: 'document',
        target_id: id,
        details: {},
      }).then(() => {}, () => {});
    }

    return NextResponse.json<ApiResponse>({ success: true, data: { id } });
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: '문서 삭제 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
