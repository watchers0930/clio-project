import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, Document } from '@/lib/supabase/types';
import { documents, users, templates } from '@/lib/mock-data';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
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
