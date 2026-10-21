/**
 * DOCX 렌더러 — 휴가원 전용
 */

import {
  Paragraph,
  TextRun,
  Table,
  TableRow,
  WidthType,
  AlignmentType,
  ImageRun,
  VerticalAlign,
  HeightRule,
} from 'docx';
import { leaveLabelCell, leaveValueCell } from '../shared';

export function leaveSignatureChildren(
  employeeName: string,
  signatureDataUrl: string | undefined,
  ff: string,
  fs: number,
): (TextRun | ImageRun)[] {
  const children: (TextRun | ImageRun)[] = [
    new TextRun({ text: `신청인 : ${employeeName || ''} `, size: fs, font: ff }),
  ];
  if (signatureDataUrl && signatureDataUrl.startsWith('data:image')) {
    const base64 = signatureDataUrl.split(',')[1] ?? '';
    if (base64) {
      try {
        children.push(new ImageRun({
          type: /^data:image\/png/i.test(signatureDataUrl) ? 'png' : 'jpg',
          data: Buffer.from(base64, 'base64'),
          transformation: { width: 110, height: 55 },
        }));
        return children;
      } catch {
        // 이미지 삽입 실패 시 텍스트로 폴백
      }
    }
  }
  children.push(new TextRun({ text: '(서명)', size: fs, font: ff }));
  return children;
}

export function buildLeaveApplicationDocxChildren(
  r: Record<string, string>,
  fontFamily: string,
  fontSize: number,
  documentInputs?: Record<string, string>,
): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [];
  const LABEL_W = 21;
  const VALUE_W = 29;
  const WIDE_W = VALUE_W + LABEL_W + VALUE_W; // colspan 3

  // 제목
  elements.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
    children: [new TextRun({ text: r.report_title || '휴가원', bold: true, size: fontSize + 14, font: fontFamily })],
  }));

  // 1. 신청자 정보
  elements.push(new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { before: 200, after: 160 },
    children: [new TextRun({ text: '1. 신청자 정보', bold: true, size: fontSize + 2, font: fontFamily })],
  }));
  elements.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: [
        leaveLabelCell('부서', fontFamily, fontSize, 1, LABEL_W),
        leaveValueCell(r.department ?? '', fontFamily, fontSize, 1, VALUE_W),
        leaveLabelCell('성명', fontFamily, fontSize, 1, LABEL_W),
        leaveValueCell(r.employee_name ?? '', fontFamily, fontSize, 1, VALUE_W),
      ] }),
      new TableRow({ children: [
        leaveLabelCell('입사일', fontFamily, fontSize, 1, LABEL_W),
        leaveValueCell(r.hire_date_ko ?? r.hire_date ?? '', fontFamily, fontSize, 1, VALUE_W),
        leaveLabelCell('비상연락처', fontFamily, fontSize, 1, LABEL_W),
        leaveValueCell(r.emergency_contact ?? '', fontFamily, fontSize, 1, VALUE_W),
      ] }),
    ],
  }));

  // 2. 휴가 내역
  elements.push(new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { before: 320, after: 160 },
    children: [new TextRun({ text: '2. 휴가 내역', bold: true, size: fontSize + 2, font: fontFamily })],
  }));
  const period = `${r.leave_start_date_ko ?? r.leave_start_date ?? ''} ~ ${r.leave_end_date_ko ?? r.leave_end_date ?? ''}`;
  elements.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: [
        leaveLabelCell('휴가기간', fontFamily, fontSize, 1, LABEL_W),
        leaveValueCell(period, fontFamily, fontSize, 3, WIDE_W),
      ] }),
      new TableRow({ children: [
        leaveLabelCell('기 사용 휴가', fontFamily, fontSize, 1, LABEL_W),
        leaveValueCell(`${r.used_leave_days ?? '0'} 일`, fontFamily, fontSize, 1, VALUE_W),
        leaveLabelCell('남은 휴가일수', fontFamily, fontSize, 1, LABEL_W),
        leaveValueCell(`${r.remaining_leave_days ?? ''} 일`, fontFamily, fontSize, 1, VALUE_W),
      ] }),
      new TableRow({
        height: { value: 4000, rule: HeightRule.ATLEAST },
        children: [
          leaveLabelCell('사유', fontFamily, fontSize, 1, LABEL_W, VerticalAlign.TOP),
          leaveValueCell(r.leave_reason ?? '', fontFamily, fontSize, 3, WIDE_W, VerticalAlign.TOP),
        ],
      }),
    ],
  }));

  // 신청 문구 + 날짜 + 신청인(전자서명)
  elements.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 400, after: 160 },
    children: [new TextRun({ text: '위와 같이 휴가를 신청합니다.', size: fontSize, font: fontFamily })],
  }));
  elements.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new TextRun({ text: r.report_date_ko ?? r.report_date ?? '', size: fontSize, font: fontFamily })],
  }));
  elements.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: leaveSignatureChildren(r.employee_name ?? '', documentInputs?.signature_image_src, fontFamily, fontSize),
  }));

  // 하단 회사명
  elements.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 800 },
    children: [new TextRun({ text: r.company_name ?? '', bold: true, size: fontSize + 2, font: fontFamily })],
  }));

  return elements;
}
