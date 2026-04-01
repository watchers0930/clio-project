import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import { extractText } from '@/lib/ai/extract-text';

/**
 * GET /api/files/[id]/preview
 * 파일의 텍스트 내용을 추출하여 반환 (미리보기용)
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: 'DB 미설정' }, { status: 503 });
    }

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    // 파일 메타데이터 조회
    const { data: file, error: fileErr } = await supabase
      .from('files')
      .select('id, name, type, storage_path')
      .eq('id', id)
      .single();

    if (fileErr || !file) {
      return NextResponse.json({ error: '파일을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (!file.storage_path) {
      return NextResponse.json({ error: '저장된 파일이 없습니다.' }, { status: 404 });
    }

    // Storage에서 다운로드
    const { data: blob, error: dlErr } = await supabase.storage
      .from('files')
      .download(file.storage_path);

    if (dlErr || !blob) {
      return NextResponse.json({ error: '파일 다운로드 실패' }, { status: 500 });
    }

    // 텍스트 추출
    const buffer = await blob.arrayBuffer();
    const text = await extractText(buffer, file.type ?? '', file.name);

    if (!text.trim()) {
      return NextResponse.json({
        name: file.name,
        text: '(텍스트를 추출할 수 없는 파일입니다)',
      });
    }

    // 미리보기는 최대 10,000자
    return NextResponse.json({
      name: file.name,
      text: text.slice(0, 10000),
      truncated: text.length > 10000,
      totalLength: text.length,
    });
  } catch (err) {
    console.error('[files/preview]', err);
    return NextResponse.json({ error: '미리보기 처리 중 오류' }, { status: 500 });
  }
}
