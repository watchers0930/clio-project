/**
 * DOCX 렌더러 — HTML → DOCX 변환 유틸
 */

import {
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
} from 'docx';
import type { TemplateBundle } from '@/lib/templates/template-schema';
import {
  labelCell,
  valueCell,
  decodeHtmlEntities,
  htmlToTextBlocks,
} from './shared';

/** layoutHtml의 <table>을 실제 DOCX 표로 변환 (td.label→라벨셀, colspan 반영) */
export function parseHtmlTableToDocx(
  tableHtml: string,
  fontFamily: string,
  fontSize: number,
): Table {
  const rows: TableRow[] = [];
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch: RegExpExecArray | null;
  while ((trMatch = trRegex.exec(tableHtml)) !== null) {
    const cells: TableCell[] = [];
    const tdRegex = /<t([dh])([^>]*)>([\s\S]*?)<\/t\1>/gi;
    let tdMatch: RegExpExecArray | null;
    while ((tdMatch = tdRegex.exec(trMatch[1])) !== null) {
      const attrs = tdMatch[2];
      const text = decodeHtmlEntities(tdMatch[3].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
      const colspan = parseInt(attrs.match(/colspan\s*=\s*"?(\d+)"?/i)?.[1] ?? '1', 10) || 1;
      const isLabel = /class\s*=\s*"[^"]*\blabel\b/i.test(attrs);
      cells.push(isLabel
        ? labelCell(text, fontFamily, fontSize, colspan)
        : valueCell(text, fontFamily, fontSize, colspan));
    }
    if (cells.length > 0) rows.push(new TableRow({ children: cells }));
  }
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows });
}

/** 비-table HTML 구간(h1/h2/h3/p)을 정렬·강조를 살려 문단으로 변환 */
export function htmlBlocksToParagraphs(
  htmlSegment: string,
  fontFamily: string,
  fontSize: number,
): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const blockRegex = /<(h1|h2|h3|p)([^>]*)>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(htmlSegment)) !== null) {
    const tag = match[1].toLowerCase();
    const attrs = match[2];
    const text = decodeHtmlEntities(match[3].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const isTitle = tag === 'h1';
    const isSectionTitle = tag === 'h2' || tag === 'h3';
    const isArticleHeading = /^제\s*\d+\s*조/.test(text);
    const centered = isTitle || /class\s*=\s*"[^"]*\b(title|statement|date|signer|approver)\b/i.test(attrs);
    paragraphs.push(new Paragraph({
      alignment: centered ? AlignmentType.CENTER : AlignmentType.LEFT,
      spacing: {
        before: isTitle ? 0 : isSectionTitle ? 240 : 120,
        after: isTitle ? 240 : isSectionTitle ? 120 : 100,
      },
      children: [new TextRun({
        text,
        bold: isTitle || isSectionTitle || isArticleHeading,
        size: isTitle ? fontSize + 12 : isSectionTitle ? fontSize + 2 : fontSize,
        font: fontFamily,
      })],
    }));
  }
  return paragraphs;
}

export function buildGenericHtmlTemplateDocxChildren(
  templateBundle: TemplateBundle,
  replacements: Record<string, string>,
  fontFamily: string,
  fontSize: number,
): (Paragraph | Table)[] {
  const interpolatedHtml = templateBundle.layoutHtml
    .replace(/\{\{([^}]+)\}\}/g, (_match, key: string) => replacements[key.trim()] ?? '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '');

  // 표가 있는 양식(재직증명서·휴가원 등): <table>은 DOCX 표로, 나머지는 문단으로 변환
  if (/<table[\s>]/i.test(interpolatedHtml)) {
    const elements: (Paragraph | Table)[] = [];
    const tableRegex = /<table[\s\S]*?<\/table>/gi;
    let lastIndex = 0;
    let tableMatch: RegExpExecArray | null;
    while ((tableMatch = tableRegex.exec(interpolatedHtml)) !== null) {
      elements.push(...htmlBlocksToParagraphs(interpolatedHtml.slice(lastIndex, tableMatch.index), fontFamily, fontSize));
      elements.push(parseHtmlTableToDocx(tableMatch[0], fontFamily, fontSize));
      lastIndex = tableRegex.lastIndex;
    }
    elements.push(...htmlBlocksToParagraphs(interpolatedHtml.slice(lastIndex), fontFamily, fontSize));
    return elements;
  }

  // 표가 없는 양식: 기존 텍스트 블록 방식 유지 (동작 불변)
  return htmlToTextBlocks(interpolatedHtml).map((line, index) => {
    const isTitle = index === 0 || /^(사업 협력을 위한|양해각서|업무협약서|MOU)/i.test(line);
    const isArticleHeading = /^제\s*\d+\s*조|^제\d+조/.test(line);
    const isBullet = line.startsWith('- ');
    return new Paragraph({
      alignment: isTitle ? AlignmentType.CENTER : AlignmentType.LEFT,
      spacing: { after: isArticleHeading || isTitle ? 180 : 100 },
      bullet: isBullet ? { level: 0 } : undefined,
      children: [
        new TextRun({
          text: isBullet ? line.slice(2) : line,
          bold: isTitle || isArticleHeading,
          size: isTitle ? fontSize + 8 : isArticleHeading ? fontSize + 2 : fontSize,
          font: fontFamily,
        }),
      ],
    });
  });
}
