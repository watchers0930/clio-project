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
import type { RenderOutput, CorporateTheme } from './types';
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
  const children = markdownToDocxElements(markdown);

  const doc = new Document({
    sections: [{ properties: {}, children }],
    styles: {
      default: {
        document: {
          run: { font: fontFamily, size: theme.fontSize * 2 },
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

/** 마크다운 → docx Paragraph[] */
function markdownToDocxElements(md: string): (Paragraph | Table)[] {
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
      if (tableLines.length > 0) elements.push(parseTable(tableLines));
      continue;
    }

    if (line.startsWith('### ')) {
      elements.push(new Paragraph({ text: line.slice(4).trim(), heading: HeadingLevel.HEADING_3, spacing: { before: 240, after: 120 } }));
    } else if (line.startsWith('## ')) {
      elements.push(new Paragraph({ text: line.slice(3).trim(), heading: HeadingLevel.HEADING_2, spacing: { before: 360, after: 120 } }));
    } else if (line.startsWith('# ')) {
      elements.push(new Paragraph({ text: line.slice(2).trim(), heading: HeadingLevel.HEADING_1, spacing: { before: 480, after: 200 } }));
    } else if (/^[-*]\s/.test(line.trim())) {
      elements.push(new Paragraph({ children: parseInlineFormatting(line.trim().slice(2).trim()), bullet: { level: 0 }, spacing: { after: 60 } }));
    } else if (/^\d+\.\s/.test(line.trim())) {
      const text = line.trim().replace(/^\d+\.\s/, '');
      elements.push(new Paragraph({ children: parseInlineFormatting(text), spacing: { after: 60 } }));
    } else if (/^---+$/.test(line.trim())) {
      elements.push(new Paragraph({ children: [new TextRun({ text: '' })], border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC' } }, spacing: { before: 200, after: 200 } }));
    } else if (line.trim() === '') {
      elements.push(new Paragraph({ text: '' }));
    } else {
      elements.push(new Paragraph({ children: parseInlineFormatting(line), spacing: { after: 60 } }));
    }

    i++;
  }

  return elements;
}

function parseInlineFormatting(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|([^*`]+))/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match[2]) runs.push(new TextRun({ text: match[2], bold: true }));
    else if (match[3]) runs.push(new TextRun({ text: match[3], italics: true }));
    else if (match[4]) runs.push(new TextRun({ text: match[4], font: 'Consolas', size: 20 }));
    else if (match[5]) runs.push(new TextRun({ text: match[5] }));
  }

  if (runs.length === 0) runs.push(new TextRun({ text }));
  return runs;
}

function parseTable(tableLines: string[]): Table {
  const rows = tableLines.map((line, rowIdx) => {
    const cells = line.split('|').filter(c => c.trim() !== '').map(c => c.trim());
    return new TableRow({
      children: cells.map(cellText =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: cellText, bold: rowIdx === 0, size: 20 })], alignment: AlignmentType.CENTER })],
          width: { size: Math.floor(9000 / Math.max(cells.length, 1)), type: WidthType.DXA },
        }),
      ),
    });
  });

  return new Table({ rows, width: { size: 9000, type: WidthType.DXA } });
}
