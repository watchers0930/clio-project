// 문서 다운로드 라우트 전용 — 최신 입력 양식·저장 파일 서빙·content 기반 렌더
import { renderStoredFilePreview, renderLatestInputForm } from '@/lib/documents/inline-render';
import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { applyApprovalSignatures } from '@/lib/approval/apply-signatures';
import { renderDocx } from '@/lib/renderers/docx-renderer';
import { renderHwpx } from '@/lib/renderers/hwpx-renderer';
import { renderPdf } from '@/lib/renderers/pdf-renderer';
import type { CorporateTheme } from '@/lib/renderers/types';
import { DEFAULT_THEME } from '@/lib/renderers/types';
import { injectSignatureDocx, injectSignatureHwpx } from '@/lib/utils/inject-signature';
import { signatureBufferToDataUrl } from '@/lib/utils/signature-data-url';
import type { DownloadContext, DownloadDoc } from './download-source';

export type DownloadRenderContext = DownloadContext & {
  doc: DownloadDoc;
  inline: boolean;
  format: string;
  fontParam: string;
  fontFamily: string;
};

// 유효한 대상 양식은 예전 HTML 파일이 있어도 최신 저장 입력값으로 렌더한다. 해당 없으면 null.
export async function serveLatestInputForm(ctx: DownloadRenderContext): Promise<NextResponse | null> {
  const { doc, inline, fontParam, fontFamily, storedTemplateName, companyLogoContext, signatureBuffer } = ctx;
  // Valid target forms use the latest saved inputs even when an old HTML file exists.
  if (inline) {
    const latest = await renderLatestInputForm({
      document: doc,
      templateName: storedTemplateName || undefined,
      theme: { ...DEFAULT_THEME, fontFamily: fontParam, fontFamilyEn: fontFamily },
      companyLogoSrc: signatureBufferToDataUrl(companyLogoContext.buffer),
      companyLogoPatternSize: companyLogoContext.patternSize,
      authorSignatureSrc: signatureBufferToDataUrl(signatureBuffer),
    });
    if (latest) {
      const html = await applyApprovalSignatures(createAdminSupabaseClient(), doc.id, latest.buffer.toString('utf-8'));
      const buffer = Buffer.from(html, 'utf-8');
      return new NextResponse(new Uint8Array(buffer), { headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(latest.fileName)}`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'private, no-store',
      } });
    }
  }
  return null;
}

// storage_path가 있으면 저장 파일을 서빙한다. content 기반 렌더로 넘겨야 하면 null.
export async function serveStoredFile(ctx: DownloadRenderContext): Promise<NextResponse | null> {
  const {
    doc, inline, format, fontParam, fontFamily, isProposalDocument, proposalPreviewHtml,
    signerName, signatureBuffer, companySealBuffer, companyLogoContext, templateBundle, templateName,
    isCompanyIssuedDocument,
  } = ctx;
  // storage_path가 있고 inline(미리보기) 요청이면 실제 파일을 PDF로 서빙
  // storage_path가 있고 다운로드 요청이면 실제 파일을 원본 포맷으로 서빙
  if (doc.storage_path) {
    if (isProposalDocument && (inline || format === 'pdf')) {
      const proposalBuffer = Buffer.from(proposalPreviewHtml, 'utf-8');
      return new NextResponse(new Uint8Array(proposalBuffer), {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': inline
            ? `inline; filename*=UTF-8''${encodeURIComponent(`${doc.title}.html`)}`
            : `attachment; filename*=UTF-8''${encodeURIComponent(`${doc.title}.html`)}`,
          'Content-Length': String(proposalBuffer.length),
        },
      });
    }

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
        // 렌더된 HTML 양식(generated/*.html — 휴가원·재직증명서 등 테이블 양식)은
        // 마크다운으로 재렌더하지 않고 저장된 양식 HTML을 그대로 서빙한다.
        if (ext === 'html') {
          let formHtml = fileBuffer.toString('utf-8');
          formHtml = await applyApprovalSignatures(adminClient, doc.id, formHtml);
          const outBuffer = Buffer.from(formHtml, 'utf-8');
          return new NextResponse(new Uint8Array(outBuffer), {
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(`${doc.title}.html`)}`,
              'Content-Length': String(outBuffer.length),
            },
          });
        }
        // 미리보기: 마크다운 content가 있으면 PDF 렌더, 없으면 원본 파일 서빙
        let inlineContent = doc.content ?? '';
        // 임베드된 documentInputs 추출
        let inlineInputs: Record<string, string> = {};
        const inlineInputsMatch = inlineContent.match(/^<!--(?:PROPOSAL_INPUTS|DOCUMENT_INPUTS):(.*?)-->\n?/);
        if (inlineInputsMatch) {
          try { inlineInputs = JSON.parse(inlineInputsMatch[1]); } catch { /* ignore */ }
          inlineContent = inlineContent.slice(inlineInputsMatch[0].length);
        }
        const firstLine = inlineContent.split('\n')[0];
        const isLabel = firstLine.startsWith('[') && firstLine.length < 200;
        // 파일 기반 문서에 추가된 마크다운 섹션 추출
        const appendedLines = inlineContent.split('\n').slice(1);
        let ai = 0;
        while (ai < appendedLines.length && appendedLines[ai].trim() === '') ai++;
        const appendedMarkdown = appendedLines.slice(ai).join('\n').trim();

        if (!isLabel && inlineContent.length > 50) {
          // 마크다운 content → PDF 렌더
          const theme: CorporateTheme = { ...DEFAULT_THEME, fontFamily: fontParam, fontFamilyEn: fontFamily };
          const templateDocumentInputs = {
            ...inlineInputs,
            author: signerName,
            signature_image_src: signatureBufferToDataUrl(companySealBuffer ?? signatureBuffer),
            employee_signature_src: signatureBufferToDataUrl(signatureBuffer),
            company_logo_src: signatureBufferToDataUrl(companyLogoContext.buffer),
            company_logo_pattern_size: companyLogoContext.patternSize,
          };
          let rendered = await renderPdf(inlineContent, doc.title, theme, {
            templateBundle,
            documentInputs: templateDocumentInputs,
            templateName,
          });
          if (signatureBuffer && !isCompanyIssuedDocument) {
            const sigBase64 = signatureBuffer.toString('base64');
            const sigImg = `<div style="text-align:right;margin-top:32px;padding-right:40px;"><img src="data:image/png;base64,${sigBase64}" style="width:120px;height:60px;object-fit:contain;" alt="서명" /></div>`;
            const htmlStr = rendered.buffer.toString('utf-8');
            rendered = { ...rendered, buffer: Buffer.from(htmlStr.replace('</body>', `${sigImg}</body>`), 'utf-8') };
          }
          // 결재란(품의서·휴가원 등) 서명 주입 — 재렌더 경로에도 적용(결재란 없는 문서는 무변경)
          rendered = { ...rendered, buffer: Buffer.from(await applyApprovalSignatures(adminClient, doc.id, rendered.buffer.toString('utf-8')), 'utf-8') };
          const fileName = encodeURIComponent(rendered.fileName);
          return new NextResponse(new Uint8Array(rendered.buffer), {
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Content-Disposition': `inline; filename*=UTF-8''${fileName}`,
              'Content-Length': String(rendered.buffer.length),
            },
          });
        }
        const fileHtml = await renderStoredFilePreview({
          fileBuffer, ext, title: doc.title, signerName, signatureBuffer, appendedMarkdown,
        });
        return new NextResponse(new Uint8Array(fileHtml), {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Length': String(fileHtml.length),
          },
        });
      }

      // 렌더된 HTML 양식(휴가원·재직증명서 등 테이블 양식)은 PDF 요청도
      // 마크다운으로 재렌더하지 않고 저장된 표 양식 HTML을 그대로 서빙한다.
      if (format === 'pdf' && ext === 'html') {
        let formHtml = fileBuffer.toString('utf-8');
        formHtml = await applyApprovalSignatures(adminClient, doc.id, formHtml);
        const outBuffer = Buffer.from(formHtml, 'utf-8');
        return new NextResponse(new Uint8Array(outBuffer), {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(`${doc.title}.html`)}`,
            'Content-Length': String(outBuffer.length),
          },
        });
      }
      // PDF 다운로드 요청이면 content 기반 재렌더링으로 넘김 (최신 템플릿 로직 적용)
      if (format === 'pdf' && (doc.content ?? '').length > 50) {
        // storage_path 블록을 빠져나가 renderFromContent 경로로 진행
      } else {
        // 다운로드: 서명 주입 후 파일 서빙
        let finalBuffer: Buffer = Buffer.from(fileBuffer);
        if (!inline && signatureBuffer) {
          if (ext === 'docx') finalBuffer = Buffer.from(injectSignatureDocx(fileBuffer as unknown as Buffer, signatureBuffer as unknown as Buffer));
          else if (ext === 'hwpx') finalBuffer = Buffer.from(injectSignatureHwpx(fileBuffer as unknown as Buffer, signatureBuffer as unknown as Buffer, signerName));
        }
        const fileName = encodeURIComponent(`${doc.title}.${ext}`);
        return new NextResponse(new Uint8Array(finalBuffer), {
          headers: {
            'Content-Type': mimeMap[ext] ?? 'application/octet-stream',
            'Content-Disposition': `attachment; filename*=UTF-8''${fileName}`,
            'Content-Length': String(finalBuffer.length),
          },
        });
      }
    }
  }
  return null;
}

// storage_path 없으면(또는 PDF 재렌더로 넘어오면) content를 렌더링한다.
export async function renderFromContent(ctx: DownloadRenderContext): Promise<NextResponse> {
  const {
    doc, inline, format, fontParam, fontFamily, isProposalDocument, proposalPreviewHtml,
    signerName, signatureBuffer, companySealBuffer, companyLogoContext, templateBundle, templateName,
    isCompanyIssuedDocument,
  } = ctx;
  // storage_path 없으면 기존 방식: content를 렌더링
  const rawContent = doc.content ?? '';
  // 콘텐츠에 임베드된 documentInputs 추출 (제안서/사업계획서 표지 정보)
  let embeddedInputs: Record<string, string> = {};
  let content = rawContent;
  const inputsMatch = rawContent.match(/^<!--(?:PROPOSAL_INPUTS|DOCUMENT_INPUTS):(.*?)-->\n?/);
  if (inputsMatch) {
    try { embeddedInputs = JSON.parse(inputsMatch[1]); } catch { /* ignore */ }
    content = rawContent.slice(inputsMatch[0].length);
  }
  const mergedDocumentInputs = {
    ...embeddedInputs,
    author: signerName,
    // 재직증명서·근로계약서는 회사 직인 우선(없으면 개인 서명)
    signature_image_src: signatureBufferToDataUrl(companySealBuffer ?? signatureBuffer),
    // 근로계약서 근로자 서명란: 로그인 이용자 개인 서명
    employee_signature_src: signatureBufferToDataUrl(signatureBuffer),
    company_logo_src: signatureBufferToDataUrl(companyLogoContext.buffer),
    company_logo_pattern_size: companyLogoContext.patternSize,
  };
  const theme: CorporateTheme = {
    ...DEFAULT_THEME,
    fontFamily: fontParam,
    fontFamilyEn: fontFamily,
  };

  // inline 요청: storage_path 없는 경우 → content가 라벨이면 오류 HTML, 아니면 PDF 렌더
  if (inline) {
    const isLabel = content.startsWith('[') && content.length < 200;
    if (isLabel || !content) {
      const errHtml = Buffer.from(
        `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"></head><body style="font-family:'맑은 고딕',sans-serif;color:#6e6e73;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">파일을 불러올 수 없습니다.</body></html>`,
        'utf-8'
      );
      return new NextResponse(new Uint8Array(errHtml), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    if (isProposalDocument) {
      const proposalBuffer = Buffer.from(proposalPreviewHtml, 'utf-8');
      return new NextResponse(new Uint8Array(proposalBuffer), {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Length': String(proposalBuffer.length),
        },
      });
    }
    // 실제 content → PDF(HTML) 렌더
    let pdfRendered = await renderPdf(content, doc.title, theme, {
      templateBundle,
      documentInputs: mergedDocumentInputs,
      templateName,
    });
    // 결재란 서명 주입(결재란 없는 문서는 무변경)
    pdfRendered = { ...pdfRendered, buffer: Buffer.from(await applyApprovalSignatures(createAdminSupabaseClient(), doc.id, pdfRendered.buffer.toString('utf-8')), 'utf-8') };
    const pdfFileName = encodeURIComponent(pdfRendered.fileName);
    return new NextResponse(new Uint8Array(pdfRendered.buffer), {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename*=UTF-8''${pdfFileName}`,
        'Content-Length': String(pdfRendered.buffer.length),
      },
    });
  }

  let rendered;

  switch (format) {
    case 'hwpx':
      rendered = await renderHwpx(content, doc.title, theme);
      if (signatureBuffer) rendered = { ...rendered, buffer: injectSignatureHwpx(rendered.buffer, signatureBuffer, signerName) };
      break;
    case 'pdf':
      if (isProposalDocument) {
        const proposalBuffer = Buffer.from(proposalPreviewHtml, 'utf-8');
        return new NextResponse(new Uint8Array(proposalBuffer), {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`${doc.title}.html`)}`,
            'Content-Length': String(proposalBuffer.length),
          },
        });
      }
      rendered = await renderPdf(content, doc.title, theme, {
        templateBundle,
        documentInputs: mergedDocumentInputs,
        templateName,
      });
      if (signatureBuffer && !isCompanyIssuedDocument) {
        const sigBase64 = signatureBuffer.toString('base64');
        const sigImg = `<div style="text-align:right;margin-top:32px;padding-right:40px;"><img src="data:image/png;base64,${sigBase64}" style="width:120px;height:60px;object-fit:contain;" alt="서명" /></div>`;
        const htmlStr = rendered.buffer.toString('utf-8');
        rendered = { ...rendered, buffer: Buffer.from(htmlStr.replace('</body>', `${sigImg}</body>`), 'utf-8') };
      }
      // 결재란 서명 주입(결재란 없는 문서는 무변경)
      rendered = { ...rendered, buffer: Buffer.from(await applyApprovalSignatures(createAdminSupabaseClient(), doc.id, rendered.buffer.toString('utf-8')), 'utf-8') };
      // HTML → 서버에서 실제 PDF로 변환
      {
        const { htmlToPdf } = await import('@/lib/renderers/html-to-pdf');
        const pdfBuffer = await htmlToPdf(rendered.buffer.toString('utf-8'));
        rendered = { buffer: pdfBuffer, mimeType: 'application/pdf', extension: 'pdf', fileName: `${doc.title}.pdf` };
      }
      break;
    case 'docx':
    default:
      rendered = await renderDocx(content, doc.title, theme, {
        templateBundle,
        documentInputs: mergedDocumentInputs,
      });
      if (signatureBuffer) rendered = { ...rendered, buffer: injectSignatureDocx(rendered.buffer, signatureBuffer) };
      break;
  }

  const fileName = encodeURIComponent(rendered.fileName);

  return new NextResponse(new Uint8Array(rendered.buffer), {
    headers: {
      'Content-Type': rendered.mimeType,
      'Content-Disposition': inline
        ? `inline; filename*=UTF-8''${fileName}`
        : `attachment; filename*=UTF-8''${fileName}`,
      'Content-Length': String(rendered.buffer.length),
    },
  });
}
