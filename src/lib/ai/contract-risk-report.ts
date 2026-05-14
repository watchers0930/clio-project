/**
 * 계약서 리스크 분석 DOCX 리포트 생성
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
} from 'docx';
import type { ContractRiskAnalysis } from '../types/contract-risk';
import {
  CONTRACT_TYPE_LABELS,
  PERSPECTIVE_LABELS,
  CATEGORY_LABELS,
  RISK_LEVEL_LABELS,
  CONTRACT_RISK_ITEMS,
} from '../contract-risk-items';

const FONT = 'Malgun Gothic';
const FONT_EN = 'Verdana';

// 리스크 수준별 색상
const RISK_COLORS: Record<string, string> = {
  high: 'C0392B',
  medium: 'D68910',
  low: '1E8449',
};

function riskLabel(level: string): string {
  return `[${RISK_LEVEL_LABELS[level] ?? level}]`;
}

function categoryLabel(id: string): string {
  const def = CONTRACT_RISK_ITEMS.find(i => i.id === id);
  return def ? CATEGORY_LABELS[def.category] ?? '' : '';
}

function makeBorder() {
  return {
    top: { style: BorderStyle.SINGLE, size: 1, color: 'E2E5EA' },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E2E5EA' },
    left: { style: BorderStyle.SINGLE, size: 1, color: 'E2E5EA' },
    right: { style: BorderStyle.SINGLE, size: 1, color: 'E2E5EA' },
  };
}

export async function generateContractRiskReport(
  analysis: ContractRiskAnalysis,
): Promise<Buffer> {
  const { file_name, contract_type, perspective, risk_result, risk_count, created_at } = analysis;
  const foundItems = (risk_result?.items ?? []).filter(i => i.found);
  const dateStr = new Date(created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

  const children: (Paragraph | Table)[] = [];

  // ── 표지 ────────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({ spacing: { before: 0, after: 800 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 400, after: 200 },
      children: [
        new TextRun({
          text: '계약서 AI 리스크 분석 리포트',
          font: FONT, size: 48, bold: true, color: '1B1F2B',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 100, after: 100 },
      children: [new TextRun({ text: file_name, font: FONT, size: 24, color: '555555' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 80, after: 80 },
      children: [new TextRun({
        text: `${CONTRACT_TYPE_LABELS[contract_type] ?? contract_type} | 입장: ${PERSPECTIVE_LABELS[perspective] ?? perspective}`,
        font: FONT, size: 22, color: '2E6FF2',
      })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 80, after: 600 },
      children: [new TextRun({ text: `분석 일시: ${dateStr}`, font: FONT, size: 20, color: '888888' })],
    }),
  );

  // ── 리스크 요약 표 ───────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
      children: [new TextRun({ text: '리스크 요약', font: FONT, size: 28, bold: true, color: '1B1F2B' })],
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: makeBorder(),
      rows: [
        new TableRow({
          children: [
            makeCell('구분', true),
            makeCell('건수', true),
          ],
        }),
        new TableRow({ children: [makeCell('🔴 상위 리스크'), makeCell(`${risk_count.high}건`, false, 'C0392B')] }),
        new TableRow({ children: [makeCell('🟡 중위 리스크'), makeCell(`${risk_count.medium}건`, false, 'D68910')] }),
        new TableRow({ children: [makeCell('🟢 하위 리스크'), makeCell(`${risk_count.low}건`, false, '1E8449')] }),
        new TableRow({ children: [makeCell('합계 (탐지)', true), makeCell(`${foundItems.length}건`, true)] }),
      ],
    }),
  );

  // ── 전체 요약 ────────────────────────────────────────────────────────────
  if (risk_result?.summary) {
    children.push(
      new Paragraph({
        spacing: { before: 300, after: 100 },
        children: [new TextRun({ text: 'AI 종합 의견', font: FONT, size: 24, bold: true, color: '1B1F2B' })],
      }),
      new Paragraph({
        spacing: { before: 100, after: 300 },
        children: [new TextRun({ text: risk_result.summary, font: FONT, size: 20, color: '333333' })],
      }),
    );
  }

  // ── 탐지된 항목별 상세 ───────────────────────────────────────────────────
  if (foundItems.length > 0) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
        children: [new TextRun({ text: '탐지된 리스크 항목 상세', font: FONT, size: 28, bold: true, color: '1B1F2B' })],
      }),
    );

    // 상 → 중 → 하 순으로 정렬
    const levelOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const sorted = [...foundItems].sort(
      (a, b) => (levelOrder[a.risk_level] ?? 3) - (levelOrder[b.risk_level] ?? 3),
    );

    for (const item of sorted) {
      const def = CONTRACT_RISK_ITEMS.find(d => d.id === item.id);
      const color = RISK_COLORS[item.risk_level] ?? '555555';

      children.push(
        new Paragraph({
          spacing: { before: 300, after: 80 },
          children: [
            new TextRun({ text: `${riskLabel(item.risk_level)} `, font: FONT, size: 22, bold: true, color }),
            new TextRun({ text: `${item.id} `, font: FONT_EN, size: 20, bold: true, color }),
            new TextRun({ text: def?.name ?? item.id, font: FONT, size: 22, bold: true, color: '1B1F2B' }),
          ],
        }),
        new Paragraph({
          spacing: { before: 40, after: 40 },
          children: [new TextRun({ text: `카테고리: ${categoryLabel(item.id)}`, font: FONT, size: 18, color: '888888' })],
        }),
      );

      if (item.excerpt) {
        children.push(
          new Paragraph({
            spacing: { before: 80, after: 40 },
            children: [new TextRun({ text: '■ 원문 발췌', font: FONT, size: 20, bold: true, color: '2E6FF2' })],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: makeBorder(),
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F7F8FA' },
                    children: [
                      new Paragraph({
                        spacing: { before: 80, after: 80 },
                        children: [new TextRun({ text: item.excerpt, font: FONT, size: 20, italics: true, color: '333333' })],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        );
      }

      if (item.explanation) {
        children.push(
          new Paragraph({
            spacing: { before: 120, after: 40 },
            children: [new TextRun({ text: '■ AI 분석', font: FONT, size: 20, bold: true, color: '1B1F2B' })],
          }),
          new Paragraph({
            spacing: { before: 40, after: 40 },
            children: [new TextRun({ text: item.explanation, font: FONT, size: 20, color: '333333' })],
          }),
        );
      }

      if (item.recommendation) {
        children.push(
          new Paragraph({
            spacing: { before: 80, after: 40 },
            children: [new TextRun({ text: '■ 권고사항', font: FONT, size: 20, bold: true, color: '1E8449' })],
          }),
          new Paragraph({
            spacing: { before: 40, after: 200 },
            children: [new TextRun({ text: item.recommendation, font: FONT, size: 20, color: '333333' })],
          }),
        );
      }
    }
  }

  // ── 면책 문구 ────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({ spacing: { before: 600, after: 200 }, children: [new TextRun({ text: '', font: FONT, size: 20 })] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 100, after: 100 },
      children: [new TextRun({
        text: '⚠️ 이 분석은 AI가 생성한 참고 자료이며 법적 조언이 아닙니다.',
        font: FONT, size: 18, bold: true, color: 'D68910',
      })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 80, after: 200 },
      children: [new TextRun({
        text: '최종 계약 체결 전 법률 전문가 검토를 권장합니다.',
        font: FONT, size: 18, color: '888888',
      })],
    }),
  );

  const doc = new Document({
    sections: [{ properties: {}, children }],
    styles: {
      default: {
        document: { run: { font: FONT, size: 20 } },
      },
    },
  });

  return Packer.toBuffer(doc);
}

// ── 헬퍼: 테이블 셀 생성 ─────────────────────────────────────────────────
function makeCell(text: string, bold = false, color = '333333'): TableCell {
  return new TableCell({
    borders: makeBorder(),
    children: [
      new Paragraph({
        spacing: { before: 80, after: 80 },
        children: [new TextRun({ text, font: FONT, size: 20, bold, color })],
      }),
    ],
  });
}
