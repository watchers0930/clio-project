/**
 * DOCX 렌더러 — 마크다운 → DOCX 변환
 * 기존 download/route.ts의 로직을 모듈화
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  TableRow,
  TableCell,
  Table,
  WidthType,
  BorderStyle,
} from 'docx';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import type { RenderOutput, CorporateTheme, DocxReplacement, DocxFormData, DocxTableCell, DocxTableStructure } from './types';
import { DEFAULT_THEME } from './types';

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

export async function renderDocx(
  markdown: string,
  title: string,
  theme: CorporateTheme = DEFAULT_THEME,
): Promise<RenderOutput> {
  const fontFamily = FONT_MAP[theme.fontFamily] ?? theme.fontFamilyEn;
  const fontSize = theme.fontSize * 2; // half-point 단위
  const children = markdownToDocxElements(markdown, fontFamily, fontSize);

  const doc = new Document({
    sections: [{ properties: {}, children }],
    styles: {
      default: {
        document: {
          run: { font: fontFamily, size: fontSize },
        },
        heading1: {
          run: { font: fontFamily },
        },
        heading2: {
          run: { font: fontFamily },
        },
        heading3: {
          run: { font: fontFamily },
        },
      },
    },
  });

  const buffer = Buffer.from(await Packer.toBuffer(doc));

  return {
    buffer,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extension: 'docx',
    fileName: `${title}.docx`,
  };
}

export async function renderDocxFromTemplate(
  templateBuffer: Buffer,
  replacements: DocxReplacement,
  title: string,
): Promise<RenderOutput> {
  const zip = new PizZip(templateBuffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{{', end: '}}' },
  });

  // 1단계: docxtemplater 플레이스홀더 치환 ({{key}} 형식이 있는 경우)
  try {
    doc.render(replacements);
  } catch {
    // 플레이스홀더가 없어도 무시 (2단계에서 텍스트 치환)
  }

  // 2단계: XML 직접 텍스트 치환 (빈칸, _____, ( ) 등)
  const zipAfter = doc.getZip();
  const xmlFiles = ['word/document.xml', 'word/header1.xml', 'word/header2.xml', 'word/footer1.xml', 'word/footer2.xml'];

  for (const xmlPath of xmlFiles) {
    const file = zipAfter.file(xmlPath);
    if (!file) continue;
    let xml = file.asText();
    for (const [oldText, newText] of Object.entries(replacements)) {
      if (!oldText || !newText) continue;
      // XML 내 w:t 태그 사이의 텍스트에서 치환
      const escaped = oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      xml = xml.replace(new RegExp(escaped, 'g'), newText);
    }
    zipAfter.file(xmlPath, xml);
  }

  const buffer = Buffer.from(zipAfter.generate({ type: 'nodebuffer' }));

  return {
    buffer,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extension: 'docx',
    fileName: `${title}.docx`,
  };
}

// ─── DOCX 테이블 구조 분석 ─────────────────────────────────

/** XML에서 최상위 블록 태그 추출 (중첩 안전) */
function findTopLevelBlocks(xml: string, tagName: string): { content: string; start: number; end: number }[] {
  const blocks: { content: string; start: number; end: number }[] = [];
  const openTag = `<${tagName}`;
  const closeTag = `</${tagName}>`;

  // 정확한 태그만 매칭하는 헬퍼 (예: <w:tbl> 또는 <w:tbl ... 은 매칭, <w:tblPr 은 무시)
  function findExactTag(src: string, from: number): number {
    let idx = from;
    while (idx < src.length) {
      const found = src.indexOf(openTag, idx);
      if (found === -1) return -1;
      const afterChar = src[found + openTag.length];
      if (afterChar === '>' || afterChar === ' ' || afterChar === '/' || afterChar === '\n' || afterChar === '\r') {
        return found;
      }
      idx = found + 1;
    }
    return -1;
  }

  let pos = 0;
  while (pos < xml.length) {
    const start = findExactTag(xml, pos);
    if (start === -1) break;
    let depth = 1;
    let scan = start + openTag.length;
    while (depth > 0 && scan < xml.length) {
      const nextOpen = findExactTag(xml, scan);
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

/** w:tc 셀에서 텍스트 추출 */
function extractCellText(cellXml: string): string {
  const texts: string[] = [];
  const regex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let m;
  while ((m = regex.exec(cellXml)) !== null) {
    texts.push(m[1]);
  }
  return texts.join('').trim();
}

/** w:tc 셀에서 gridSpan 추출 */
function extractGridSpan(cellXml: string): number {
  const m = cellXml.match(/<w:gridSpan\s+w:val="(\d+)"/);
  return m ? parseInt(m[1], 10) : 1;
}

/** w:tc 셀이 vMerge 계속(continuation)인지 확인 */
function isVMergeContinuation(cellXml: string): boolean {
  // <w:vMerge/> 또는 <w:vMerge w:val="continue"/> → 병합 계속
  // <w:vMerge w:val="restart"/> → 병합 시작 (= 실제 셀)
  if (!/<w:vMerge/.test(cellXml)) return false;
  return !/<w:vMerge\s+w:val="restart"/.test(cellXml);
}

/** DOCX 템플릿 Buffer에서 테이블 구조 추출 */
export function extractDocxTableStructure(templateBuffer: Buffer): DocxTableStructure {
  const zip = new PizZip(templateBuffer);
  const docXml = zip.file('word/document.xml')?.asText() ?? '';

  const tables = findTopLevelBlocks(docXml, 'w:tbl');
  const result: DocxTableStructure = { tables: [], emptyCells: [], hasEmptyCells: false };

  tables.forEach((tbl, tableIndex) => {
    const tblRows = findTopLevelBlocks(tbl.content, 'w:tr');
    const parsedRows: DocxTableCell[][] = [];
    let headers: string[] = [];

    tblRows.forEach((tr, rowIndex) => {
      const tblCells = findTopLevelBlocks(tr.content, 'w:tc');
      const row: DocxTableCell[] = [];

      tblCells.forEach((tc, colIndex) => {
        if (isVMergeContinuation(tc.content)) return; // 병합 계속은 건너뜀

        const text = extractCellText(tc.content);
        const gridSpan = extractGridSpan(tc.content);
        const isEmpty = text.replace(/[\d.]/g, '').trim() === ''; // 숫자/마침표만 있으면 빈칸 취급

        const cell: DocxTableCell = {
          fieldId: `field_${tableIndex}_${rowIndex}_${colIndex}`,
          tableIndex,
          rowIndex,
          colIndex,
          isEmpty,
          text,
          contextLabel: '',
          gridSpan,
        };
        row.push(cell);
      });

      // 첫 행을 헤더로 인식
      if (rowIndex === 0) {
        headers = row.map(c => c.text);
      }

      parsedRows.push(row);
    });

    // 빈 셀에 contextLabel 매핑 (왼쪽 이웃 셀 우선, 없으면 헤더)
    for (let r = 1; r < parsedRows.length; r++) {
      for (let c = 0; c < parsedRows[r].length; c++) {
        const cell = parsedRows[r][c];
        const leftNeighbor = c > 0 ? parsedRows[r][c - 1] : null;
        cell.contextLabel = (leftNeighbor && !leftNeighbor.isEmpty && leftNeighbor.text)
          ? leftNeighbor.text
          : (headers[c] ?? '');
        if (cell.isEmpty) {
          result.emptyCells.push(cell);
        }
      }
    }

    result.tables.push({ tableIndex, headers, rows: parsedRows });
  });

  result.hasEmptyCells = result.emptyCells.length > 0;
  return result;
}

// ─── Placeholder 주입 ───────────────────────────────────────

/** 빈 셀에 {{field_T_R_C}} placeholder를 주입한 DOCX Buffer 반환 */
export function injectPlaceholders(
  templateBuffer: Buffer,
  structure: DocxTableStructure,
): { modifiedBuffer: Buffer; placeholderMap: Record<string, string> } {
  const zip = new PizZip(templateBuffer);
  let xml = zip.file('word/document.xml')?.asText() ?? '';
  const placeholderMap: Record<string, string> = {};

  // 역순 처리 (뒤에서부터 삽입해야 앞쪽 위치가 안 밀림)
  const sortedCells = [...structure.emptyCells].sort((a, b) => {
    if (a.tableIndex !== b.tableIndex) return b.tableIndex - a.tableIndex;
    if (a.rowIndex !== b.rowIndex) return b.rowIndex - a.rowIndex;
    return b.colIndex - a.colIndex;
  });

  // 테이블/행/셀을 순서대로 찾아 위치 특정
  const tblBlocks = findTopLevelBlocks(xml, 'w:tbl');

  for (const cell of sortedCells) {
    const tbl = tblBlocks[cell.tableIndex];
    if (!tbl) continue;

    const rows = findTopLevelBlocks(tbl.content, 'w:tr');
    const row = rows[cell.rowIndex];
    if (!row) continue;

    const cells = findTopLevelBlocks(row.content, 'w:tc');
    const tc = cells[cell.colIndex];
    if (!tc) continue;

    const placeholder = `{{${cell.fieldId}}}`;
    placeholderMap[cell.fieldId] = cell.contextLabel || `행${cell.rowIndex}_열${cell.colIndex}`;

    // 셀 내 XML에서 빈 w:t에 placeholder 삽입
    let cellXml = tc.content;
    const hasRunWithText = /<w:r[^>]*>[\s\S]*?<w:t[^>]*>[^<]*<\/w:t>[\s\S]*?<\/w:r>/.test(cellXml);

    if (hasRunWithText) {
      // 기존 텍스트를 placeholder로 교체 (첫 번째 w:t만)
      let replaced = false;
      cellXml = cellXml.replace(/<w:t([^>]*)>([^<]*)<\/w:t>/, (_match, attrs) => {
        if (!replaced) {
          replaced = true;
          return `<w:t${attrs}>${placeholder}</w:t>`;
        }
        return _match;
      });
    } else {
      // w:r이 없으면 </w:p> 앞에 삽입
      cellXml = cellXml.replace(
        /<\/w:p>/,
        `<w:r><w:t xml:space="preserve">${placeholder}</w:t></w:r></w:p>`,
      );
    }

    // 원본 XML에서 해당 셀 영역 교체 (절대 위치 사용)
    const absStart = tbl.start + row.start + tc.start;
    const absEnd = tbl.start + row.start + tc.end;
    xml = xml.slice(0, absStart) + cellXml + xml.slice(absEnd);
  }

  zip.file('word/document.xml', xml);
  const modifiedBuffer = Buffer.from(zip.generate({ type: 'nodebuffer' }));
  return { modifiedBuffer, placeholderMap };
}

// ─── FormData 기반 렌더링 ───────────────────────────────────

/** 빈 셀에 AI 생성 내용을 채운 DOCX 렌더링 */
export async function renderDocxFromFormData(
  templateBuffer: Buffer,
  formData: DocxFormData,
  tableStructure: DocxTableStructure,
  title: string,
  extraReplacements?: DocxReplacement,
): Promise<RenderOutput> {
  const { modifiedBuffer } = injectPlaceholders(templateBuffer, tableStructure);

  const zip = new PizZip(modifiedBuffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{{', end: '}}' },
  });

  try {
    doc.render(formData);
  } catch (e) {
    console.error('[renderDocxFromFormData] docxtemplater render error:', e);
  }

  // 추가 텍스트 치환 (비테이블 영역)
  if (extraReplacements && Object.keys(extraReplacements).length > 0) {
    const zipAfter = doc.getZip();
    const xmlFiles = ['word/document.xml', 'word/header1.xml', 'word/header2.xml', 'word/footer1.xml', 'word/footer2.xml'];
    for (const xmlPath of xmlFiles) {
      const file = zipAfter.file(xmlPath);
      if (!file) continue;
      let xmlContent = file.asText();
      for (const [oldText, newText] of Object.entries(extraReplacements)) {
        if (!oldText || !newText) continue;
        const escaped = oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        xmlContent = xmlContent.replace(new RegExp(escaped, 'g'), newText);
      }
      zipAfter.file(xmlPath, xmlContent);
    }
  }

  // 폰트를 페이퍼로지로 변경
  const zipFinal = doc.getZip();
  const docXmlPath = 'word/document.xml';
  const docFile = zipFinal.file(docXmlPath);
  if (docFile) {
    let docXml = docFile.asText();
    // eastAsia, hAnsi, ascii 폰트를 페이퍼로지로 교체
    docXml = docXml.replace(/w:eastAsia="[^"]*"/g, 'w:eastAsia="페이퍼로지"');
    docXml = docXml.replace(/w:hAnsi="[^"]*"/g, 'w:hAnsi="페이퍼로지"');
    docXml = docXml.replace(/w:ascii="[^"]*"/g, 'w:ascii="페이퍼로지"');
    zipFinal.file(docXmlPath, docXml);
  }

  const buffer = Buffer.from(zipFinal.generate({ type: 'nodebuffer' }));

  return {
    buffer,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extension: 'docx',
    fileName: `${title}.docx`,
  };
}

/** 마크다운 → docx Paragraph[] */
function markdownToDocxElements(md: string, fontFamily: string, fontSize: number): (Paragraph | Table)[] {
  const lines = md.split('\n');
  const elements: (Paragraph | Table)[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 테이블
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        if (!/^\|[\s\-:|]+\|$/.test(lines[i].trim())) {
          tableLines.push(lines[i]);
        }
        i++;
      }
      if (tableLines.length > 0) elements.push(parseTable(tableLines, fontFamily, fontSize));
      continue;
    }

    if (line.startsWith('### ')) {
      elements.push(new Paragraph({ children: [new TextRun({ text: line.slice(4).trim(), font: fontFamily, bold: true })], heading: HeadingLevel.HEADING_3, spacing: { before: 240, after: 120 } }));
    } else if (line.startsWith('## ')) {
      elements.push(new Paragraph({ children: [new TextRun({ text: line.slice(3).trim(), font: fontFamily, bold: true })], heading: HeadingLevel.HEADING_2, spacing: { before: 360, after: 120 } }));
    } else if (line.startsWith('# ')) {
      elements.push(new Paragraph({ children: [new TextRun({ text: line.slice(2).trim(), font: fontFamily, bold: true })], heading: HeadingLevel.HEADING_1, spacing: { before: 480, after: 200 } }));
    } else if (/^[-*]\s/.test(line.trim())) {
      elements.push(new Paragraph({ children: parseInlineFormatting(line.trim().slice(2).trim(), fontFamily, fontSize), bullet: { level: 0 }, spacing: { after: 60 } }));
    } else if (/^\d+\.\s/.test(line.trim())) {
      const text = line.trim().replace(/^\d+\.\s/, '');
      elements.push(new Paragraph({ children: parseInlineFormatting(text, fontFamily, fontSize), spacing: { after: 60 } }));
    } else if (/^---+$/.test(line.trim())) {
      elements.push(new Paragraph({ children: [new TextRun({ text: '', font: fontFamily })], border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC' } }, spacing: { before: 200, after: 200 } }));
    } else if (line.trim() === '') {
      elements.push(new Paragraph({ children: [new TextRun({ text: '', font: fontFamily })] }));
    } else {
      elements.push(new Paragraph({ children: parseInlineFormatting(line, fontFamily, fontSize), spacing: { after: 60 } }));
    }

    i++;
  }

  return elements;
}

function parseInlineFormatting(text: string, fontFamily: string, fontSize: number): TextRun[] {
  const runs: TextRun[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|([^*`]+))/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match[2]) runs.push(new TextRun({ text: match[2], bold: true, font: fontFamily, size: fontSize }));
    else if (match[3]) runs.push(new TextRun({ text: match[3], italics: true, font: fontFamily, size: fontSize }));
    else if (match[4]) runs.push(new TextRun({ text: match[4], font: 'Consolas', size: fontSize }));
    else if (match[5]) runs.push(new TextRun({ text: match[5], font: fontFamily, size: fontSize }));
  }

  if (runs.length === 0) runs.push(new TextRun({ text, font: fontFamily, size: fontSize }));
  return runs;
}

function parseTable(tableLines: string[], fontFamily: string, fontSize: number): Table {
  const rows = tableLines.map((line, rowIdx) => {
    const cells = line.split('|').filter(c => c.trim() !== '').map(c => c.trim());
    return new TableRow({
      children: cells.map(cellText =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: cellText, bold: rowIdx === 0, size: fontSize, font: fontFamily })], alignment: AlignmentType.CENTER })],
          width: { size: Math.floor(9000 / Math.max(cells.length, 1)), type: WidthType.DXA },
        }),
      ),
    });
  });

  return new Table({ rows, width: { size: 9000, type: WidthType.DXA } });
}
