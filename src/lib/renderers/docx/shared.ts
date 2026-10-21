/**
 * DOCX 렌더러 — 공통 상수 및 헬퍼
 */

import {
  Paragraph,
  TextRun,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  ShadingType,
  ImageRun,
  VerticalAlign,
} from 'docx';
import PizZip from 'pizzip';

export const FONT_MAP: Record<string, string> = {
  '맑은 고딕': 'Malgun Gothic',
  '나눔고딕': 'NanumGothic',
  '바탕': 'Batang',
  '돋움': 'Dotum',
  '굴림': 'Gulim',
  '나눔명조': 'NanumMyeongjo',
  'Arial': 'Arial',
  'Times New Roman': 'Times New Roman',
};

export function normalizeDocxPackage(zip: PizZip) {
  const contentTypesPath = '[Content_Types].xml';
  const contentTypesXml = zip.file(contentTypesPath)?.asText();
  if (!contentTypesXml) return;

  const normalizedXml = contentTypesXml
    .replace(
      /application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.template\.main\+xml/g,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml',
    )
    .replace(
      /application\/vnd\.ms-word\.template\.macroEnabled\.main\+xml/g,
      'application/vnd.ms-word.document.macroEnabled.main+xml',
    );

  if (normalizedXml !== contentTypesXml) {
    zip.file(contentTypesPath, normalizedXml);
  }
}

// ─── HTML 템플릿 → DOCX 구조 변환 ─────────────────────────────
export const LABEL_SHADING = { type: ShadingType.CLEAR, color: 'auto', fill: 'F5F5F5' };
export const THIN_BORDER = { style: BorderStyle.SINGLE, size: 1, color: '000000' };
export const ALL_BORDERS = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER };

export function labelCell(text: string, fontFamily: string, fontSize: number, columnSpan = 1, width?: number): TableCell {
  return new TableCell({
    columnSpan,
    shading: LABEL_SHADING,
    borders: ALL_BORDERS,
    ...(width ? { width: { size: width, type: WidthType.DXA } } : {}),
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, bold: true, size: fontSize, font: fontFamily })],
    })],
  });
}

export function valueCell(text: string, fontFamily: string, fontSize: number, columnSpan = 1): TableCell {
  const lines = (text || '').split('\n');
  return new TableCell({
    columnSpan,
    borders: ALL_BORDERS,
    children: lines.map((line) => new Paragraph({
      spacing: { after: 80 },
      children: [new TextRun({ text: line, size: fontSize, font: fontFamily })],
    })),
  });
}

// ─── 휴가원·품의서·주간업무·회의록 공유 셀 헬퍼 ─────────────────────────────
export const LEAVE_CELL_MARGINS = { top: 80, bottom: 80, left: 140, right: 140 };

export function leaveLabelCell(
  text: string,
  ff: string,
  fs: number,
  colspan = 1,
  widthPct?: number,
  vAlign: typeof VerticalAlign.CENTER | typeof VerticalAlign.TOP | typeof VerticalAlign.BOTTOM = VerticalAlign.CENTER,
): TableCell {
  return new TableCell({
    columnSpan: colspan,
    ...(widthPct ? { width: { size: widthPct, type: WidthType.PERCENTAGE } } : {}),
    shading: LABEL_SHADING,
    borders: ALL_BORDERS,
    margins: LEAVE_CELL_MARGINS,
    verticalAlign: vAlign,
    children: [new Paragraph({
      alignment: AlignmentType.LEFT,
      children: [new TextRun({ text, bold: true, size: fs, font: ff })],
    })],
  });
}

export function leaveValueCell(
  text: string,
  ff: string,
  fs: number,
  colspan = 1,
  widthPct?: number,
  vAlign: typeof VerticalAlign.CENTER | typeof VerticalAlign.TOP | typeof VerticalAlign.BOTTOM = VerticalAlign.CENTER,
): TableCell {
  const lines = (text || '').split('\n');
  return new TableCell({
    columnSpan: colspan,
    ...(widthPct ? { width: { size: widthPct, type: WidthType.PERCENTAGE } } : {}),
    borders: ALL_BORDERS,
    margins: LEAVE_CELL_MARGINS,
    verticalAlign: vAlign,
    children: lines.map((line) => new Paragraph({ children: [new TextRun({ text: line, size: fs, font: ff })] })),
  });
}

// ─── 품의서·주간업무·회의록 공유 결재란 헬퍼 ─────────────────────────────
export function approvalSignParagraph(signatureDataUrl: string | undefined): Paragraph {
  if (signatureDataUrl && signatureDataUrl.startsWith('data:image')) {
    const base64 = signatureDataUrl.split(',')[1] ?? '';
    if (base64) {
      try {
        return new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new ImageRun({
            type: /^data:image\/png/i.test(signatureDataUrl) ? 'png' : 'jpg',
            data: Buffer.from(base64, 'base64'),
            transformation: { width: 68, height: 34 },
          })],
        });
      } catch {
        // 실패 시 빈 칸
      }
    }
  }
  return new Paragraph({ children: [new TextRun({ text: '' })] });
}

export function approvalBoxLabelCell(text: string, ff: string, fs: number, widthPct?: number): TableCell {
  return new TableCell({
    ...(widthPct ? { width: { size: widthPct, type: WidthType.PERCENTAGE } } : {}),
    shading: LABEL_SHADING,
    borders: ALL_BORDERS,
    margins: { top: 40, bottom: 40, left: 60, right: 60 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, bold: true, size: fs - 2, font: ff })],
    })],
  });
}

export const NONE_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } as const;
export const NO_TABLE_BORDERS = {
  top: NONE_BORDER, bottom: NONE_BORDER, left: NONE_BORDER, right: NONE_BORDER,
  insideHorizontal: NONE_BORDER, insideVertical: NONE_BORDER,
};

export function textParagraph(
  text: string,
  fontFamily: string,
  fontSize: number,
  options: { bold?: boolean; center?: boolean; underline?: boolean; before?: number; after?: number } = {},
) {
  return new Paragraph({
    alignment: options.center ? AlignmentType.CENTER : AlignmentType.LEFT,
    spacing: { before: options.before ?? 0, after: options.after ?? 140 },
    children: [new TextRun({
      text,
      bold: options.bold,
      underline: options.underline ? {} : undefined,
      size: fontSize,
      font: fontFamily,
    })],
  });
}

export function bulletParagraph(text: string, fontFamily: string, fontSize: number) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 80 },
    children: [new TextRun({ text, size: fontSize, font: fontFamily })],
  });
}

export function splitItems(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-*]\s+/, '').replace(/^\d+[.)]\s+/, ''))
    .filter(Boolean);
}

export function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

export function htmlToTextBlocks(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|h[1-6]|li|tr|table|ol|ul)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .split(/\n+/)
    .map((line) => decodeHtmlEntities(line).replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean);
}

export function escapeXmlText(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
