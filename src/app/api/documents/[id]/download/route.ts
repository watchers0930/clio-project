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

/* ── 한국어 순서 표현(첫째/둘째 등)이 문장 중간에 있으면 앞에 줄바꿈 삽입 ── */
function normalizeOrdinals(text: string): string {
  return text.replace(
    /([^\n])\s*(첫째|둘째|셋째|넷째|다섯째|여섯째|일곱째|여덟째|아홉째|열째|마지막으로)[,，]/g,
    '$1\n$2,'
  );
}

/* ── 추가된 마크다운 섹션 → HWPX 테이블과 동일한 HTML로 변환 ── */
function renderAppendedSections(markdown: string): string {
  const sections: { title: string; lines: string[] }[] = [];
  let current: { title: string; lines: string[] } | null = null;

  for (const line of normalizeOrdinals(markdown).split('\n')) {
    if (/^#{1,3}\s/.test(line)) {
      if (current) sections.push(current);
      current = { title: line.replace(/^#+\s/, ''), lines: [] };
    } else {
      if (!current) current = { title: '', lines: [] };
      current.lines.push(line);
    }
  }
  if (current) sections.push(current);

  return sections
    .filter(s => s.title || s.lines.some(l => l.trim()))
    .map(({ title, lines }) => {
      const contentHtml = lines
        .map(l => l.trim() ? `<p style="margin:2px 0;">${l}</p>` : '')
        .join('');
      const tdStyle = 'border:1px solid #ccc;padding:5px 9px;vertical-align:top;font-size:13px;';
      const titleRow = title
        ? `<tr><td style="${tdStyle}font-weight:700;">${title}</td></tr>`
        : '';
      return `<table style="border-collapse:collapse;width:100%;margin:10px 0;">${titleRow}<tr><td style="${tdStyle}">${contentHtml}</td></tr></table>`;
    })
    .join('');
}

/* ── HWPX 섹션 XML → HTML 변환 (테이블 구조 보존) ──────────── */
function hwpxExtractTexts(xml: string): string[] {
  const texts: string[] = [];
  const re = /<(?:hp|hh):t[^>]*>([^<]*)<\/(?:hp|hh):t>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    if (m[1].trim()) texts.push(m[1]);
  }
  return texts;
}

function hwpxRenderTable(tblXml: string): string {
  // 서명·헤더 테이블 전체 제거
  const allTexts = hwpxExtractTexts(tblXml);
  // (서명)/(인)이 셀 단독 텍스트인 서명 전용 테이블만 제거 (내용 테이블 안에 서명자 이름이 포함된 경우 제외)
  if (
    allTexts.some(t => t.trim() === '(서명)' || t.trim() === '(인)') ||
    allTexts.some(t => t.trim() === '담당')
  ) return '';

  const rows: string[] = [];
  const trRe = /<(?:hp|hh):tr[\s>]/g;
  let trM;
  while ((trM = trRe.exec(tblXml)) !== null) {
    const trStart = trM.index;
    const trNs = tblXml.slice(trStart + 1, trStart + 3);
    const trEnd = tblXml.indexOf(`</${trNs}:tr>`, trStart);
    if (trEnd < 0) continue;
    const trXml = tblXml.slice(trStart, trEnd + `</${trNs}:tr>`.length);

    const cells: string[] = [];
    const tcRe = /<(?:hp|hh):tc[\s>]/g;
    let tcM;
    while ((tcM = tcRe.exec(trXml)) !== null) {
      const tcStart = tcM.index;
      const tcNs = trXml.slice(tcStart + 1, tcStart + 3);
      const tcEnd = trXml.indexOf(`</${tcNs}:tc>`, tcStart);
      if (tcEnd < 0) continue;
      const tcXml = trXml.slice(tcStart, tcEnd + `</${tcNs}:tc>`.length);
      // 단락별로 텍스트 추출 → <br> 구분
      const pRe2 = /<(?:hp|hh):p[\s>][\s\S]*?<\/(?:hp|hh):p>/g;
      let pM2;
      const paragraphs: string[] = [];
      while ((pM2 = pRe2.exec(tcXml)) !== null) {
        const pTexts = hwpxExtractTexts(pM2[0]);
        if (pTexts.length > 0) paragraphs.push(pTexts.join(''));
      }
      const cellTextFlat = paragraphs.join('');
      const cellHtml = paragraphs.join('<br>');
      const boldLabels = ['보고처', '보고서명', '취급', '회의일자', '회의 일자', '장소', '참석자', '정보(자료) 출처', '정보출처', '보고 내용과 의견', '보고내용과 의견', '문제점'];
      const isBold = boldLabels.some(label => cellTextFlat.trim() === label || cellTextFlat.includes(label));
      const tdStyle = `border:1px solid #ccc;padding:5px 9px;vertical-align:top;font-size:13px;${isBold ? 'font-weight:700;' : ''}`;
      cells.push(`<td style="${tdStyle}">${cellHtml}</td>`);
    }
    if (cells.length > 0) rows.push(`<tr>${cells.join('')}</tr>`);
  }
  if (rows.length === 0) return '';
  return `<table style="border-collapse:collapse;width:100%;margin:10px 0;">${rows.join('')}</table>`;
}

function parseHwpxSection(xml: string): string {
  const result: string[] = [];

  // 테이블 위치 먼저 수집 (최상위만)
  type Range = { s: number; e: number };
  const tblRanges: Range[] = [];
  const tblTagRe = /<(hp|hh):tbl[\s>]/g;
  let tM;
  while ((tM = tblTagRe.exec(xml)) !== null) {
    const ns = tM[1];
    const startTag = `<${ns}:tbl`;
    const endTag = `</${ns}:tbl>`;
    // 이미 다른 테이블 안에 있으면 스킵
    if (tblRanges.some(r => tM!.index >= r.s && tM!.index < r.e)) continue;
    let depth = 1, pos = tM.index + startTag.length;
    while (depth > 0 && pos < xml.length) {
      const ns2 = xml.indexOf(startTag, pos);
      const ne = xml.indexOf(endTag, pos);
      if (ne < 0) { depth = 0; break; }
      if (ns2 >= 0 && ns2 < ne) { depth++; pos = ns2 + startTag.length; }
      else { depth--; pos = ne + endTag.length; }
    }
    if (pos > tM.index) tblRanges.push({ s: tM.index, e: pos });
  }
  tblRanges.sort((a, b) => a.s - b.s);

  // 테이블과 테이블 사이 구간에서 <hp:p> 단락 추출
  let cursor = 0;
  const processText = (fragment: string) => {
    const pRe = /<(?:hp|hh):p[\s>][\s\S]*?<\/(?:hp|hh):p>/g;
    let pM;
    while ((pM = pRe.exec(fragment)) !== null) {
      const texts = hwpxExtractTexts(pM[0]);
      if (texts.length > 0) result.push(`<p style="margin:3px 0;">${texts.join('')}</p>`);
    }
  };

  for (const range of tblRanges) {
    if (cursor < range.s) processText(xml.slice(cursor, range.s));
    result.push(hwpxRenderTable(xml.slice(range.s, range.e)));
    cursor = range.e;
  }
  if (cursor < xml.length) processText(xml.slice(cursor));

  return result.join('');
}

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
    let doc: { id: string; title: string; content: string | null; storage_path: string | null; parent_id: string | null } | null = null;
    const { data: ownDoc } = await supabase
      .from('documents')
      .select('id, title, content, storage_path, parent_id')
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
          .select('id, title, content, storage_path, parent_id')
          .eq('id', id)
          .single();
        doc = adminDoc;
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

    // 서명 이미지 가져오기 — 다운로드 전용 (inline 미리보기는 서명 제외)
    let signatureBuffer: Buffer | null = null;
    let signerName = '';
    if (!inline) {
      try {
        const adminClient = createAdminSupabaseClient();
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
    }

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
          const firstLine = content.split('\n')[0];
          const isLabel = firstLine.startsWith('[') && firstLine.length < 200;
          // 파일 기반 문서에 추가된 마크다운 섹션 추출
          const appendedLines = content.split('\n').slice(1);
          let ai = 0;
          while (ai < appendedLines.length && appendedLines[ai].trim() === '') ai++;
          const appendedMarkdown = appendedLines.slice(ai).join('\n').trim();

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
              const allFiles = Object.keys(zip.files);
              console.log('[download] hwpx zip files:', allFiles);
              const sectionFiles = allFiles
                .filter(name => /^Contents\/section\d+\.xml$/i.test(name))
                .sort();
              console.log('[download] hwpx section files:', sectionFiles);
              const sectionHtmlParts: string[] = [];
              for (const name of sectionFiles) {
                const xml = zip.file(name)?.asText() ?? '';
                sectionHtmlParts.push(parseHwpxSection(xml));
              }
              extractedHtml = sectionHtmlParts.join('');
            }
          } catch (e) { console.error('[download] file parse error:', e); }

          // appendedMarkdown은 파싱 성공 여부와 무관하게 항상 추가
          if (appendedMarkdown) {
            extractedHtml += renderAppendedSections(appendedMarkdown);
          }

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

    // inline 요청: storage_path 없는 경우 → content가 라벨이면 오류 HTML, 아니면 PDF 렌더
    if (inline) {
      const isLabel = content.startsWith('[') && content.length < 200;
      if (isLabel || !content) {
        const errHtml = Buffer.from(
          `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"></head><body style="font-family:'맑은 고딕',sans-serif;color:#6e6e73;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">파일을 불러올 수 없습니다.</body></html>`,
          'utf-8'
        );
        return new NextResponse(errHtml, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
      // 실제 content → PDF(HTML) 렌더
      const pdfRendered = await renderPdf(content, doc.title, theme);
      const pdfFileName = encodeURIComponent(pdfRendered.fileName);
      return new NextResponse(pdfRendered.buffer, {
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
        rendered = await renderPdf(content, doc.title, theme);
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
        if (signatureBuffer) rendered = { ...rendered, buffer: injectSignatureDocx(rendered.buffer, signatureBuffer) };
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
