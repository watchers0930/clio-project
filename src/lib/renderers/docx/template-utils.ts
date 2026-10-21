/**
 * DOCX 렌더러 — 템플릿 XML 조작 유틸 (테이블 구조 분석 · placeholder 주입)
 */

import PizZip from 'pizzip';
import type { DocxTableStructure } from '../types';
import { escapeXmlText } from './shared';

// ─── DOCX 테이블 구조 분석 ─────────────────────────────────

/** XML에서 최상위 블록 태그 추출 (중첩 안전) */
export function findTopLevelBlocks(xml: string, tagName: string): { content: string; start: number; end: number }[] {
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
export function extractCellText(cellXml: string): string {
  const texts: string[] = [];
  const regex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let m;
  while ((m = regex.exec(cellXml)) !== null) {
    texts.push(m[1]);
  }
  return texts.join('').trim();
}

export function replaceParagraphsByContains(xmlContent: string, needle: string, replacement: string) {
  if (!needle) return xmlContent;
  const paragraphs = findTopLevelBlocks(xmlContent, 'w:p');
  let nextXml = xmlContent;

  for (let i = paragraphs.length - 1; i >= 0; i--) {
    const paragraph = paragraphs[i];
    const plainText = extractCellText(paragraph.content).replace(/\s+/g, ' ').trim();
    if (!plainText.includes(needle)) continue;

    const pPrMatch = paragraph.content.match(/<w:pPr[\s\S]*?<\/w:pPr>/);
    const pPr = pPrMatch ? pPrMatch[0] : '';
    const runXml = `<w:r><w:t xml:space="preserve">${escapeXmlText(replacement)}</w:t></w:r>`;
    const newParagraph = paragraph.content.replace(/<w:p[^>]*>[\s\S]*<\/w:p>/, (fullMatch) => {
      const openMatch = fullMatch.match(/^<w:p[^>]*>/)?.[0] ?? '<w:p>';
      return `${openMatch}${pPr}${runXml}</w:p>`;
    });

    nextXml = nextXml.slice(0, paragraph.start) + newParagraph + nextXml.slice(paragraph.end);
  }

  return nextXml;
}

/** w:tc 셀에서 gridSpan 추출 */
export function extractGridSpan(cellXml: string): number {
  const m = cellXml.match(/<w:gridSpan\s+w:val="(\d+)"/);
  return m ? parseInt(m[1], 10) : 1;
}

/** w:tc 셀이 vMerge 계속(continuation)인지 확인 */
export function isVMergeContinuation(cellXml: string): boolean {
  // <w:vMerge/> 또는 <w:vMerge w:val="continue"/> → 병합 계속
  // <w:vMerge w:val="restart"/> → 병합 시작 (= 실제 셀)
  if (!/<w:vMerge/.test(cellXml)) return false;
  return !/<w:vMerge\s+w:val="restart"/.test(cellXml);
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

    // 셀 수직 정렬을 상단(top)으로 강제 설정
    let cellXml = tc.content;
    if (/<w:vAlign[^/]*\/>/.test(cellXml)) {
      cellXml = cellXml.replace(/<w:vAlign[^/]*\/>/, '<w:vAlign w:val="top"/>');
    } else if (/<w:tcPr\/>/.test(cellXml)) {
      cellXml = cellXml.replace(/<w:tcPr\/>/, '<w:tcPr><w:vAlign w:val="top"/></w:tcPr>');
    } else if (/<w:tcPr>/.test(cellXml)) {
      cellXml = cellXml.replace(/<\/w:tcPr>/, '<w:vAlign w:val="top"/></w:tcPr>');
    } else {
      cellXml = cellXml.replace(/(<w:tc[^>]*>)/, '$1<w:tcPr><w:vAlign w:val="top"/></w:tcPr>');
    }

    // 셀 내 XML에서 빈 w:t에 placeholder 삽입
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
