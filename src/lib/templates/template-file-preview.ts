function normalizeOrdinals(text: string): string {
  return text.replace(
    /([^\n])\s*(첫째|둘째|셋째|넷째|다섯째|여섯째|일곱째|여덟째|아홉째|열째|마지막으로)[,，]/g,
    '$1\n$2,'
  );
}

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
    .filter((section) => section.title || section.lines.some((line) => line.trim()))
    .map(({ title, lines }) => {
      const contentHtml = lines
        .map((line) => line.trim() ? `<p style="margin:2px 0;">${line}</p>` : '')
        .join('');
      const tdStyle = 'border:1px solid #ccc;padding:5px 9px;vertical-align:top;font-size:13px;';
      const titleRow = title ? `<tr><td style="${tdStyle}font-weight:700;">${title}</td></tr>` : '';
      return `<table style="border-collapse:collapse;width:100%;margin:10px 0;">${titleRow}<tr><td style="${tdStyle}">${contentHtml}</td></tr></table>`;
    })
    .join('');
}

function hwpxExtractTexts(xml: string): string[] {
  const texts: string[] = [];
  const re = /<(?:hp|hh):t[^>]*>([^<]*)<\/(?:hp|hh):t>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null) {
    if (match[1].trim()) texts.push(match[1]);
  }
  return texts;
}

function hwpxRenderTable(tblXml: string): string {
  const allTexts = hwpxExtractTexts(tblXml);
  if (allTexts.some((text) => text.trim() === '(서명)' || text.trim() === '(인)' || text.trim() === '담당')) {
    return '';
  }

  const rows: string[] = [];
  const trRe = /<(?:hp|hh):tr[\s>]/g;
  let trMatch: RegExpExecArray | null;
  let skipRows = 0;

  while ((trMatch = trRe.exec(tblXml)) !== null) {
    const trStart = trMatch.index;
    const trNs = tblXml.slice(trStart + 1, trStart + 3);
    const trEnd = tblXml.indexOf(`</${trNs}:tr>`, trStart);
    if (trEnd < 0) continue;
    const trXml = tblXml.slice(trStart, trEnd + `</${trNs}:tr>`.length);

    const rowTexts = hwpxExtractTexts(trXml);
    const approvalLabels = ['작성', '검토', '승인', '결재'];
    const hasApprovalCols = approvalLabels.filter((label) => rowTexts.includes(label)).length >= 2;
    if (hasApprovalCols) {
      const firstTcStart = trXml.search(/<(?:hp|hh):tc[\s>]/);
      const firstTcEnd = firstTcStart >= 0 ? trXml.indexOf('</hp:tc>', firstTcStart) : -1;
      const firstTcXml = firstTcEnd > 0 ? trXml.slice(firstTcStart, firstTcEnd + 8) : '';
      const firstRowSpan = parseInt(firstTcXml.match(/rowSpan="(\d+)"/)?.[1] ?? '1', 10);
      skipRows = Math.max(0, firstRowSpan - 1);
      continue;
    }
    if (skipRows > 0) {
      skipRows -= 1;
      continue;
    }

    const cellData: Array<{ paragraphs: string[] }> = [];
    const tcRe = /<(?:hp|hh):tc[\s>]/g;
    let tcMatch: RegExpExecArray | null;
    while ((tcMatch = tcRe.exec(trXml)) !== null) {
      const tcStart = tcMatch.index;
      const tcNs = trXml.slice(tcStart + 1, tcStart + 3);
      const tcEnd = trXml.indexOf(`</${tcNs}:tc>`, tcStart);
      if (tcEnd < 0) continue;
      const tcXml = trXml.slice(tcStart, tcEnd + `</${tcNs}:tc>`.length);
      const pRe = /<(?:hp|hh):p[\s>][\s\S]*?<\/(?:hp|hh):p>/g;
      let pMatch: RegExpExecArray | null;
      const paragraphs: string[] = [];
      while ((pMatch = pRe.exec(tcXml)) !== null) {
        const texts = hwpxExtractTexts(pMatch[0]);
        if (texts.length > 0) paragraphs.push(texts.join(''));
      }
      cellData.push({ paragraphs });
    }

    const cells = cellData.map(({ paragraphs }) => {
      const cellText = paragraphs.join('');
      const cellHtml = paragraphs.join('<br>');
      const boldLabels = ['보고처', '보고서명', '취급', '회의일자', '회의 일자', '장소', '참석자', '정보(자료) 출처', '정보출처', '보고 내용과 의견', '보고내용과 의견', '문제점'];
      const isBold = boldLabels.some((label) => cellText.trim() === label || cellText.includes(label));
      const tdStyle = `border:1px solid #ccc;padding:5px 9px;vertical-align:top;font-size:13px;${isBold ? 'font-weight:700;' : ''}`;
      return `<td style="${tdStyle}">${cellHtml}</td>`;
    });

    if (cells.length > 0) rows.push(`<tr>${cells.join('')}</tr>`);
  }

  if (rows.length === 0) return '';
  return `<table style="border-collapse:collapse;width:100%;margin:10px 0;">${rows.join('')}</table>`;
}

function parseHwpxSection(xml: string): string {
  const result: string[] = [];
  type Range = { s: number; e: number };
  const tblRanges: Range[] = [];
  const tblTagRe = /<(hp|hh):tbl[\s>]/g;
  let match: RegExpExecArray | null;

  while ((match = tblTagRe.exec(xml)) !== null) {
    const ns = match[1];
    const startTag = `<${ns}:tbl`;
    const endTag = `</${ns}:tbl>`;
    if (tblRanges.some((range) => match!.index >= range.s && match!.index < range.e)) continue;

    let depth = 1;
    let pos = match.index + startTag.length;
    while (depth > 0 && pos < xml.length) {
      const nestedStart = xml.indexOf(startTag, pos);
      const nestedEnd = xml.indexOf(endTag, pos);
      if (nestedEnd < 0) {
        depth = 0;
        break;
      }
      if (nestedStart >= 0 && nestedStart < nestedEnd) {
        depth += 1;
        pos = nestedStart + startTag.length;
      } else {
        depth -= 1;
        pos = nestedEnd + endTag.length;
      }
    }
    if (pos > match.index) tblRanges.push({ s: match.index, e: pos });
  }

  tblRanges.sort((a, b) => a.s - b.s);

  let cursor = 0;
  const processText = (fragment: string) => {
    const pRe = /<(?:hp|hh):p[\s>][\s\S]*?<\/(?:hp|hh):p>/g;
    let pMatch: RegExpExecArray | null;
    while ((pMatch = pRe.exec(fragment)) !== null) {
      const texts = hwpxExtractTexts(pMatch[0]);
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

export async function extractTemplateFileInnerHtml(params: {
  buffer: Buffer;
  fileName: string;
  appendedMarkdown?: string;
}) {
  const { buffer, fileName, appendedMarkdown } = params;
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  let extractedHtml = '';

  if (ext === 'docx' || ext === 'dotx') {
    const mammoth = await import('mammoth');
    const result = await mammoth.convertToHtml({ buffer });
    extractedHtml = result.value;
  } else if (ext === 'hwpx') {
    const PizZip = (await import('pizzip')).default;
    const zip = new PizZip(buffer);
    const sectionFiles = Object.keys(zip.files)
      .filter((name) => /^Contents\/section\d+\.xml$/i.test(name))
      .sort();
    const sectionHtmlParts: string[] = [];
    for (const name of sectionFiles) {
      const xml = zip.file(name)?.asText() ?? '';
      sectionHtmlParts.push(parseHwpxSection(xml));
    }
    extractedHtml = sectionHtmlParts.join('');
  } else {
    extractedHtml = `<p style="color:#6e6e73;">이 파일(${ext.toUpperCase()})은 HTML 미리보기를 지원하지 않습니다.</p>`;
  }

  if (appendedMarkdown?.trim()) {
    extractedHtml += renderAppendedSections(appendedMarkdown.trim());
  }

  return extractedHtml;
}

export async function renderTemplateFilePreviewHtml(params: {
  buffer: Buffer;
  fileName: string;
  title: string;
  appendedMarkdown?: string;
}) {
  const { title } = params;
  const extractedHtml = await extractTemplateFileInnerHtml(params);

  return `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><style>body{font-family:'맑은 고딕',sans-serif;max-width:900px;margin:24px auto;padding:0 24px;font-size:13px;line-height:1.8;color:#1d1d1f;background:#fff;}h1{font-size:18px;font-weight:700;margin-bottom:24px;border-bottom:1px solid #e5e5e7;padding-bottom:12px;}p{margin:4px 0;}table{border-collapse:collapse;width:100%;margin:12px 0;}td,th{border:1px solid #ccc;padding:6px 10px;}img{max-width:100%;height:auto;}</style></head><body><h1>${title}</h1>${extractedHtml}</body></html>`;
}
