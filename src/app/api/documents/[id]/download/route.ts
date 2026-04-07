import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
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

    // 본인 문서 조회, 없으면 결재자인지 확인 후 admin으로 조회
    let doc: { id: string; title: string; content: string | null; storage_path: string | null } | null = null;
    const { data: ownDoc } = await supabase
      .from('documents')
      .select('id, title, content, storage_path')
      .eq('id', id)
      .single();

    if (ownDoc) {
      doc = ownDoc;
    } else {
      const admin = createAdminSupabaseClient();
      const { data: approval } = await admin
        .from('approvals')
        .select('id')
        .eq('document_id', id)
        .eq('approver_id', authUserId)
        .limit(1)
        .maybeSingle();
      if (approval) {
        const { data: adminDoc } = await admin
          .from('documents')
          .select('id, title, content, storage_path')
          .eq('id', id)
          .single();
        doc = adminDoc;
      }
    }

    if (!doc) {
      return NextResponse.json({ error: '문서를 찾을 수 없습니다.' }, { status: 404 });
    }

    const inline = url.searchParams.get('inline') === 'true';

    // storage_path가 있고 inline(미리보기) 요청이면 실제 파일을 PDF로 서빙
    // storage_path가 있고 다운로드 요청이면 실제 파일을 원본 포맷으로 서빙
    if (doc.storage_path) {
      const adminClient = createAdminSupabaseClient();
      const { data: blob, error: dlErr } = await adminClient.storage.from('files').download(doc.storage_path);
      if (!dlErr && blob) {
        const fileBuffer = Buffer.from(await blob.arrayBuffer());
        const ext = doc.storage_path.split('.').pop()?.toLowerCase() ?? '';
        const mimeMap: Record<string, string> = {
          hwpx: 'application/haansofthwpx',
          docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          pdf: 'application/pdf',
        };

        if (inline) {
          // 미리보기: 마크다운 content가 있으면 PDF 렌더, 없으면 원본 파일 서빙
          const content = doc.content ?? '';
          const isLabel = content.startsWith('[') && content.length < 200;
          if (!isLabel && content.length > 50) {
            // 마크다운 content → PDF 렌더
            const theme: CorporateTheme = { ...DEFAULT_THEME, fontFamily: fontParam, fontFamilyEn: fontFamily };
            const rendered = await renderPdf(content, doc.title, theme);
            const fileName = encodeURIComponent(rendered.fileName);
            return new NextResponse(rendered.buffer, {
              headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename*=UTF-8''${fileName}`,
                'Content-Length': String(rendered.buffer.length),
              },
            });
          }
          // 파일 기반 문서 → 원본 파일 그대로 inline 서빙
          const fileName = encodeURIComponent(`${doc.title}.${ext}`);
          return new NextResponse(fileBuffer, {
            headers: {
              'Content-Type': mimeMap[ext] ?? 'application/octet-stream',
              'Content-Disposition': `inline; filename*=UTF-8''${fileName}`,
              'Content-Length': String(fileBuffer.length),
            },
          });
        }

        // 다운로드: 원본 파일 서빙
        const fileName = encodeURIComponent(`${doc.title}.${ext}`);
        return new NextResponse(fileBuffer, {
          headers: {
            'Content-Type': mimeMap[ext] ?? 'application/octet-stream',
            'Content-Disposition': `attachment; filename*=UTF-8''${fileName}`,
            'Content-Length': String(fileBuffer.length),
          },
        });
      }
    }

    // storage_path 없으면 기존 방식: content를 렌더링
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
        'Content-Disposition': inline
          ? `inline; filename*=UTF-8''${fileName}`
          : `attachment; filename*=UTF-8''${fileName}`,
        'Content-Length': String(rendered.buffer.length),
      },
    });
  } catch (err) {
    console.error('[documents/download]', err);
    return NextResponse.json({ error: '파일 변환 중 오류' }, { status: 500 });
  }
}
