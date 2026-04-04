import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
import { renderDocx } from '@/lib/renderers/docx-renderer';
import { renderHwpx } from '@/lib/renderers/hwpx-renderer';
import { renderPdf } from '@/lib/renderers/pdf-renderer';
import type { CorporateTheme } from '@/lib/renderers/types';
import { DEFAULT_THEME } from '@/lib/renderers/types';

/**
 * GET /api/documents/[id]/download?font=맑은고딕&format=docx
 * 문서 내용을 선택된 포맷으로 변환하여 다운로드
 */
const FONT_MAP: Record<string, string> = {
  '맑은 고딕': 'Malgun Gothic',
  '나눔고딕': 'NanumGothic',
  '바탕': 'Batang',
  '돋움': 'Dotum',
  '굴림': 'Gulim',
  '나눔명조': 'NanumMyeongjo',
  'Arial': 'Arial',
  'Times New Roman': 'Times New Roman',
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const url = new URL(_request.url);
    const fontParam = url.searchParams.get('font') ?? '맑은 고딕';
    const format = url.searchParams.get('format') ?? 'docx';
    const fontFamily = FONT_MAP[fontParam] ?? 'Malgun Gothic';

    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: 'DB 미설정' }, { status: 503 });
    }

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { data: doc, error } = await supabase
      .from('documents')
      .select('id, title, content')
      .eq('id', id)
      .single();

    if (error || !doc) {
      return NextResponse.json({ error: '문서를 찾을 수 없습니다.' }, { status: 404 });
    }

    const content = doc.content ?? '';
    const theme: CorporateTheme = {
      ...DEFAULT_THEME,
      fontFamily: fontParam,
      fontFamilyEn: fontFamily,
    };

    let rendered;

    switch (format) {
      case 'hwpx':
        rendered = await renderHwpx(content, doc.title, theme);
        break;
      case 'pdf':
        rendered = await renderPdf(content, doc.title, theme);
        break;
      case 'docx':
      default:
        rendered = await renderDocx(content, doc.title, theme);
        break;
    }

    const fileName = encodeURIComponent(rendered.fileName);

    return new NextResponse(rendered.buffer, {
      headers: {
        'Content-Type': rendered.mimeType,
        'Content-Disposition': `attachment; filename*=UTF-8''${fileName}`,
        'Content-Length': String(rendered.buffer.length),
      },
    });
  } catch (err) {
    console.error('[documents/download]', err);
    return NextResponse.json({ error: '파일 변환 중 오류' }, { status: 500 });
  }
}
