/**
 * PATCH /api/files/[id]/expiry
 * AI 추출 결과가 틀렸을 때 담당자가 만료일을 직접 수정한다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: fileId } = await params;
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: '데이터베이스가 설정되지 않았습니다.' }, { status: 503 });
    }

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const { expiry_date, reason } = body as { expiry_date: string; reason?: string };

    if (!expiry_date || !/^\d{4}-\d{2}-\d{2}$/.test(expiry_date)) {
      return NextResponse.json({ error: 'expiry_date는 YYYY-MM-DD 형식이어야 합니다.' }, { status: 400 });
    }

    // source_type = 'document_expiry' AND source_id = fileId인 schedules 레코드 조회
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing, error: findErr } = await (supabase as any)
      .from('schedules')
      .select('id')
      .eq('source_type', 'document_expiry')
      .eq('source_id', fileId)
      .maybeSingle() as { data: { id: string } | null; error: unknown };

    if (findErr) {
      return NextResponse.json({ error: '일정 조회 실패' }, { status: 500 });
    }

    if (!existing) {
      // schedules 레코드가 없으면 새로 생성
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: file } = await (supabase as any)
        .from('files')
        .select('name, user_id')
        .eq('id', fileId)
        .single() as { data: { name: string; user_id: string } | null };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: created, error: insertErr } = await (supabase as any)
        .from('schedules')
        .insert({
          user_id: file?.user_id ?? authUserId,
          title: `${file?.name ?? '파일'} 만료일`,
          description: reason ? `[수동 등록] ${reason}` : '[수동 등록]',
          start_date: expiry_date,
          end_date: expiry_date,
          source_type: 'document_expiry',
          source_id: fileId,
          expiry_confidence: 'high',
        })
        .select('id')
        .single() as { data: { id: string } | null; error: unknown };

      if (insertErr || !created) {
        return NextResponse.json({ error: '만료일 등록 실패' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        schedule_id: created.id,
        expiry_date,
        updated_at: new Date().toISOString(),
      });
    }

    // 기존 레코드 업데이트
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateErr } = await (supabase as any)
      .from('schedules')
      .update({
        start_date: expiry_date,
        end_date: expiry_date,
        expiry_confidence: 'high',
        description: reason ? `[수동 수정] ${reason}` : '[수동 수정]',
      })
      .eq('id', existing.id);

    if (updateErr) {
      return NextResponse.json({ error: '만료일 수정 실패' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      schedule_id: existing.id,
      expiry_date,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[expiry PATCH] error:', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
