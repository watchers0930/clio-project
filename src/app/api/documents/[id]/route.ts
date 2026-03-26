import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, Document } from '@/lib/supabase/types';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { documents, users, templates } from '@/lib/mock-data';

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
        data: {
          ...docData,
          template_name: tmpl?.name,
        },
      });
    }

    /* ── 폴백: mock 데이터 ── */
    const doc = documents.find((d) => d.id === id);

    if (!doc) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '문서를 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    const author = users.find((u) => u.id === doc.user_id);
    const template = templates.find((t) => t.id === doc.template_id);

    return NextResponse.json<ApiResponse<Document & { author_name?: string; template_name?: string }>>({
      success: true,
      data: {
        ...doc,
        author_name: author?.name,
        template_name: template?.name,
      },
    });
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: '문서 상세 조회 중 오류가 발생했습니다.' },
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
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // audit_logs 기록 (실패해도 무시)
      try {
        await supabase.from('audit_logs').insert({
          user_id: 'user-1',
          action: 'document.delete',
          target_type: 'document',
          target_id: id,
          details: {},
        } as Record<string, unknown>);
      } catch { /* audit 실패는 무시 */ }

      return NextResponse.json<ApiResponse>({ success: true, data: { id } });
    }

    /* ── 폴백 ── */
    return NextResponse.json<ApiResponse>({ success: true, data: { id } });
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: '문서 삭제 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
