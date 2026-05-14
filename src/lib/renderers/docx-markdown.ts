import {
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

export function markdownToDocxElements(md: string, fontFamily: string, fontSize: number): (Paragraph | Table)[] {
  const lines = md.split('\n');
  const elements: (Paragraph | Table)[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        if (!/^\|[\s\-:|]+\|$/.test(lines[i].trim())) tableLines.push(lines[i]);
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
      elements.push(new Paragraph({ children: parseInlineFormatting(line.trim().replace(/^\d+\.\s/, ''), fontFamily, fontSize), spacing: { after: 60 } }));
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
  let match: RegExpExecArray | null;

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
      children: cells.map(cellText => new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: cellText, bold: rowIdx === 0, size: fontSize, font: fontFamily })], alignment: AlignmentType.CENTER })],
        width: { size: Math.floor(9000 / Math.max(cells.length, 1)), type: WidthType.DXA },
      })),
    });
  });

  return new Table({ rows, width: { size: 9000, type: WidthType.DXA } });
}
