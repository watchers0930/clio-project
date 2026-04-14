import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

    const body = await request.json();
    const admin = createAdminSupabaseClient();

    // 본인 확인
    const { data: existing } = await admin.from('memos').select('created_by').eq('id', id).single();
    if (!existing || existing.created_by !== authUserId) {
      return NextResponse.json({ success: false, error: '권한 없음' }, { status: 403 });
    }

    const updates: Record<string, unknown> = {};
    for (const key of ['title', 'content', 'color', 'is_pinned']) {
      if (body[key] !== undefined) updates[key] = body[key];
    }

    const { data, error } = await admin
      .from('memos')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[memos/PATCH]', error.message);
      return NextResponse.json({ success: false, error: '수정 실패' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('[memos/PATCH] error:', err);
    return NextResponse.json({ success: false, error: '서버 오류' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

    const admin = createAdminSupabaseClient();

    const { data: existing } = await admin.from('memos').select('created_by').eq('id', id).single();
    if (!existing || existing.created_by !== authUserId) {
      return NextResponse.json({ success: false, error: '권한 없음' }, { status: 403 });
    }

    const { error } = await admin.from('memos').delete().eq('id', id);
    if (error) {
      console.error('[memos/DELETE]', error.message);
      return NextResponse.json({ success: false, error: '삭제 실패' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[memos/DELETE] error:', err);
    return NextResponse.json({ success: false, error: '서버 오류' }, { status: 500 });
  }
}
