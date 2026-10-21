/**
 * DOCX 렌더러 — 회의록 전용
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
  textParagraph,
} from '../shared';

export function buildMeetingDocxChildren(
  r: Record<string, string>,
  fontFamily: string,
  fontSize: number,
  documentInputs?: Record<string, string>,
): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [];
  const LABEL_W = 22;
  const VALUE_W = 78;

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
          children: [new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: r.report_title || '회의록', bold: true, size: fontSize + 14, font: fontFamily })] })],
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

  // 회의 정보 표
  const metaRow = (label: string, value: string) => new TableRow({
    children: [
      leaveLabelCell(label, fontFamily, fontSize, 1, LABEL_W),
      leaveValueCell(value, fontFamily, fontSize, 1, VALUE_W),
    ],
  });
  elements.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      metaRow('작성자', r.author ?? ''),
      metaRow('소속', r.author_department ?? ''),
      metaRow('직급', r.author_position ?? ''),
      metaRow('작성일', r.report_date_ko ?? r.report_date ?? ''),
      metaRow('작성시간', r.report_time ?? ''),
      metaRow('장소', r.meeting_place ?? ''),
      metaRow('참석자', r.attendees ?? ''),
    ],
  }));

  // 섹션(회의 내용 요약 · 회의 결과)
  const sectionKeys: [string, string][] = [
    ['section_1_summary_title', 'section_1_summary_body'],
    ['section_2_result_title', 'section_2_result_body'],
  ];
  for (const [titleKey, bodyKey] of sectionKeys) {
    const title = r[titleKey] ?? '';
    if (title) elements.push(textParagraph(title, fontFamily, fontSize + 2, { bold: true, before: 300, after: 100 }));
    const body = (r[bodyKey] ?? '').trim();
    if (body) {
      for (const line of body.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)) {
        elements.push(textParagraph(line, fontFamily, fontSize, { after: 60 }));
      }
    } else {
      elements.push(new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: '' })] }));
    }
  }

  return elements;
}
