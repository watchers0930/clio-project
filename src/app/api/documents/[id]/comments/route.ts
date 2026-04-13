import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';

// GET /api/documents/[id]/comments — 댓글 목록 (작성자 이름 포함)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params;
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ success: false, error: '서버 오류' }, { status: 503 });

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

    const admin = createAdminSupabaseClient();
    const { data, error } = await admin
      .from('document_comments')
      .select('id, content, created_at, user_id, users:user_id(name, department_id)')
      .eq('document_id', documentId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const comments = (data ?? []).map((c) => ({
      id: c.id,
      content: c.content,
      created_at: c.created_at,
      user_id: c.user_id,
      user_name: (c.users as { name: string } | null)?.name ?? '알 수 없음',
    }));

    return NextResponse.json({ success: true, comments });
  } catch {
    return NextResponse.json({ success: false, error: '댓글 조회 실패' }, { status: 500 });
  }
}

// POST /api/documents/[id]/comments — 댓글 작성
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params;
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ success: false, error: '서버 오류' }, { status: 503 });

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

    const body = await req.json();
    const content = (body.content ?? '').trim();
    if (!content) return NextResponse.json({ success: false, error: '댓글 내용을 입력해주세요.' }, { status: 400 });

    // user_id 확인 (users 테이블 기준)
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('id', authUserId)
      .single();
    if (!userData) return NextResponse.json({ success: false, error: '사용자 정보 없음' }, { status: 403 });

    const admin = createAdminSupabaseClient();
    const { data, error } = await admin
      .from('document_comments')
      .insert({ document_id: documentId, user_id: authUserId, content })
      .select('id, content, created_at, user_id, users:user_id(name)')
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      comment: {
        id: data.id,
        content: data.content,
        created_at: data.created_at,
        user_id: data.user_id,
        user_name: (data.users as { name: string } | null)?.name ?? '알 수 없음',
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: '댓글 작성 실패' }, { status: 500 });
  }
}
