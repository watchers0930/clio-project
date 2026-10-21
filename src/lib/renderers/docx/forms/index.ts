/**
 * DOCX 렌더러 — HTML 템플릿 양식 감지 및 분기
 */

import {
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  PageBreak,
  ShadingType,
} from 'docx';
import type { TemplateBundle } from '@/lib/templates/template-schema';
import { markdownToDocxElements } from '../../docx-markdown';
import { buildTemplateRenderData } from '../../template-render-data';
import { ALL_BORDERS, THIN_BORDER, labelCell, valueCell } from '../shared';
import { buildGenericHtmlTemplateDocxChildren } from '../html-utils';
import { isMouTemplate, buildMouDocxChildren } from './mou';
import { buildLeaveApplicationDocxChildren } from './leave';
import { buildApprovalRequestDocxChildren } from './approval';
import { buildWeeklyReportDocxChildren } from './weekly-report';
import { buildMeetingDocxChildren } from './meeting';

export function buildHtmlTemplateDocxChildren(
  markdown: string,
  title: string,
  fontFamily: string,
  fontSize: number,
  templateBundle: TemplateBundle,
  documentInputs?: Record<string, string>,
): (Paragraph | Table)[] {
  const data = buildTemplateRenderData({ markdown, title, templateBundle, documentInputs });
  const r = data.replacements;
  const elements: (Paragraph | Table)[] = [];

  if (isMouTemplate(templateBundle)) {
    return buildMouDocxChildren(r, fontFamily, fontSize);
  }

  if (templateBundle.outline.startsWith('# 휴가원')) {
    return buildLeaveApplicationDocxChildren(r, fontFamily, fontSize, documentInputs);
  }

  if (templateBundle.outline.startsWith('# 품의서')) {
    return buildApprovalRequestDocxChildren(r, fontFamily, fontSize, documentInputs);
  }

  if (templateBundle.outline.startsWith('# 주간업무')) {
    return buildWeeklyReportDocxChildren(r, fontFamily, fontSize, documentInputs);
  }

  if (templateBundle.outline.startsWith('# 회의록')) {
    return buildMeetingDocxChildren(r, fontFamily, fontSize, documentInputs);
  }

  if (!templateBundle.outline.startsWith('# 사업계획서')) {
    return buildGenericHtmlTemplateDocxChildren(templateBundle, r, fontFamily, fontSize);
  }

  // ── 표지 테이블 ──
  const coverTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      // 제목 행
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 6,
            borders: ALL_BORDERS,
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 200 },
              children: [new TextRun({ text: '사 업 계 획 서', bold: true, size: 32, font: fontFamily })],
            })],
          }),
        ],
      }),
      // 기업체명 / 대표자
      new TableRow({
        children: [
          labelCell('기업체명', fontFamily, fontSize),
          valueCell(r.company_name ?? '', fontFamily, fontSize, 2),
          labelCell('대표자', fontFamily, fontSize),
          valueCell(r.ceo_name ?? '', fontFamily, fontSize, 2),
        ],
      }),
      // 법인등록번호 / 설립(예정)일
      new TableRow({
        children: [
          labelCell('법인등록번호', fontFamily, fontSize),
          valueCell(r.corp_reg_number ?? '', fontFamily, fontSize, 2),
          labelCell('설립(예정)일', fontFamily, fontSize),
          valueCell(r.established_date ?? '', fontFamily, fontSize, 2),
        ],
      }),
      // 사업자등록번호 / 사업유형
      new TableRow({
        children: [
          labelCell('사업자등록번호', fontFamily, fontSize),
          valueCell(r.biz_reg_number ?? '', fontFamily, fontSize, 2),
          labelCell('사업유형', fontFamily, fontSize),
          valueCell(r.biz_type ?? '', fontFamily, fontSize, 2),
        ],
      }),
      // 대표주소 / 대표자연락처
      new TableRow({
        children: [
          labelCell('대표주소\n(본점 소재지)', fontFamily, fontSize),
          valueCell(r.address ?? '', fontFamily, fontSize, 2),
          labelCell('대표자연락처', fontFamily, fontSize),
          valueCell(r.phone ?? '', fontFamily, fontSize),
          valueCell(r.email ?? '', fontFamily, fontSize),
        ],
      }),
      // 주요 사업명
      new TableRow({
        children: [
          labelCell('주요 사업명', fontFamily, fontSize),
          valueCell(r.main_biz_name ?? '', fontFamily, fontSize, 5),
        ],
      }),
      // 사업개요
      new TableRow({
        children: [
          labelCell('사업개요', fontFamily, fontSize),
          valueCell(r.biz_summary ?? '', fontFamily, fontSize, 5),
        ],
      }),
    ],
  });

  elements.push(coverTable);

  // ── 첨부 서류 목록 ──
  elements.push(new Paragraph({ spacing: { before: 300 } }));
  const attachments = [
    '첨부 1. 사업계획서 1부',
    '      2. 벤처기업 확인서 사본 1부',
    '      3. 법인등기부등본(법인) 또는 대표자 주민등록등본(개인) 1부',
    '      4. 지방세 및 국세완납증명 각1부',
    '      5. 사업자등록증 사본 1부',
    '      6. 실적 관련 증빙자료 각 1부',
    '      7. 유망중소기업지정확인서 등 관련 입증자료 각1부',
    '      8. 개인정보제공이용동의서 1부',
  ];
  for (const att of attachments) {
    elements.push(new Paragraph({
      spacing: { after: 40 },
      children: [new TextRun({ text: att, size: fontSize, font: fontFamily })],
    }));
  }

  // ── 섹션별 페이지 ──
  for (let i = 0; i < data.sections.length; i++) {
    const section = data.sections[i];
    // 페이지 나누기
    elements.push(new Paragraph({
      children: [new PageBreak()],
    }));

    // 섹션 제목 (회색 배경 박스 스타일)
    elements.push(new Paragraph({
      spacing: { after: 200 },
      shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'E8E8E8' },
      border: { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER },
      children: [new TextRun({ text: `  ${section.title}`, bold: true, size: fontSize + 4, font: fontFamily })],
    }));

    // 섹션 본문
    const body = section.bodyMarkdown.trim() || '[내용 없음]';
    const bodyChildren = markdownToDocxElements(body, fontFamily, fontSize) as (Paragraph | Table)[];
    elements.push(...bodyChildren);
  }

  return elements;
}
