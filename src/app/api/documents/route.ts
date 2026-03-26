import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, Document, PaginatedResponse } from '@/lib/supabase/types';
import { documents, templates, users } from '@/lib/mock-data';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get('page') ?? 1));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') ?? 20)));
    const status = searchParams.get('status');
    const userId = searchParams.get('user_id');

    let filtered = [...documents];

    if (status) {
      filtered = filtered.filter((d) => d.status === status);
    }
    if (userId) {
      filtered = filtered.filter((d) => d.user_id === userId);
    }

    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total = filtered.length;
    const start = (page - 1) * limit;
    const paginated = filtered.slice(start, start + limit);

    return NextResponse.json<PaginatedResponse<Document>>({
      success: true,
      data: paginated,
      total,
      page,
      limit,
    });
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: '문서 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, template_id, title, content, source_file_ids } = body;

    if (!title || !template_id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '필수 필드가 누락되었습니다. (title, template_id)' },
        { status: 400 },
      );
    }

    if (!templates.find((t) => t.id === template_id)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '유효하지 않은 템플릿 ID입니다.' },
        { status: 400 },
      );
    }

    const newDoc: Document = {
      id: `doc-${Date.now()}`,
      user_id: user_id ?? 'user-1',
      template_id,
      title,
      content: content ?? '',
      source_file_ids: source_file_ids ?? [],
      status: 'draft',
      watermark: null,
      created_at: new Date().toISOString(),
    };

    return NextResponse.json<ApiResponse<Document>>(
      { success: true, data: newDoc },
      { status: 201 },
    );
  } catch {
    return NextResponse.json<ApiResponse>(
      { success: false, error: '문서 생성 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
