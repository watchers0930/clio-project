import { withMutation } from '@/lib/http/mutation-guard';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // 변이 요청: 출처 + CSRF 토큰 + 활성 사용자 확인 (기존 권한 확인은 아래 그대로)
  const mutation = await withMutation(request);
  if (mutation.error) return mutation.error;
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

    const body = await request.json();
    const admin = createAdminSupabaseClient();

    // 본인 확인
    const { data: existing } = await admin.from('todos').select('user_id').eq('id', id).single();
    if (!existing || existing.user_id !== authUserId) {
      return NextResponse.json({ success: false, error: '권한 없음' }, { status: 403 });
    }

    const updates: Record<string, unknown> = {};
    for (const key of ['title', 'description', 'due_date', 'priority', 'status']) {
      if (body[key] !== undefined) updates[key] = body[key];
    }

    // 토글 완료 처리
    if (body.status === 'completed') {
      updates.completed_at = new Date().toISOString();
    } else if (body.status === 'active') {
      updates.completed_at = null;
    }

    const { data, error } = await admin
      .from('todos')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[todos/PATCH]', error.message);
      return NextResponse.json({ success: false, error: '수정 실패' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('[todos/PATCH] error:', err);
    return NextResponse.json({ success: false, error: '서버 오류' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // 변이 요청: 출처 + CSRF 토큰 + 활성 사용자 확인 (기존 권한 확인은 아래 그대로)
  const mutation = await withMutation(_request);
  if (mutation.error) return mutation.error;
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

    const admin = createAdminSupabaseClient();

    const { data: existing } = await admin.from('todos').select('user_id').eq('id', id).single();
    if (!existing || existing.user_id !== authUserId) {
      return NextResponse.json({ success: false, error: '권한 없음' }, { status: 403 });
    }

    const { error } = await admin.from('todos').delete().eq('id', id);
    if (error) {
      console.error('[todos/DELETE]', error.message);
      return NextResponse.json({ success: false, error: '삭제 실패' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[todos/DELETE] error:', err);
    return NextResponse.json({ success: false, error: '서버 오류' }, { status: 500 });
  }
}
