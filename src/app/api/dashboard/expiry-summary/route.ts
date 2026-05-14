/**
 * GET /api/dashboard/expiry-summary
 * D-30 이내 만료 예정 문서 목록 반환.
 * ExpiryAlertModal(모달 팝업)과 ExpiryDashboardWidget(대시보드 위젯)이 공용으로 사용.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import type { DbFileRecord, DbSchedule, DbUser } from '@/lib/supabase/types';
import type { ExpiryItem, ExpirySummaryResponse } from '@/types/expiry';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: '데이터베이스가 설정되지 않았습니다.' }, { status: 503 });
    }

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const days = Math.min(90, Math.max(1, Number(searchParams.get('days') ?? 30)));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') ?? 10)));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const limitDate = new Date(today);
    limitDate.setDate(limitDate.getDate() + days);
    const limitDateStr = limitDate.toISOString().split('T')[0];

    // schedules에서 만료 임박 문서 조회 (source_type = 'document_expiry')
    const { data: schedules, error } = await supabase
      .from('schedules')
      .select(`id, title, end_date, source_id, expiry_confidence`)
      .eq('source_type', 'document_expiry')
      .lte('end_date', limitDateStr)
      .order('end_date', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('[expiry-summary] schedules query error:', error);
      return NextResponse.json({ error: '데이터 조회 실패' }, { status: 500 });
    }

    if (!schedules || schedules.length === 0) {
      return NextResponse.json<ExpirySummaryResponse>({
        items: [],
        total: 0,
        has_expired: false,
      });
    }

    // source_id(file_id) 목록으로 파일 정보 조회
    const scheduleRows = (schedules ?? []) as DbSchedule[];
    const fileIds = scheduleRows
      .map((s) => s.source_id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    const { data: files } = await supabase
      .from('files')
      .select('id, name, user_id')
      .in('id', fileIds);

    // 사용자 이름 조회
    const fileRows = (files ?? []) as DbFileRecord[];
    const userIds = [...new Set(fileRows
      .map((f) => f.user_id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0))];
    const { data: users } = userIds.length > 0
      ? await supabase.from('users').select('id, name').in('id', userIds)
      : { data: [] as DbUser[] };

    const userRows = (users ?? []) as DbUser[];
    const fileMap = new Map(fileRows.map((f) => [f.id, f]));
    const userMap = new Map(userRows.map((u) => [u.id, u.name]));

    const todayMs = today.getTime();
    let hasExpired = false;

    const items: ExpiryItem[] = scheduleRows.map((s) => {
      const file = fileMap.get(s.source_id ?? '');
      const expiryMs = new Date(s.end_date).setHours(0, 0, 0, 0);
      const daysRemaining = Math.round((expiryMs - todayMs) / 86400000);

      if (daysRemaining < 0) hasExpired = true;

      return {
        schedule_id: s.id,
        file_id: s.source_id ?? '',
        file_name: file?.name ?? s.title,
        expiry_date: s.end_date,
        days_remaining: daysRemaining,
        confidence: (s.expiry_confidence as 'high' | 'low' | 'none') ?? 'low',
        owner_name: file?.user_id ? (userMap.get(file.user_id) ?? null) : null,
      };
    });

    return NextResponse.json<ExpirySummaryResponse>({
      items,
      total: items.length,
      has_expired: hasExpired,
    });
  } catch (err) {
    console.error('[expiry-summary] unexpected error:', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
