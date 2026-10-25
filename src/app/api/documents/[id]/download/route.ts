import { renderStoredFilePreview, renderLatestInputForm } from '@/lib/documents/inline-render';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { getAuthUserId } from '@/lib/auth-helper';
import { applyApprovalSignatures } from '@/lib/approval/apply-signatures';
import { renderDocx } from '@/lib/renderers/docx-renderer';
import { renderHwpx } from '@/lib/renderers/hwpx-renderer';
import { renderPdf } from '@/lib/renderers/pdf-renderer';
import type { CorporateTheme } from '@/lib/renderers/types';
import { DEFAULT_THEME } from '@/lib/renderers/types';
import { injectSignatureDocx, injectSignatureHwpx } from '@/lib/utils/inject-signature';
import { signatureBufferToDataUrl } from '@/lib/utils/signature-data-url';
import { loadCompanySealBuffer } from '@/lib/settings/company-seal';
import { parseTemplateBundle, type TemplateBundle } from '@/lib/templates/template-schema';
import { resolveBuiltinTemplateBundle, resolveBuiltinTemplateBundleByName } from '@/lib/templates/builtin';
import { renderProposalDocumentHtml } from '@/lib/templates/proposal-render';
import { isProposalTemplateName } from '@/lib/templates/proposal';
import { canAccessDocument, getUserRoleInfo, canViewAllWeeklyReports } from '@/lib/permissions';
import { loadCompanyLogoContext } from '@/lib/settings/company-logo';

// PDF 서버 렌더(puppeteer/chromium 콜드스타트 대비) 실행시간 확보
export const maxDuration = 60;

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
    const requestedFont = url.searchParams.get('font') ?? '맑은 고딕';
    const fontParam = Object.hasOwn(FONT_MAP, requestedFont) ? requestedFont : '맑은 고딕';
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

    const roleInfo = await getUserRoleInfo(supabase, authUserId);
    if (!roleInfo) {
      return NextResponse.json({ error: '사용자 정보가 없습니다.' }, { status: 403 });
    }

    const canAccess = await canAccessDocument(supabase, authUserId, roleInfo.role, roleInfo.department_id, id);

    // 본인 문서 조회, 없으면 결재자인지 확인 후 admin으로 조회
    let doc: { id: string; title: string; content: string | null; storage_path: string | null; parent_id: string | null; template_id?: string | null; created_by?: string | null } | null = null;
    if (canAccess) {
      const admin = createAdminSupabaseClient();
      const { data: accessibleDoc } = await admin
        .from('documents')
        .select('id, title, content, storage_path, parent_id, template_id, created_by')
        .eq('id', id)
        .single();
      doc = accessibleDoc;
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
          .select('id, title, content, storage_path, parent_id, template_id, created_by')
          .eq('id', id)
          .single();
        doc = adminDoc;
      } else {
        // 전사 주간업무 조회 권한자(대표/관리자)는 주간업무 빌트인 문서를 inline 양식으로 열람 허용.
        // overview 조회와 동일 범위(title~주간업무 + template_id NULL)라 접근 권한이 일관된다.
        const { data: wr } = await admin
          .from('documents')
          .select('id, title, content, storage_path, parent_id, template_id, created_by')
          .eq('id', id)
          .single();
        if (wr && wr.template_id === null && /주간\s*업무/.test(wr.title ?? '')) {
          const { data: me } = await admin
            .from('users')
            .select('role, rank_level')
            .eq('id', authUserId)
            .single();
          if (me && canViewAllWeeklyReports(me.role, (me as { rank_level?: number | null }).rank_level)) {
            doc = wr;
          }
        }
      }
    }

    if (!doc) {
      return NextResponse.json({ error: '문서를 찾을 수 없습니다.' }, { status: 404 });
    }

    // storage_path가 없는 스냅샷 문서: 부모(루트) 문서의 storage_path로 대체
    if (!doc.storage_path && doc.parent_id) {
      const content = doc.content ?? '';
      const isLabel = content.startsWith('[') && content.length < 200;
      if (isLabel) {
        const adminFallback = createAdminSupabaseClient();
        const { data: parentDoc } = await adminFallback
          .from('documents')
          .select('storage_path')
          .eq('id', doc.parent_id)
          .single();
        if (parentDoc?.storage_path) {
          doc = { ...doc, storage_path: parentDoc.storage_path };
        }
      }
    }

    const inline = url.searchParams.get('inline') === 'true';

    // 서명 이미지 가져오기 — 다운로드 전용 (inline 미리보기는 서명 제외), 이름은 항상 가져옴
    let signatureBuffer: Buffer | null = null;
    let signerName = '';
    let templateBundle: TemplateBundle | null = null;
    let templateName = '';
    let storedTemplateName = '';
    try {
      const adminClient = createAdminSupabaseClient();
      const signatureOwnerId = doc.created_by ?? authUserId;
      const { data: nameData } = await adminClient
        .from('users').select('name, signature_path').eq('id', signatureOwnerId).maybeSingle();
      signerName = nameData?.name ?? '';
      // 미리보기(inline)에도 담당란 작성자 서명을 표시하기 위해 서명 버퍼를 로드한다.
      if (nameData?.signature_path) {
        const { data: sigBlob } = await adminClient.storage.from('files').download(nameData.signature_path);
        if (sigBlob) signatureBuffer = Buffer.from(await sigBlob.arrayBuffer());
      }
      if (doc.template_id) {
        // 빌트인 템플릿(근로계약서·품의서·휴가원·재직증명서)은 DB에 없고 코드에서 번들 생성.
        // 이 분기가 없으면 templateBundle=null → PDF가 양식(표·조항·결재란) 대신 마크다운 텍스트로 렌더됨.
        const builtin = resolveBuiltinTemplateBundle(doc.template_id);
        if (builtin) {
          templateName = builtin.name;
          templateBundle = builtin.bundle;
        } else {
          const { data: templateData } = await adminClient
            .from('templates')
            .select('name, description, content, placeholders')
            .eq('id', doc.template_id)
            .maybeSingle();
          if (templateData) {
            templateName = templateData.name ?? '';
            storedTemplateName = templateName;
            templateBundle = parseTemplateBundle(templateData.content, {
              name: templateData.name,
              description: templateData.description,
              placeholders: templateData.placeholders,
            });
          }
        }
      }
      // 빌트인 템플릿으로 생성됐지만 template_id가 저장되지 않은(null) 문서 보정.
      // buildDocumentInsertPayload가 '__builtin_' ID를 FK 제약 때문에 저장하지 않아 template_id=null이 됨
      // → 문서 제목으로 양식을 추론해 번들을 복원(없으면 null 유지). 이게 없으면 PDF가 텍스트로 렌더됨.
      if (!templateBundle) {
        const byName = resolveBuiltinTemplateBundleByName(doc.title);
        if (byName) {
          templateName = byName.name;
          templateBundle = byName.bundle;
        }
      }
    } catch { /* 이름 없으면 그냥 진행 */ }
    const companyLogoContext = await loadCompanyLogoContext(createAdminSupabaseClient());

    const isProposalDocument = isProposalTemplateName(templateName);
    // 재직증명서·표준근로계약서 등 회사 발급 문서는 신청자가 누구든 회사 공용 직인을 쓴다.
    // (개인 문서는 아래에서 신청자 본인 서명 signatureBuffer 사용)
    const isCompanyIssuedDocument = /재직\s*증명서|근로계약서/.test(templateName);
    const companySealBuffer = !inline && isCompanyIssuedDocument
      ? await loadCompanySealBuffer(createAdminSupabaseClient())
      : null;
    const proposalPreviewHtml = isProposalDocument
      ? renderProposalDocumentHtml({
          title: doc.title,
          content: doc.content ?? '',
        })
      : '';

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
          // storage_path 블록을 빠져나가 아래 renderPdf 경로로 진행
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
  } catch (err) {
    console.error('[documents/download]', err);
    return NextResponse.json({ error: '파일 변환 중 오류' }, { status: 500 });
  }
}
