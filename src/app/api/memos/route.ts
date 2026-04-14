import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    const admin = createAdminSupabaseClient();
    let query = admin
      .from('memos')
      .select('*')
      .eq('created_by', authUserId)
      .order('is_pinned', { ascending: false })
      .order('updated_at', { ascending: false });

    if (search) {
      query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[memos/GET]', error.message);
      return NextResponse.json({ success: false, error: '조회 실패' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (err) {
    console.error('[memos/GET] error:', err);
    return NextResponse.json({ success: false, error: '서버 오류' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ success: false, error: 'DB 미설정' }, { status: 503 });

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });

    const body = await request.json();
    const { title, content, color } = body;

    if (!title) {
      return NextResponse.json({ success: false, error: '제목 필수' }, { status: 400 });
    }

    const admin = createAdminSupabaseClient();
    const { data, error } = await admin
      .from('memos')
      .insert({
        title,
        content: content || null,
        color: color || 'default',
        created_by: authUserId,
      })
      .select()
      .single();

    if (error) {
      console.error('[memos/POST]', error.message);
      return NextResponse.json({ success: false, error: '생성 실패' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('[memos/POST] error:', err);
    return NextResponse.json({ success: false, error: '서버 오류' }, { status: 500 });
  }
}
