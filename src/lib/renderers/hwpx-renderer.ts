/**
 * HWPX 렌더러 — 마크다운 → HWPX (ZIP 패키지) 변환
 * adm-zip으로 section0.xml 직접 수정
 */

import type { RenderOutput, CorporateTheme, DocxTableCell, DocxTableStructure, DocxFormData } from './types';
import { DEFAULT_THEME } from './types';

const HWPX_FONT_MAP: Record<string, string> = {
  '맑은 고딕': 'Malgun Gothic',
  '나눔고딕': 'NanumGothic',
  '바탕': 'Batang',
  '돋움': 'Dotum',
  '굴림': 'Gulim',
  '나눔명조': 'NanumMyeongjo',
  'Arial': 'Arial',
  'Times New Roman': 'Times New Roman',
};

// 최소 HWPX 구조의 section0.xml 템플릿
function buildSectionXml(markdown: string, theme: CorporateTheme): string {
  const lines = markdown.split('\n');
  const paragraphs: string[] = [];
  const fontKo = theme.fontFamily;
  const fontEn = HWPX_FONT_MAP[theme.fontFamily] ?? theme.fontFamilyEn;
  const baseFontSize = theme.fontSize * 100; // HWPX: 100 = 1pt

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      paragraphs.push('<hp:p><hp:run><hp:char><hp:t> </hp:t></hp:char></hp:run></hp:p>');
      continue;
    }

    let text = trimmed;
    let bold = false;
    let fontSize = baseFontSize;

    if (trimmed.startsWith('# ')) {
      text = trimmed.slice(2);
      bold = true;
      fontSize = baseFontSize * 2;
    } else if (trimmed.startsWith('## ')) {
      text = trimmed.slice(3);
      bold = true;
      fontSize = Math.round(baseFontSize * 1.6);
    } else if (trimmed.startsWith('### ')) {
      text = trimmed.slice(4);
      bold = true;
      fontSize = Math.round(baseFontSize * 1.3);
    } else if (/^[-*]\s/.test(trimmed)) {
      text = `• ${trimmed.slice(2)}`;
    } else if (/^\d+\.\s/.test(trimmed)) {
      // 번호 리스트는 그대로 유지
    }

    // 마크다운 인라인 포맷 제거 (HWPX XML에서는 단순 텍스트로)
    text = text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1').replace(/`(.+?)`/g, '$1');
    // XML 이스케이프
    text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const charPrXml = `<hp:charPr>
      <hp:sz val="${fontSize}" />
      <hp:fontRef hangul="${fontKo}" latin="${fontEn}" hanja="${fontKo}" />
      ${bold ? '<hp:bold />' : ''}
    </hp:charPr>`;

    paragraphs.push(`<hp:p>
      <hp:run>
        ${charPrXml}
        <hp:char><hp:t>${text}</hp:t></hp:char>
      </hp:run>
    </hp:p>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<hp:sec xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph"
        xmlns:hp2="http://www.hancom.co.kr/hwpml/2011/core">
  <hp:subList>
    ${paragraphs.join('\n    ')}
  </hp:subList>
</hp:sec>`;
}

// 최소 HWPX 패키지 구조 생성
function buildMinimalHwpxPackage(): { path: string; content: string }[] {
  return [
    {
      path: '[Content_Types].xml',
      content: `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="xml" ContentType="application/xml" />
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />
  <Override PartName="/Contents/section0.xml" ContentType="application/xml" />
</Types>`,
    },
    {
      path: '_rels/.rels',
      content: `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://www.hancom.co.kr/hwpml/2011/relationship/document" Target="Contents/content.hpf" />
</Relationships>`,
    },
    {
      path: 'Contents/content.hpf',
      content: `<?xml version="1.0" encoding="UTF-8"?>
<hpf:package xmlns:hpf="http://www.hancom.co.kr/hwpml/2011/hpf">
  <hpf:sections>
    <hpf:section href="section0.xml" />
  </hpf:sections>
</hpf:package>`,
    },
  ];
}

export async function renderHwpx(
  markdown: string,
  title: string,
  theme: CorporateTheme = DEFAULT_THEME,
): Promise<RenderOutput> {
  const AdmZip = (await import('adm-zip')).default;
  const zip = new AdmZip();

  // 기본 패키지 파일 추가
  const packageFiles = buildMinimalHwpxPackage();
  for (const f of packageFiles) {
    zip.addFile(f.path, Buffer.from(f.content, 'utf-8'));
  }

  // section0.xml 생성
  const sectionXml = buildSectionXml(markdown, theme);
  zip.addFile('Contents/section0.xml', Buffer.from(sectionXml, 'utf-8'));

  const buffer = zip.toBuffer();

  return {
    buffer,
    mimeType: 'application/hwp+zip',
    extension: 'hwpx',
    fileName: `${title}.hwpx`,
  };
}

// ─── HWPX 테이블 구조 분석 (Form-Fill) ─────────────────────

/** XML에서 최상위 블록 태그 추출 (중첩 안전) */
function findBlocks(xml: string, tagName: string): { content: string; start: number; end: number }[] {
  const blocks: { content: string; start: number; end: number }[] = [];
  const openTag = `<${tagName}`;
  const closeTag = `</${tagName}>`;
  let pos = 0;
  while (pos < xml.length) {
    const start = xml.indexOf(openTag, pos);
    if (start === -1) break;
    let depth = 1;
    let scan = start + openTag.length;
    while (depth > 0 && scan < xml.length) {
      const nextOpen = xml.indexOf(openTag, scan);
      const nextClose = xml.indexOf(closeTag, scan);
      if (nextClose === -1) break;
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        scan = nextOpen + openTag.length;
      } else {
        depth--;
        scan = nextClose + closeTag.length;
      }
    }
    blocks.push({ content: xml.slice(start, scan), start, end: scan });
    pos = scan;
  }
  return blocks;
}

/** HWPX 셀에서 텍스트 추출 */
function extractHwpxCellText(cellXml: string): string {
  const texts: string[] = [];
  const regex = /<(?:hp:)?t[^>]*>([^<]*)<\/(?:hp:)?t>/g;
  let m;
  while ((m = regex.exec(cellXml)) !== null) {
    texts.push(m[1]);
  }
  return texts.join('').trim();
}

/** HWPX 셀에서 colSpan 추출 */
function extractHwpxColSpan(cellXml: string): number {
  const m = cellXml.match(/colSpan="(\d+)"/);
  return m ? parseInt(m[1], 10) : 1;
}

/** HWPX 템플릿 Buffer에서 테이블 구조 추출 */
export async function extractHwpxTableStructure(templateBuffer: Buffer): Promise<{ structure: DocxTableStructure; sectionXml: string; sectionPath: string } | null> {
  const AdmZip = (await import('adm-zip')).default;
  // Buffer를 Uint8Array로 완전 복사 후 새 Buffer 생성 (Node.js Buffer pool 회피)
  const arr = new Uint8Array(templateBuffer.length);
  for (let i = 0; i < templateBuffer.length; i++) arr[i] = templateBuffer[i];
  const safeBuf = Buffer.from(arr);
  console.log(`[extractHwpxTableStructure] buffer size: ${safeBuf.length}, first4: ${safeBuf.slice(0, 4).toString('hex')}, isZip: ${safeBuf[0] === 0x50 && safeBuf[1] === 0x4b}`);
  if (safeBuf.length === 0) return null;
  const zip = new AdmZip(safeBuf);
  const entries = zip.getEntries();

  const sectionEntry = entries.find((e: { entryName: string }) =>
    /^Contents\/section\d+\.xml$/i.test(e.entryName)
  );
  if (!sectionEntry) return null;

  const sectionXml = sectionEntry.getData().toString('utf-8');
  const sectionPath = sectionEntry.entryName;

  // hp:tbl 태그로 테이블 찾기 (네임스페이스 있는/없는 경우 모두)
  const tblTag = sectionXml.includes('<hp:tbl') ? 'hp:tbl' : 'tbl';
  const trTag = sectionXml.includes('<hp:tr') ? 'hp:tr' : 'tr';
  const tcTag = sectionXml.includes('<hp:tc') ? 'hp:tc' : 'tc';

  const tables = findBlocks(sectionXml, tblTag);
  if (tables.length === 0) return null;

  const result: DocxTableStructure = { tables: [], emptyCells: [], hasEmptyCells: false };

  tables.forEach((tbl, tableIndex) => {
    const tblRows = findBlocks(tbl.content, trTag);
    const parsedRows: DocxTableCell[][] = [];
    let headers: string[] = [];

    tblRows.forEach((tr, rowIndex) => {
      const tblCells = findBlocks(tr.content, tcTag);
      const row: DocxTableCell[] = [];

      tblCells.forEach((tc, colIndex) => {
        const text = extractHwpxCellText(tc.content);
        const gridSpan = extractHwpxColSpan(tc.content);
        const isEmpty = text.replace(/[\d.]/g, '').trim() === '';

        row.push({
          fieldId: `field_${tableIndex}_${rowIndex}_${colIndex}`,
          tableIndex, rowIndex, colIndex,
          isEmpty, text, contextLabel: '', gridSpan,
        });
      });

      if (rowIndex === 0) headers = row.map(c => c.text);
      parsedRows.push(row);
    });

    for (let r = 1; r < parsedRows.length; r++) {
      for (let c = 0; c < parsedRows[r].length; c++) {
        const cell = parsedRows[r][c];
        cell.contextLabel = headers[c] ?? '';
        if (cell.isEmpty) result.emptyCells.push(cell);
      }
    }

    result.tables.push({ tableIndex, headers, rows: parsedRows });
  });

  result.hasEmptyCells = result.emptyCells.length > 0;
  return { structure: result, sectionXml, sectionPath };
}

/** HWPX 템플릿의 빈 셀에 내용을 채운 렌더링 */
export async function renderHwpxFromFormData(
  templateBuffer: Buffer,
  formData: DocxFormData,
  structure: DocxTableStructure,
  title: string,
): Promise<RenderOutput> {
  const AdmZip = (await import('adm-zip')).default;
  const arr2 = new Uint8Array(templateBuffer.length);
  for (let i = 0; i < templateBuffer.length; i++) arr2[i] = templateBuffer[i];
  const safeBuf2 = Buffer.from(arr2);
  const zip = new AdmZip(safeBuf2);
  const entries = zip.getEntries();

  const sectionEntry = entries.find((e: { entryName: string }) =>
    /^Contents\/section\d+\.xml$/i.test(e.entryName)
  );
  if (!sectionEntry) throw new Error('HWPX section XML을 찾을 수 없습니다.');

  let xml = sectionEntry.getData().toString('utf-8');
  const tblTag = xml.includes('<hp:tbl') ? 'hp:tbl' : 'tbl';
  const trTag = xml.includes('<hp:tr') ? 'hp:tr' : 'tr';
  const tcTag = xml.includes('<hp:tc') ? 'hp:tc' : 'tc';
  const tTag = xml.includes('<hp:t') ? 'hp:t' : 't';

  // 역순으로 빈 셀에 내용 직접 주입 (플레이스홀더 단계 불필요)
  const sortedCells = [...structure.emptyCells].sort((a, b) => {
    if (a.tableIndex !== b.tableIndex) return b.tableIndex - a.tableIndex;
    if (a.rowIndex !== b.rowIndex) return b.rowIndex - a.rowIndex;
    return b.colIndex - a.colIndex;
  });

  const tblBlocks = findBlocks(xml, tblTag);

  for (const cell of sortedCells) {
    const content = formData[cell.fieldId] ?? '';
    if (!content) continue;

    const escaped = content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const tbl = tblBlocks[cell.tableIndex];
    if (!tbl) continue;
    const rows = findBlocks(tbl.content, trTag);
    const row = rows[cell.rowIndex];
    if (!row) continue;
    const cells = findBlocks(row.content, tcTag);
    const tc = cells[cell.colIndex];
    if (!tc) continue;

    let cellXml = tc.content;
    const tRegex = new RegExp(`<${tTag}([^>]*)>([^<]*)</${tTag}>`);

    if (tRegex.test(cellXml)) {
      // 기존 빈 <hp:t>에 내용 삽입
      let replaced = false;
      cellXml = cellXml.replace(tRegex, (match, attrs, text) => {
        if (!replaced && text.replace(/[\d.]/g, '').trim() === '') {
          replaced = true;
          return `<${tTag}${attrs}>${escaped}</${tTag}>`;
        }
        return match;
      });
    } else {
      // <hp:t> 없으면 셀 끝에 paragraph 추가
      const closeTag = `</${tcTag}>`;
      cellXml = cellXml.replace(
        new RegExp(`${closeTag.replace(/[/]/g, '\\/')}$`),
        `<hp:p><hp:run><hp:char><${tTag}>${escaped}</${tTag}></hp:char></hp:run></hp:p>${closeTag}`,
      );
    }

    const absStart = tbl.start + row.start + tc.start;
    const absEnd = tbl.start + row.start + tc.end;
    xml = xml.slice(0, absStart) + cellXml + xml.slice(absEnd);
  }

  zip.updateFile(sectionEntry.entryName, Buffer.from(xml, 'utf-8'));
  const buffer = zip.toBuffer();

  return {
    buffer,
    mimeType: 'application/hwp+zip',
    extension: 'hwpx',
    fileName: `${title}.hwpx`,
  };
}
