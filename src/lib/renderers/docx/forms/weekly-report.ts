/**
 * DOCX 렌더러 — 주간업무 전용
 */

import {
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  VerticalAlign,
  HeightRule,
} from 'docx';
import {
  ALL_BORDERS,
  NO_TABLE_BORDERS,
  leaveLabelCell,
  leaveValueCell,
  approvalSignParagraph,
  approvalBoxLabelCell,
} from '../shared';

export function buildWeeklyReportDocxChildren(
  r: Record<string, string>,
  fontFamily: string,
  fontSize: number,
  documentInputs?: Record<string, string>,
): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [];
  const LABEL_W = 21;
  const VALUE_W = 29;

  // 결재란 (담당/팀장/대표, 서명=담당)
  const emptyApprovalCell = (widthPct: number) => new TableCell({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    borders: ALL_BORDERS,
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ children: [new TextRun({ text: '' })] })],
  });
  const approvalBox = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: [
        approvalBoxLabelCell('담당', fontFamily, fontSize, 33),
        approvalBoxLabelCell('팀장', fontFamily, fontSize, 33),
        approvalBoxLabelCell('대표', fontFamily, fontSize, 34),
      ] }),
      new TableRow({
        height: { value: 1100, rule: HeightRule.ATLEAST },
        children: [
          new TableCell({ width: { size: 33, type: WidthType.PERCENTAGE }, borders: ALL_BORDERS, verticalAlign: VerticalAlign.CENTER, children: [approvalSignParagraph(documentInputs?.signature_image_src)] }),
          emptyApprovalCell(33),
          emptyApprovalCell(34),
        ],
      }),
    ],
  });

  // 상단: 제목(좌) + 결재란(우)
  elements.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: NO_TABLE_BORDERS,
    rows: [
      new TableRow({ children: [
        new TableCell({
          width: { size: 58, type: WidthType.PERCENTAGE },
          borders: NO_TABLE_BORDERS,
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: r.report_title || '주간업무', bold: true, size: fontSize + 14, font: fontFamily })] })],
        }),
        new TableCell({
          width: { size: 42, type: WidthType.PERCENTAGE },
          borders: NO_TABLE_BORDERS,
          verticalAlign: VerticalAlign.TOP,
          children: [approvalBox],
        }),
      ] }),
    ],
  }));

  elements.push(new Paragraph({ spacing: { after: 300 } }));

  // 메타 표 (부서/작성자 · 보고기간/작성일)
  const writer = `${r.author ?? ''}${r.author_position ? ` ${r.author_position}` : ''}`.trim();
  elements.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: [
        leaveLabelCell('부서', fontFamily, fontSize, 1, LABEL_W),
        leaveValueCell(r.author_department ?? '', fontFamily, fontSize, 1, VALUE_W),
        leaveLabelCell('작성자', fontFamily, fontSize, 1, LABEL_W),
        leaveValueCell(writer, fontFamily, fontSize, 1, VALUE_W),
      ] }),
      new TableRow({ children: [
        leaveLabelCell('보고기간', fontFamily, fontSize, 1, LABEL_W),
        leaveValueCell(r.report_period ?? '', fontFamily, fontSize, 1, VALUE_W),
        leaveLabelCell('작성일', fontFamily, fontSize, 1, LABEL_W),
        leaveValueCell(r.report_date_ko ?? r.report_date ?? '', fontFamily, fontSize, 1, VALUE_W),
      ] }),
    ],
  }));

  elements.push(new Paragraph({ spacing: { after: 160 } }));

  // 금주 업무 표 (헤더 + 동적 행)
  let workRows: Array<Record<string, string>> = [];
  try {
    const parsed = JSON.parse(documentInputs?.work_rows || r.work_rows || '[]');
    if (Array.isArray(parsed)) workRows = parsed as Array<Record<string, string>>;
  } catch {
    // 파싱 실패 시 빈 표
  }
  workRows = workRows.filter((x) => x && (x.date || x.content || x.progress || x.note));
  const DATE_W = 20, CONTENT_W = 50, PROG_W = 12, NOTE_W = 18;
  const workTableRows: TableRow[] = [
    new TableRow({ children: [
      leaveLabelCell('날짜', fontFamily, fontSize, 1, DATE_W),
      leaveLabelCell('내용', fontFamily, fontSize, 1, CONTENT_W),
      leaveLabelCell('진행율', fontFamily, fontSize, 1, PROG_W),
      leaveLabelCell('비고', fontFamily, fontSize, 1, NOTE_W),
    ] }),
  ];
  const bodyRows = workRows.length ? workRows : [{ date: '', content: '', progress: '', note: '' }];
  for (const row of bodyRows) {
    workTableRows.push(new TableRow({
      height: { value: 700, rule: HeightRule.ATLEAST },
      children: [
        leaveValueCell(row.date ?? '', fontFamily, fontSize, 1, DATE_W),
        leaveValueCell(row.content ?? '', fontFamily, fontSize, 1, CONTENT_W, VerticalAlign.TOP),
        leaveValueCell(row.progress ?? '', fontFamily, fontSize, 1, PROG_W),
        leaveValueCell(row.note ?? '', fontFamily, fontSize, 1, NOTE_W, VerticalAlign.TOP),
      ],
    }));
  }
  elements.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: workTableRows }));

  elements.push(new Paragraph({ spacing: { after: 160 } }));

  // 차주 할 일 박스
  elements.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: [leaveLabelCell('차주 할 일', fontFamily, fontSize, 1, 100)] }),
      new TableRow({
        height: { value: 2400, rule: HeightRule.ATLEAST },
        children: [leaveValueCell(r.next_week_plan ?? '', fontFamily, fontSize, 1, 100, VerticalAlign.TOP)],
      }),
    ],
  }));

  return elements;
}
