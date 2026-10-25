import type { CorporateTheme, RenderOutput } from '@/lib/renderers/types';
import { renderPdf } from '@/lib/renderers/pdf-renderer';
import { parseEmbeddedInputs } from '@/lib/documents/embedded-inputs';
import { resolveDocumentInputForm } from '@/lib/documents/resolve-input-form';
import { resolveBuiltinTemplateBundleByName } from '@/lib/templates/builtin';
import { isEmploymentCertificateTemplateName } from '@/lib/templates/employment-certificate';
import { isStandardLaborContractTemplateName } from '@/lib/templates/standard-labor-contract';

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** File based legacy preview rendering. No authentication or storage access here. */
/* ── 한국어 순서 표현(첫째/둘째 등)이 문장 중간에 있으면 앞에 줄바꿈 삽입 ── */
function normalizeOrdinals(text: string): string {
  return text.replace(
    /([^\n])\s*(첫째|둘째|셋째|넷째|다섯째|여섯째|일곱째|여덟째|아홉째|열째|마지막으로)[,，]/g,
    '$1\n$2,'
  );
}

/* ── 추가된 마크다운 섹션 → HWPX 테이블과 동일한 HTML로 변환 ── */
export function renderAppendedSections(markdown: string): string {
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
        .map(l => l.trim() ? `<p style="margin:2px 0;">${escapeHtml(l)}</p>` : '')
        .join('');
      const tdStyle = 'border:1px solid #ccc;padding:5px 9px;vertical-align:top;font-size:13px;';
      const titleRow = title
        ? `<tr><td style="${tdStyle}font-weight:700;">${escapeHtml(title)}</td></tr>`
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

function hwpxRenderTable(tblXml: string, signerName?: string): string {
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
  let skipRows = 0; // 타이틀 행 rowSpan으로 인해 건너뛸 행 수

  while ((trM = trRe.exec(tblXml)) !== null) {
    const trStart = trM.index;
    const trNs = tblXml.slice(trStart + 1, trStart + 3);
    const trEnd = tblXml.indexOf(`</${trNs}:tr>`, trStart);
    if (trEnd < 0) continue;
    const trXml = tblXml.slice(trStart, trEnd + `</${trNs}:tr>`.length);

    // 타이틀 행 감지: 작성/검토/승인 결재 헤더 셀이 있는 행 → 제목+결재 행
    const rowTexts = hwpxExtractTexts(trXml);
    const approvalLabels = ['작성', '검토', '승인', '결재'];
    const hasApprovalCols = approvalLabels.filter(l => rowTexts.includes(l)).length >= 2;
    if (hasApprovalCols) {
      // 첫 번째 셀 전체 XML에서 rowSpan 추출
      const firstTcStart = trXml.search(/<(?:hp|hh):tc[\s>]/);
      const firstTcEnd = firstTcStart >= 0 ? trXml.indexOf('</hp:tc>', firstTcStart) : -1;
      const firstTcXml = firstTcEnd > 0 ? trXml.slice(firstTcStart, firstTcEnd + 8) : '';
      const firstRowSpan = parseInt(firstTcXml.match(/rowSpan="(\d+)"/)?.[1] ?? '1');
      skipRows = Math.max(0, firstRowSpan - 1);
      continue;
    }
    if (skipRows > 0) { skipRows--; continue; }

    // 셀 데이터 1차 수집
    const cellData: Array<{ paragraphs: string[] }> = [];
    const tcRe = /<(?:hp|hh):tc[\s>]/g;
    let tcM;
    while ((tcM = tcRe.exec(trXml)) !== null) {
      const tcStart = tcM.index;
      const tcNs = trXml.slice(tcStart + 1, tcStart + 3);
      const tcEnd = trXml.indexOf(`</${tcNs}:tc>`, tcStart);
      if (tcEnd < 0) continue;
      const tcXml = trXml.slice(tcStart, tcEnd + `</${tcNs}:tc>`.length);
      const pRe2 = /<(?:hp|hh):p[\s>][\s\S]*?<\/(?:hp|hh):p>/g;
      let pM2;
      const paragraphs: string[] = [];
      while ((pM2 = pRe2.exec(tcXml)) !== null) {
        const pTexts = hwpxExtractTexts(pM2[0]);
        if (pTexts.length > 0) paragraphs.push(pTexts.join(''));
      }
      cellData.push({ paragraphs });
    }

    // 셀 렌더링: 이전 셀 레이블 기반으로 값 셀 보정
    const cells: string[] = [];
    for (let i = 0; i < cellData.length; i++) {
      let { paragraphs } = cellData[i];
      const prevLabel = i > 0 ? cellData[i - 1].paragraphs.join('').replace(/\s/g, '') : '';

      // 작성일자 오른쪽 값 셀: 날짜만 (첫 단락만 표시)
      if (prevLabel === '작성일자' && paragraphs.length > 1) {
        paragraphs = [paragraphs[0]];
      }
      // 작성자 오른쪽 빈 셀: 로그인 사용자 이름 주입
      if (prevLabel === '작성자' && paragraphs.join('') === '' && signerName) {
        paragraphs = [escapeHtml(signerName)];
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

export function parseHwpxSection(xml: string, signerName?: string): string {
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
    result.push(hwpxRenderTable(xml.slice(range.s, range.e), signerName));
    cursor = range.e;
  }
  if (cursor < xml.length) processText(xml.slice(cursor));

  return result.join('');
}


/** Resolve and render before any Storage download. null preserves the legacy path. */
export async function renderLatestInputForm(options: {
  document: { title: string; content: string | null; template_id?: string | null };
  templateName?: string;
  theme: CorporateTheme;
  companyLogoSrc: string;
  companyLogoPatternSize: string;
  /** 작성자(담당) 서명 data URL. 미리보기 담당란에 표시한다. 미설정이면 빈칸. */
  authorSignatureSrc?: string;
}): Promise<RenderOutput | null> {
  const { document: doc } = options;
  const content = doc.content ?? '';
  const resolved = resolveDocumentInputForm({
    title: doc.title, templateId: doc.template_id, templateName: options.templateName, content,
  });
  if (!resolved.ok) return null;
  const parsed = parseEmbeddedInputs(content);
  if (!parsed.ok) return null;
  const builtin = resolveBuiltinTemplateBundleByName(resolved.form.templateName);
  if (!builtin) return null;
  // 증명서·근로계약서의 signature_image_src는 '회사 직인' 자리이므로 작성자 서명을 넣지 않는다.
  const isSealForm = isEmploymentCertificateTemplateName(resolved.form.templateName)
    || isStandardLaborContractTemplateName(resolved.form.templateName);
  const authorSig = options.authorSignatureSrc ?? '';
  return renderPdf(content.slice(parsed.prefix.length), doc.title, options.theme, {
    templateBundle: builtin.bundle,
    templateName: builtin.name,
    documentInputs: {
      ...parsed.inputs,
      // 미리보기 담당란에 작성자 본인 서명을 표시. 회사 직인(seal 양식)은 계속 제외.
      signature_image_src: isSealForm ? '' : authorSig,
      employee_signature_src: authorSig,
      company_logo_src: options.companyLogoSrc,
      company_logo_pattern_size: options.companyLogoPatternSize,
    },
  });
}

export async function renderStoredFilePreview(options: {
  fileBuffer: Buffer;
  ext: string;
  title: string;
  signerName: string;
  signatureBuffer: Buffer | null;
  appendedMarkdown: string;
}): Promise<Buffer> {
  const { fileBuffer, ext, title, signerName, signatureBuffer, appendedMarkdown } = options;
  // 파일 기반 문서 → 파일에서 텍스트 추출 후 HTML 렌더
  let extractedHtml = '';
  try {
    if (ext === 'docx') {
      const mammoth = await import('mammoth');
      const result = await mammoth.convertToHtml({ buffer: fileBuffer });
      extractedHtml = result.value;
    } else if (ext === 'hwpx') {
      const PizZip = (await import('pizzip')).default;
      const zip = new PizZip(fileBuffer);
      const allFiles = Object.keys(zip.files);
      const sectionFiles = allFiles
        .filter(name => /^Contents\/section\d+\.xml$/i.test(name))
        .sort();
      const sectionHtmlParts: string[] = [];
      for (const name of sectionFiles) {
        const xml = zip.file(name)?.asText() ?? '';
        sectionHtmlParts.push(parseHwpxSection(xml, signerName || undefined));
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

  const fileHtml = Buffer.from(`<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><style>body{font-family:'맑은 고딕',sans-serif;max-width:800px;margin:40px auto;padding:0 40px;font-size:13px;line-height:1.8;color:#1d1d1f;}h1{font-size:18px;font-weight:700;margin-bottom:24px;border-bottom:1px solid #e5e5e7;padding-bottom:12px;}p{margin:4px 0;}table{border-collapse:collapse;width:100%;margin:12px 0;}td,th{border:1px solid #ccc;padding:6px 10px;}</style></head><body><h1>${escapeHtml(title)}</h1>${bodyContent}${signatureBlock}</body></html>`, 'utf-8');

  return fileHtml;
}
