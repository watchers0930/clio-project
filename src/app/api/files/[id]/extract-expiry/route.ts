/**
 * POST /api/files/[id]/extract-expiry
 * 파일 텍스트에서 AI로 만료일을 추출하고 schedules 테이블에 등록한다.
 * 업로드 후처리 파이프라인에서 비동기로 호출되거나 수동으로 실행 가능.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { extractExpiryFromText } from '@/lib/ai/extract-expiry';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: fileId } = await params;
    const supabase = createAdminSupabaseClient();

    // 1. 파일 메타데이터 + 청크 텍스트 조회
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: file, error: fileErr } = await (supabase as any)
      .from('files')
      .select('id, name, user_id')
      .eq('id', fileId)
      .single() as { data: { id: string; name: string; user_id: string } | null; error: unknown };

    if (fileErr || !file) {
      return NextResponse.json(
        { error: { code: 'FILE_NOT_FOUND', message: '파일을 찾을 수 없습니다.' } },
        { status: 404 },
      );
    }

    // 2. file_chunks에서 텍스트 조합 (앞 청크 우선)
    const { data: chunks } = await supabase
      .from('file_chunks')
      .select('content, chunk_index')
      .eq('file_id', fileId)
      .order('chunk_index', { ascending: true })
      .limit(10);

    const text = (chunks ?? []).map((c: { content: string; chunk_index: number }) => c.content).join('\n');

    if (!text.trim()) {
      return NextResponse.json({
        success: true,
        schedule_id: null,
        expiry_date: null,
        confidence: 'none',
        document_type: '불명확',
        reason: '추출된 텍스트가 없습니다.',
      });
    }

    // 3. GPT-4o로 만료일 추출
    const result = await extractExpiryFromText(text);

    // 4. confidence가 none이 아니면 schedules에 등록
    let scheduleId: string | null = null;

    if (result.confidence !== 'none' && result.expiry_date) {
      // 기존 schedules 레코드 확인 (중복 방지)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existing } = await (supabase as any)
        .from('schedules')
        .select('id')
        .eq('source_type', 'document_expiry')
        .eq('source_id', fileId)
        .maybeSingle() as { data: { id: string } | null };

      if (existing) {
        // 이미 등록된 경우 업데이트
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('schedules')
          .update({
            title: `${file.name} 만료일`,
            start_date: result.expiry_date,
            end_date: result.expiry_date,
            expiry_confidence: result.confidence,
          })
          .eq('id', existing.id);
        scheduleId = existing.id;
      } else {
        // 신규 등록
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: newSchedule } = await (supabase as any)
          .from('schedules')
          .insert({
            user_id: file.user_id,
            title: `${file.name} 만료일`,
            description: `[AI 추출] ${result.document_type} | 신뢰도: ${result.confidence} | ${result.reason}`,
            start_date: result.expiry_date,
            end_date: result.expiry_date,
            source_type: 'document_expiry',
            source_id: fileId,
            expiry_confidence: result.confidence,
          })
          .select('id')
          .single() as { data: { id: string } | null };
        scheduleId = newSchedule?.id ?? null;
      }
    }

    return NextResponse.json({
      success: true,
      schedule_id: scheduleId,
      expiry_date: result.expiry_date,
      confidence: result.confidence,
      document_type: result.document_type,
      reason: result.reason,
    });
  } catch (err) {
    console.error('[extract-expiry] error:', err);
    return NextResponse.json(
      { error: { code: 'EXPIRY_EXTRACT_FAILED', message: '만료일 추출 중 오류가 발생했습니다.' } },
      { status: 500 },
    );
  }
}
