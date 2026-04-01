import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAuthUserId } from '@/lib/auth-helper';
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

/**
 * GET /api/documents/[id]/download
 * 문서 내용을 DOCX로 변환하여 다운로드
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: 'DB 미설정' }, { status: 503 });
    }

    const authUserId = await getAuthUserId(supabase);
    if (!authUserId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { data: doc, error } = await supabase
      .from('documents')
      .select('id, title, content')
      .eq('id', id)
      .single();

    if (error || !doc) {
      return NextResponse.json({ error: '문서를 찾을 수 없습니다.' }, { status: 404 });
    }

    const content = doc.content ?? '';
    const children = markdownToDocxElements(content);

    const docx = new Document({
      sections: [{
        properties: {},
        children,
      }],
      styles: {
        default: {
          document: {
            run: { font: 'Malgun Gothic', size: 22 },
          },
        },
      },
    });

    const buffer = await Packer.toBuffer(docx);
    const fileName = encodeURIComponent(`${doc.title}.docx`);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename*=UTF-8''${fileName}`,
      },
    });
  } catch (err) {
    console.error('[documents/download]', err);
    return NextResponse.json({ error: 'DOCX 변환 중 오류' }, { status: 500 });
  }
}

/** 마크다운 텍스트를 docx Paragraph[] 로 변환 */
function markdownToDocxElements(md: string): (Paragraph | Table)[] {
  const lines = md.split('\n');
  const elements: (Paragraph | Table)[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 테이블 감지 (| 로 시작하는 연속 라인)
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        // 구분선(---) 행 제외
        if (!/^\|[\s\-:|]+\|$/.test(lines[i].trim())) {
          tableLines.push(lines[i]);
        }
        i++;
      }
      if (tableLines.length > 0) {
        elements.push(parseTable(tableLines));
      }
      continue;
    }

    // 제목
    if (line.startsWith('### ')) {
      elements.push(new Paragraph({
        text: line.slice(4).trim(),
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 240, after: 120 },
      }));
    } else if (line.startsWith('## ')) {
      elements.push(new Paragraph({
        text: line.slice(3).trim(),
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 360, after: 120 },
      }));
    } else if (line.startsWith('# ')) {
      elements.push(new Paragraph({
        text: line.slice(2).trim(),
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 480, after: 200 },
      }));
    }
    // 불릿 리스트
    else if (/^[-*]\s/.test(line.trim())) {
      elements.push(new Paragraph({
        children: parseInlineFormatting(line.trim().slice(2).trim()),
        bullet: { level: 0 },
        spacing: { after: 60 },
      }));
    }
    // 번호 리스트
    else if (/^\d+\.\s/.test(line.trim())) {
      const text = line.trim().replace(/^\d+\.\s/, '');
      elements.push(new Paragraph({
        children: parseInlineFormatting(text),
        spacing: { after: 60 },
      }));
    }
    // 수평선
    else if (/^---+$/.test(line.trim())) {
      elements.push(new Paragraph({
        children: [new TextRun({ text: '' })],
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC' } },
        spacing: { before: 200, after: 200 },
      }));
    }
    // 빈 줄
    else if (line.trim() === '') {
      elements.push(new Paragraph({ text: '' }));
    }
    // 일반 텍스트
    else {
      elements.push(new Paragraph({
        children: parseInlineFormatting(line),
        spacing: { after: 60 },
      }));
    }

    i++;
  }

  return elements;
}

/** 인라인 볼드/이탤릭 파싱 */
function parseInlineFormatting(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|([^*`]+))/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match[2]) {
      runs.push(new TextRun({ text: match[2], bold: true }));
    } else if (match[3]) {
      runs.push(new TextRun({ text: match[3], italics: true }));
    } else if (match[4]) {
      runs.push(new TextRun({ text: match[4], font: 'Consolas', size: 20 }));
    } else if (match[5]) {
      runs.push(new TextRun({ text: match[5] }));
    }
  }

  if (runs.length === 0) {
    runs.push(new TextRun({ text }));
  }

  return runs;
}

/** 마크다운 테이블 → docx Table */
function parseTable(tableLines: string[]): Table {
  const rows = tableLines.map((line, rowIdx) => {
    const cells = line.split('|').filter((c) => c.trim() !== '').map((c) => c.trim());
    return new TableRow({
      children: cells.map((cellText) =>
        new TableCell({
          children: [new Paragraph({
            children: [new TextRun({
              text: cellText,
              bold: rowIdx === 0,
              size: 20,
            })],
            alignment: AlignmentType.CENTER,
          })],
          width: { size: Math.floor(9000 / Math.max(cells.length, 1)), type: WidthType.DXA },
        }),
      ),
    });
  });

  return new Table({
    rows,
    width: { size: 9000, type: WidthType.DXA },
  });
}
