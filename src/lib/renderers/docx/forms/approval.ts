/**
 * DOCX 렌더러 — 품의서 전용
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

export function buildApprovalRequestDocxChildren(
  r: Record<string, string>,
  fontFamily: string,
  fontSize: number,
  documentInputs?: Record<string, string>,
): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [];
  const LABEL_W = 21;
  const VALUE_W = 29;
  const BODY_LABEL_W = 22;
  const BODY_VALUE_W = 78;

  // 결재란 (3칸 균등)
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
        approvalBoxLabelCell('기안', fontFamily, fontSize, 33),
        approvalBoxLabelCell('검토', fontFamily, fontSize, 33),
        approvalBoxLabelCell('승인', fontFamily, fontSize, 34),
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

  // 상단: 제목(좌측) + 결재란(우측) 한 줄 배치 (테두리 없는 레이아웃 표)
  elements.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: NO_TABLE_BORDERS,
    rows: [
      new TableRow({ children: [
        new TableCell({
          width: { size: 58, type: WidthType.PERCENTAGE },
          borders: NO_TABLE_BORDERS,
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({
            alignment: AlignmentType.LEFT,
            children: [new TextRun({ text: r.report_title || '품의서', bold: true, size: fontSize + 14, font: fontFamily })],
          })],
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

  // 기안 정보 표
  const drafter = `${r.author ?? ''}${r.author_position ? ` ${r.author_position}` : ''}`.trim();
  elements.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: [
        leaveLabelCell('문서번호', fontFamily, fontSize, 1, LABEL_W),
        leaveValueCell(r.report_no ?? '', fontFamily, fontSize, 1, VALUE_W),
        leaveLabelCell('기안일', fontFamily, fontSize, 1, LABEL_W),
        leaveValueCell(r.report_date_ko ?? r.report_date ?? '', fontFamily, fontSize, 1, VALUE_W),
      ] }),
      new TableRow({ children: [
        leaveLabelCell('기안부서', fontFamily, fontSize, 1, LABEL_W),
        leaveValueCell(r.author_department ?? '', fontFamily, fontSize, 1, VALUE_W),
        leaveLabelCell('기안자', fontFamily, fontSize, 1, LABEL_W),
        leaveValueCell(drafter, fontFamily, fontSize, 1, VALUE_W),
      ] }),
    ],
  }));

  elements.push(new Paragraph({ spacing: { after: 160 } }));

  // 품의 내용 표
  elements.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: [
        leaveLabelCell('건명', fontFamily, fontSize, 1, BODY_LABEL_W),
        leaveValueCell(r.subject ?? '', fontFamily, fontSize, 1, BODY_VALUE_W),
      ] }),
      new TableRow({ children: [
        leaveLabelCell('품의 목적', fontFamily, fontSize, 1, BODY_LABEL_W, VerticalAlign.TOP),
        leaveValueCell(r.purpose ?? '', fontFamily, fontSize, 1, BODY_VALUE_W, VerticalAlign.TOP),
      ] }),
      new TableRow({
        height: { value: 3400, rule: HeightRule.ATLEAST },
        children: [
          leaveLabelCell('세부 내용', fontFamily, fontSize, 1, BODY_LABEL_W, VerticalAlign.TOP),
          leaveValueCell(r.details ?? '', fontFamily, fontSize, 1, BODY_VALUE_W, VerticalAlign.TOP),
        ],
      }),
      new TableRow({ children: [
        leaveLabelCell('소요 예산', fontFamily, fontSize, 1, BODY_LABEL_W),
        leaveValueCell(r.budget_amount ?? '', fontFamily, fontSize, 1, BODY_VALUE_W),
      ] }),
      new TableRow({ children: [
        leaveLabelCell('시행 예정일', fontFamily, fontSize, 1, BODY_LABEL_W),
        leaveValueCell(r.execution_date_ko ?? r.execution_date ?? '', fontFamily, fontSize, 1, BODY_VALUE_W),
      ] }),
      new TableRow({ children: [
        leaveLabelCell('비고', fontFamily, fontSize, 1, BODY_LABEL_W, VerticalAlign.TOP),
        leaveValueCell(r.remarks ?? '', fontFamily, fontSize, 1, BODY_VALUE_W, VerticalAlign.TOP),
      ] }),
    ],
  }));

  // 하단 회사명
  elements.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 800 },
    children: [new TextRun({ text: r.company_name ?? '', bold: true, size: fontSize + 2, font: fontFamily })],
  }));

  return elements;
}
