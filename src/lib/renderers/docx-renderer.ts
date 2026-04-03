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
import type { RenderOutput, CorporateTheme, DocxReplacement } from './types';
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
