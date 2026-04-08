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
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const deptId = searchParams.get('department_id');

    const admin = createAdminSupabaseClient();
    // 사용자 부서 조회
    const { data: me } = await admin.from('users').select('department_id').eq('id', authUserId).single();

    let query = admin
      .from('events')
      .select('*')
      .order('start_at', { ascending: true });

    if (start) query = query.gte('start_at', start);
    if (end) query = query.lte('start_at', end);
    if (deptId) {
      query = query.eq('department_id', deptId);
    } else {
      // 전사(department_id IS NULL) + 내 부서 + 내가 만든 일정
      query = query.or(
        `department_id.is.null,department_id.eq.${me?.department_id ?? '00000000-0000-0000-0000-000000000000'},created_by.eq.${authUserId}`
      );
    }

    const { data: events, error } = await query;
    if (error) {
      console.error('[events/GET]', error.message);
      return NextResponse.json({ success: false, error: '조회 실패' }, { status: 500 });
    }

    // 작성자 이름 조인
    const creatorIds = [...new Set((events ?? []).map(e => e.created_by))];
    const { data: users } = creatorIds.length > 0
      ? await admin.from('users').select('id, name').in('id', creatorIds)
      : { data: [] };
    const userMap = new Map((users ?? []).map(u => [u.id, u.name]));

    const result = (events ?? []).map(e => ({
      ...e,
      creator_name: userMap.get(e.created_by) ?? '',
    }));

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error('[events/GET] error:', err);
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
    const { title, description, location, event_type, start_at, end_at, all_day, department_id } = body;

    if (!title || !start_at || !end_at) {
      return NextResponse.json({ success: false, error: '필수 항목 누락' }, { status: 400 });
    }

    const admin = createAdminSupabaseClient();
    const { data, error } = await admin
      .from('events')
      .insert({
        title,
        description: description || null,
        location: location || null,
        event_type: event_type || 'meeting',
        start_at,
        end_at,
        all_day: all_day ?? false,
        department_id: department_id || null,
        created_by: authUserId,
      })
      .select()
      .single();

    if (error) {
      console.error('[events/POST]', error.message);
      return NextResponse.json({ success: false, error: '생성 실패' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('[events/POST] error:', err);
    return NextResponse.json({ success: false, error: '서버 오류' }, { status: 500 });
  }
}
