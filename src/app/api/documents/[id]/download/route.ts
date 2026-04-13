import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import { renderDocx } from '@/lib/renderers/docx-renderer';
import { renderHwpx } from '@/lib/renderers/hwpx-renderer';
import { renderPdf } from '@/lib/renderers/pdf-renderer';
import type { CorporateTheme } from '@/lib/renderers/types';
import { DEFAULT_THEME } from '@/lib/renderers/types';
import { injectSignatureDocx, injectSignatureHwpx } from '@/lib/utils/inject-signature';

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

    // 서명 이미지 가져오기 — 문서 작성자(요청자) 기준으로 로드
    let signatureBuffer: Buffer | null = null;
    let signerName = '';
    try {
      const adminClient = createAdminSupabaseClient();
      // 문서 작성자(요청자) created_by를 별도 조회
      const { data: docMeta } = await adminClient
        .from('documents')
        .select('created_by')
        .eq('id', id)
        .maybeSingle();
      const signatureOwnerId = docMeta?.created_by ?? authUserId;
      const { data: userData, error: userErr } = await adminClient
        .from('users')
        .select('name, signature_path')
        .eq('id', signatureOwnerId)
        .maybeSingle();
      if (!userErr && userData) {
        signerName = userData.name ?? '';
        if (userData.signature_path) {
          const { data: sigBlob } = await adminClient.storage.from('files').download(userData.signature_path);
          if (sigBlob) signatureBuffer = Buffer.from(await sigBlob.arrayBuffer());
        }
      }
    } catch { /* 서명 없으면 그냥 진행 */ }

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
            let rendered = await renderPdf(content, doc.title, theme);
            if (signatureBuffer) {
              const sigBase64 = signatureBuffer.toString('base64');
              const sigImg = `<div style="text-align:right;margin-top:32px;padding-right:40px;"><img src="data:image/png;base64,${sigBase64}" style="width:120px;height:60px;object-fit:contain;" alt="서명" /></div>`;
              const htmlStr = rendered.buffer.toString('utf-8');
              rendered = { ...rendered, buffer: Buffer.from(htmlStr.replace('</body>', `${sigImg}</body>`), 'utf-8') };
            }
            const fileName = encodeURIComponent(rendered.fileName);
            return new NextResponse(rendered.buffer, {
              headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Content-Disposition': `inline; filename*=UTF-8''${fileName}`,
                'Content-Length': String(rendered.buffer.length),
              },
            });
          }
          // 파일 기반 문서 → 파일에서 텍스트 추출 후 HTML 렌더
          let extractedHtml = '';
          try {
            if (ext === 'docx') {
              const mammoth = await import('mammoth');
              const result = await mammoth.convertToHtml({ buffer: fileBuffer.buffer as ArrayBuffer });
              extractedHtml = result.value;
            } else if (ext === 'hwpx') {
              const PizZip = (await import('pizzip')).default;
              const zip = new PizZip(fileBuffer);
              const sectionFiles = Object.keys(zip.files)
                .filter(name => /^Contents\/section\d+\.xml$/i.test(name))
                .sort();
              const lines: string[] = [];
              for (const name of sectionFiles) {
                const xml = zip.file(name)?.asText() ?? '';
                const matches = xml.match(/<(?:hp:)?t[^>]*>([^<]*)<\/(?:hp:)?t>/g) ?? [];
                matches.map(m => m.replace(/<[^>]+>/g, '').trim()).filter(Boolean).forEach(t => lines.push(t));
              }
              extractedHtml = lines.map(l => `<p>${l}</p>`).join('');
            }
          } catch { /* 추출 실패 시 빈 문자열 */ }

          const bodyContent = extractedHtml
            ? extractedHtml
            : `<p style="color:#6e6e73;">이 파일(${ext.toUpperCase()})은 미리보기를 지원하지 않습니다.</p>`;

          const signatureBlock = signatureBuffer
            ? `<div style="text-align:right;margin-top:32px;padding-right:40px;"><img src="data:image/png;base64,${signatureBuffer.toString('base64')}" style="width:120px;height:60px;object-fit:contain;" alt="서명" /></div>`
            : '';

          const fileHtml = Buffer.from(`<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><style>body{font-family:'맑은 고딕',sans-serif;max-width:800px;margin:40px auto;padding:0 40px;font-size:13px;line-height:1.8;color:#1d1d1f;}h1{font-size:18px;font-weight:700;margin-bottom:24px;border-bottom:1px solid #e5e5e7;padding-bottom:12px;}p{margin:4px 0;}table{border-collapse:collapse;width:100%;margin:12px 0;}td,th{border:1px solid #ccc;padding:6px 10px;}</style></head><body><h1>${doc.title}</h1>${bodyContent}${signatureBlock}</body></html>`, 'utf-8');
          return new NextResponse(fileHtml, {
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Content-Length': String(fileHtml.length),
            },
          });
        }

        // 다운로드: 서명 주입 후 파일 서빙
        let finalBuffer = fileBuffer;
        if (!inline && signatureBuffer) {
          if (ext === 'docx') finalBuffer = injectSignatureDocx(fileBuffer, signatureBuffer);
          else if (ext === 'hwpx') finalBuffer = injectSignatureHwpx(fileBuffer, signatureBuffer, signerName);
        }
        const fileName = encodeURIComponent(`${doc.title}.${ext}`);
        return new NextResponse(finalBuffer, {
          headers: {
            'Content-Type': mimeMap[ext] ?? 'application/octet-stream',
            'Content-Disposition': `attachment; filename*=UTF-8''${fileName}`,
            'Content-Length': String(finalBuffer.length),
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
        if (!inline && signatureBuffer) rendered = { ...rendered, buffer: injectSignatureHwpx(rendered.buffer, signatureBuffer, signerName) };
        break;
      case 'pdf':
        rendered = await renderPdf(content, doc.title, theme);
        // inline HTML 미리보기에 서명 이미지 삽입 (base64)
        if (signatureBuffer) {
          const sigBase64 = signatureBuffer.toString('base64');
          const sigImg = `<div style="text-align:right;margin-top:32px;padding-right:40px;"><img src="data:image/png;base64,${sigBase64}" style="width:120px;height:60px;object-fit:contain;" alt="서명" /></div>`;
          const htmlStr = rendered.buffer.toString('utf-8');
          rendered = { ...rendered, buffer: Buffer.from(htmlStr.replace('</body>', `${sigImg}</body>`), 'utf-8') };
        }
        break;
      case 'docx':
      default:
        rendered = await renderDocx(content, doc.title, theme);
        if (!inline && signatureBuffer) rendered = { ...rendered, buffer: injectSignatureDocx(rendered.buffer, signatureBuffer) };
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
