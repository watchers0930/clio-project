/**
 * DOCX 렌더러 — 마크다운 → DOCX 변환
 * 기존 download/route.ts의 로직을 모듈화
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import type { TemplateBundle } from '@/lib/templates/template-schema';
import type { RenderOutput, CorporateTheme, DocxReplacement, DocxFormData, DocxTableCell, DocxTableStructure } from './types';
import { DEFAULT_THEME } from './types';
import { markdownToDocxElements } from './docx-markdown';
import { buildTemplateRenderData } from './template-render-data';
import { FONT_MAP, normalizeDocxPackage } from './docx/shared';
import { buildHtmlTemplateDocxChildren } from './docx/forms';
import {
  findTopLevelBlocks,
  extractCellText,
  extractGridSpan,
  isVMergeContinuation,
  replaceParagraphsByContains,
  injectPlaceholders,
} from './docx/template-utils';

export async function renderDocx(
  markdown: string,
  title: string,
  theme: CorporateTheme = DEFAULT_THEME,
  options?: {
    templateBundle?: TemplateBundle | null;
    documentInputs?: Record<string, string>;
  },
): Promise<RenderOutput> {
  const fontFamily = FONT_MAP[theme.fontFamily] ?? theme.fontFamilyEn;
  const fontSize = theme.fontSize * 2; // half-point 단위
  const children = options?.templateBundle
    ? buildTemplateDocxChildren(markdown, title, fontFamily, fontSize, options.templateBundle, options.documentInputs)
    : markdownToDocxElements(markdown, fontFamily, fontSize);

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

function buildTemplateDocxChildren(
  markdown: string,
  title: string,
  fontFamily: string,
  fontSize: number,
  templateBundle: TemplateBundle,
  documentInputs?: Record<string, string>,
) {
  // html-template 모드: 표지 테이블 + 섹션 페이지 구조
  if (templateBundle.mode === 'html-template' && templateBundle.layoutHtml) {
    return buildHtmlTemplateDocxChildren(markdown, title, fontFamily, fontSize, templateBundle, documentInputs);
  }

  const data = buildTemplateRenderData({ markdown, title, templateBundle, documentInputs });
  const children: Paragraph[] = [];
  const titleText = data.replacements.report_title || title;
  const metaParts = [
    data.replacements.author ? `작성자 ${data.replacements.author}` : '',
    data.replacements.report_date ? `작성일 ${data.replacements.report_date}` : '',
  ].filter(Boolean);

  children.push(new Paragraph({
    spacing: { after: 200 },
    children: [new TextRun({ text: titleText, bold: true, size: fontSize + 12, font: fontFamily })],
  }));

  if (!data.isWorklog && data.replacements.subtitle) {
    children.push(new Paragraph({
      spacing: { after: 160 },
      children: [new TextRun({ text: data.replacements.subtitle, italics: true, size: fontSize, font: fontFamily })],
    }));
  }

  if (metaParts.length > 0) {
    children.push(new Paragraph({
      spacing: { after: 240 },
      children: [new TextRun({ text: metaParts.join('  |  '), size: fontSize - 2, font: fontFamily })],
    }));
  }

  for (const section of data.sections) {
    children.push(new Paragraph({
      spacing: { before: 240, after: 120 },
      children: [new TextRun({ text: section.title, bold: true, size: fontSize + 4, font: fontFamily })],
    }));

    const body = section.bodyMarkdown.trim() || '[내용 없음]';
    const bodyChildren = markdownToDocxElements(body, fontFamily, fontSize) as Paragraph[];
    children.push(...bodyChildren);
  }

  return children;
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
  normalizeDocxPackage(zipAfter);
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

    // 빈 셀에 contextLabel 매핑 (row 0 포함 — 작성자 소속/직급/명 등 첫 행 빈칸도 감지)
    for (let r = 0; r < parsedRows.length; r++) {
      for (let c = 0; c < parsedRows[r].length; c++) {
        const cell = parsedRows[r][c];
        const leftNeighbor = c > 0 ? parsedRows[r][c - 1] : null;
        cell.contextLabel = (leftNeighbor && !leftNeighbor.isEmpty && leftNeighbor.text)
          ? leftNeighbor.text
          : (r > 0 ? (headers[c] ?? '') : '');
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

export function collapseWorklogNextPlanRows(docxBuffer: Buffer): Buffer {
  try {
    const zip = new PizZip(docxBuffer);
    const documentPath = 'word/document.xml';
    const docXml = zip.file(documentPath)?.asText();
    if (!docXml) return docxBuffer;

    const paragraphs = findTopLevelBlocks(docXml, 'w:p');
    const nextPlanParagraph = paragraphs.find((paragraph) => {
      const text = extractCellText(paragraph.content).replace(/\s+/g, '');
      return text.includes('차일업무계획');
    });
    if (!nextPlanParagraph) return docxBuffer;

    const tables = findTopLevelBlocks(docXml, 'w:tbl');
    const targetTable = tables.find((table) => {
      if (table.start < nextPlanParagraph.end) return false;
      const rows = findTopLevelBlocks(table.content, 'w:tr');
      if (rows.length < 3) return false;
      const firstRowTexts = findTopLevelBlocks(rows[0].content, 'w:tc')
        .map((cell) => extractCellText(cell.content).replace(/\s+/g, ''));
      return firstRowTexts.includes('번호') && firstRowTexts.includes('작업내용');
    });
    if (!targetTable) return docxBuffer;

    const rows = findTopLevelBlocks(targetTable.content, 'w:tr');
    if (rows.length <= 2) return docxBuffer;

    let nextTableXml = targetTable.content;
    for (let index = rows.length - 1; index >= 2; index--) {
      const row = rows[index];
      nextTableXml = nextTableXml.slice(0, row.start) + nextTableXml.slice(row.end);
    }

    const nextDocXml = docXml.slice(0, targetTable.start) + nextTableXml + docXml.slice(targetTable.end);
    zip.file(documentPath, nextDocXml);
    return Buffer.from(zip.generate({ type: 'nodebuffer' }));
  } catch (error) {
    console.error('[collapseWorklogNextPlanRows]', error);
    return docxBuffer;
  }
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
    const paragraphReplacements = Object.entries(extraReplacements).filter(([key, value]) => key.startsWith('__paragraph__:') && value);
    const textReplacements = Object.entries(extraReplacements).filter(([key, value]) => !key.startsWith('__paragraph__:') && key && value);
    for (const xmlPath of xmlFiles) {
      const file = zipAfter.file(xmlPath);
      if (!file) continue;
      let xmlContent = file.asText();
      for (const [oldText, newText] of textReplacements) {
        if (!oldText || !newText) continue;
        const escaped = oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        xmlContent = xmlContent.replace(new RegExp(escaped, 'g'), newText);
      }
      for (const [key, newText] of paragraphReplacements) {
        xmlContent = replaceParagraphsByContains(xmlContent, key.replace('__paragraph__:', ''), newText);
      }
      zipAfter.file(xmlPath, xmlContent);
    }
  }

  // 연락처 열 삭제 + 테이블 너비 100% 설정
  {
    const zz = doc.getZip();
    const dxf = zz.file('word/document.xml');
    if (dxf) {
      let dx = dxf.asText();
      const tables = findTopLevelBlocks(dx, 'w:tbl');
      for (let ti = tables.length - 1; ti >= 0; ti--) {
        const tbl = tables[ti];
        if (!tbl.content.includes('연락처')) continue;
        const rows = findTopLevelBlocks(tbl.content, 'w:tr');
        if (rows.length === 0) continue;
        const firstRowCells = findTopLevelBlocks(rows[0].content, 'w:tc');
        let colIdx = -1;
        for (let ci = 0; ci < firstRowCells.length; ci++) {
          if (extractCellText(firstRowCells[ci].content).includes('연락처')) { colIdx = ci; break; }
        }
        if (colIdx === -1) continue;
        // 각 행에서 해당 열의 셀 제거 (역순)
        let newTblContent = tbl.content;
        for (let ri = rows.length - 1; ri >= 0; ri--) {
          const rowCells = findTopLevelBlocks(rows[ri].content, 'w:tc');
          if (colIdx < rowCells.length) {
            const cellToRemove = rowCells[colIdx];
            const newRowContent = rows[ri].content.slice(0, cellToRemove.start) + rows[ri].content.slice(cellToRemove.end);
            newTblContent = newTblContent.slice(0, rows[ri].start) + newRowContent + newTblContent.slice(rows[ri].end);
          }
        }
        // gridCol 제거 (n번째 gridCol 삭제)
        const gridColRegex = /<w:gridCol[^/]*\/>/g;
        let gcIdx = 0;
        newTblContent = newTblContent.replace(gridColRegex, (match) => {
          return gcIdx++ === colIdx ? '' : match;
        });
        // 테이블 너비를 100%로 설정 (상단 테이블과 동일 너비)
        newTblContent = newTblContent.replace(/<w:tblW[^/]*\/>/, '<w:tblW w:w="5000" w:type="pct"/>');
        dx = dx.slice(0, tbl.start) + newTblContent + dx.slice(tbl.end);
      }
      // ── 1열 테이블: 빈 행 삭제 + 내용 행 높이 자동 맞춤 ──
      const allTables = findTopLevelBlocks(dx, 'w:tbl');
      for (let ti2 = allTables.length - 1; ti2 >= 0; ti2--) {
        const tbl2 = allTables[ti2];
        const rows2 = findTopLevelBlocks(tbl2.content, 'w:tr');
        if (rows2.length <= 1) continue;
        const firstRowCells2 = findTopLevelBlocks(rows2[0].content, 'w:tc');
        if (firstRowCells2.length > 1) continue;

        let modified2 = tbl2.content;
        for (let ri2 = rows2.length - 1; ri2 >= 1; ri2--) {
          const rowCells2 = findTopLevelBlocks(rows2[ri2].content, 'w:tc');
          const allEmpty2 = rowCells2.every(tc2 => {
            const txt = extractCellText(tc2.content);
            return txt.replace(/[\d.]/g, '').trim() === '';
          });
          if (allEmpty2) {
            // 빈 행 삭제
            modified2 = modified2.slice(0, rows2[ri2].start) + modified2.slice(rows2[ri2].end);
          } else {
            // 내용 있는 행: 고정 높이 제거 → 자동 맞춤
            const newRow = rows2[ri2].content.replace(
              /<w:trHeight[^/]*\/>/g, '<w:trHeight w:val="0" w:hRule="auto"/>'
            );
            if (newRow !== rows2[ri2].content) {
              modified2 = modified2.slice(0, rows2[ri2].start) + newRow + modified2.slice(rows2[ri2].end);
            }
          }
        }
        if (modified2 !== tbl2.content) {
          dx = dx.slice(0, tbl2.start) + modified2 + dx.slice(tbl2.end);
        }
      }

      zz.file('word/document.xml', dx);
    }
  }

  // 폰트를 페이퍼로지로 변경 (document.xml + styles.xml + theme)
  const zipFinal = doc.getZip();
  normalizeDocxPackage(zipFinal);
  const fontTargets = ['word/document.xml', 'word/styles.xml', 'word/theme/theme1.xml'];
  for (const xmlPath of fontTargets) {
    const f = zipFinal.file(xmlPath);
    if (!f) continue;
    let content = f.asText();
    content = content.replace(/w:eastAsia="[^"]*"/g, 'w:eastAsia="페이퍼로지"');
    content = content.replace(/w:hAnsi="[^"]*"/g, 'w:hAnsi="페이퍼로지"');
    content = content.replace(/w:ascii="[^"]*"/g, 'w:ascii="페이퍼로지"');
    content = content.replace(/w:cs="[^"]*"/g, 'w:cs="페이퍼로지"');
    // theme 폰트도 교체
    content = content.replace(/<a:latin typeface="[^"]*"/g, '<a:latin typeface="페이퍼로지"');
    content = content.replace(/<a:ea typeface="[^"]*"/g, '<a:ea typeface="페이퍼로지"');
    content = content.replace(/<a:cs typeface="[^"]*"/g, '<a:cs typeface="페이퍼로지"');
    zipFinal.file(xmlPath, content);
  }

  const buffer = Buffer.from(zipFinal.generate({ type: 'nodebuffer' }));

  return {
    buffer,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extension: 'docx',
    fileName: `${title}.docx`,
  };
}
