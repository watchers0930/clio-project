/**
 * DOCX 렌더러 — 마크다운 → DOCX 변환
 * 기존 download/route.ts의 로직을 모듈화
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  PageBreak,
  ShadingType,
} from 'docx';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import type { TemplateBundle } from '@/lib/templates/template-schema';
import type { RenderOutput, CorporateTheme, DocxReplacement, DocxFormData, DocxTableCell, DocxTableStructure } from './types';
import { DEFAULT_THEME } from './types';
import { markdownToDocxElements } from './docx-markdown';
import { buildTemplateRenderData } from './template-render-data';

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

function normalizeDocxPackage(zip: PizZip) {
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

export async function renderDocx(
  markdown: string,
  title: string,
  theme: CorporateTheme = DEFAULT_THEME,
  options?: {
    templateBundle?: TemplateBundle | null;
    documentInputs?: Record<string, string>;
  },
): Promise<RenderOutput> {
  const fontFamily = FONT_MAP[theme.fontFamily] ?? theme.fontFamilyEn;
  const fontSize = theme.fontSize * 2; // half-point 단위
  const children = options?.templateBundle
    ? buildTemplateDocxChildren(markdown, title, fontFamily, fontSize, options.templateBundle, options.documentInputs)
    : markdownToDocxElements(markdown, fontFamily, fontSize);

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

function buildTemplateDocxChildren(
  markdown: string,
  title: string,
  fontFamily: string,
  fontSize: number,
  templateBundle: TemplateBundle,
  documentInputs?: Record<string, string>,
) {
  // html-template 모드: 표지 테이블 + 섹션 페이지 구조
  if (templateBundle.mode === 'html-template' && templateBundle.layoutHtml) {
    return buildHtmlTemplateDocxChildren(markdown, title, fontFamily, fontSize, templateBundle, documentInputs);
  }

  const data = buildTemplateRenderData({ markdown, title, templateBundle, documentInputs });
  const children: Paragraph[] = [];
  const titleText = data.replacements.report_title || title;
  const metaParts = [
    data.replacements.author ? `작성자 ${data.replacements.author}` : '',
    data.replacements.report_date ? `작성일 ${data.replacements.report_date}` : '',
  ].filter(Boolean);

  children.push(new Paragraph({
    spacing: { after: 200 },
    children: [new TextRun({ text: titleText, bold: true, size: fontSize + 12, font: fontFamily })],
  }));

  if (!data.isWorklog && data.replacements.subtitle) {
    children.push(new Paragraph({
      spacing: { after: 160 },
      children: [new TextRun({ text: data.replacements.subtitle, italics: true, size: fontSize, font: fontFamily })],
    }));
  }

  if (metaParts.length > 0) {
    children.push(new Paragraph({
      spacing: { after: 240 },
      children: [new TextRun({ text: metaParts.join('  |  '), size: fontSize - 2, font: fontFamily })],
    }));
  }

  for (const section of data.sections) {
    children.push(new Paragraph({
      spacing: { before: 240, after: 120 },
      children: [new TextRun({ text: section.title, bold: true, size: fontSize + 4, font: fontFamily })],
    }));

    const body = section.bodyMarkdown.trim() || '[내용 없음]';
    const bodyChildren = markdownToDocxElements(body, fontFamily, fontSize) as Paragraph[];
    children.push(...bodyChildren);
  }

  return children;
}

// ─── HTML 템플릿 → DOCX 구조 변환 ─────────────────────────────
const LABEL_SHADING = { type: ShadingType.CLEAR, color: 'auto', fill: 'F5F5F5' };
const THIN_BORDER = { style: BorderStyle.SINGLE, size: 1, color: '000000' };
const ALL_BORDERS = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER };

function labelCell(text: string, fontFamily: string, fontSize: number, columnSpan = 1, width?: number): TableCell {
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

function valueCell(text: string, fontFamily: string, fontSize: number, columnSpan = 1): TableCell {
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

function buildHtmlTemplateDocxChildren(
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

function isMouTemplate(templateBundle: TemplateBundle) {
  return templateBundle.outline.includes('양해각서') || templateBundle.fields.some((field) => field.key === 'party_a_name' || field.key === 'party_b_name');
}

function textParagraph(
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

function bulletParagraph(text: string, fontFamily: string, fontSize: number) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 80 },
    children: [new TextRun({ text, size: fontSize, font: fontFamily })],
  });
}

function splitItems(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-*]\s+/, '').replace(/^\d+[.)]\s+/, ''))
    .filter(Boolean);
}

function buildMouDocxChildren(
  r: Record<string, string>,
  fontFamily: string,
  fontSize: number,
): (Paragraph | Table)[] {
  const partyA = r.party_a_name || '갑';
  const partyB = r.party_b_name || '을';
  const contractDate = r.contract_date || r.report_date || '';
  const purpose = r.cooperation_purpose || `본 MOU의 목적은 "${partyA}"와 "${partyB}"가 사업 분야 경쟁력 강화 및 시장 확대를 위한 전략적 제휴 관계를 구축하고 상호 이익 증진에 기여함에 있다.`;
  const partyAItems = splitItems(r.party_a_coop_items || '');
  const partyBItems = splitItems(r.party_b_coop_items || '');

  const elements: (Paragraph | Table)[] = [
    textParagraph('사업 협력을 위한 양해각서', fontFamily, fontSize + 10, { bold: true, underline: true, center: true, after: 360 }),
    textParagraph(`본 양해각서(이하 "MOU")는 주식회사 ${partyA}(이하 "${partyA}")와 주식회사 ${partyB}(이하 "${partyB}") 간의 사업 협력을 위하여 체결한다.`, fontFamily, fontSize, { after: 240 }),
    textParagraph('제1조 (협력의 목적)', fontFamily, fontSize + 2, { bold: true, underline: true, before: 180 }),
    textParagraph(purpose, fontFamily, fontSize),
    textParagraph('제2조 (협력 범위 및 당사자별 역할)', fontFamily, fontSize + 2, { bold: true, underline: true, before: 180 }),
    textParagraph(`양 당사자는 제1조의 목적을 달성하기 위하여 다음 각 호의 분야에서 협력하며, 구체적인 의무는 향후 체결될 본 계약에서 정한다.`, fontFamily, fontSize),
    textParagraph(`"${partyA}"의 주요 협력 사항`, fontFamily, fontSize, { bold: true }),
    ...(partyAItems.length ? partyAItems.map((item) => bulletParagraph(item, fontFamily, fontSize)) : [bulletParagraph('상호 협의한 사업화 및 영업 활동에 협력한다.', fontFamily, fontSize)]),
    textParagraph(`"${partyB}"의 주요 협력 사항`, fontFamily, fontSize, { bold: true }),
    ...(partyBItems.length ? partyBItems.map((item) => bulletParagraph(item, fontFamily, fontSize)) : [bulletParagraph('상호 협의한 기술 및 솔루션 제공에 협력한다.', fontFamily, fontSize)]),
  ];

  const articleBodies = [
    ['제3조 (주요 이행사항 및 기본 원칙)', '양 당사자는 상호 이익 증진, 신의성실, 지속가능성, 고객 만족을 기본 원칙으로 협력을 추진한다.'],
    ['제4조 (정보 공유 및 비밀유지)', '양 당사자는 본 MOU와 관련하여 제공받은 비밀정보를 본 목적을 위해서만 사용하며, 상대방의 사전 서면 동의 없이 제3자에게 공개하거나 누설하지 않는다. 본 조의 비밀유지 의무는 본 MOU 종료 후에도 1년간 존속한다.'],
    ['제5조 (비용 부담)', '본 MOU의 체결, 이행 및 협의 과정에서 발생하는 각 당사자의 비용은 각 당사자가 개별적으로 부담하는 것을 원칙으로 한다.'],
    ['제6조 (MOU의 법적 구속력 부재)', '본 MOU는 양 당사자 간 상호 이해와 협력 의사를 확인하는 것으로, 비밀유지 등 별도 법적 구속력을 명시한 조항을 제외하고 본 계약 체결 의무를 부과하지 않는다.'],
    ['제7조 (유효기간 및 종료)', '본 MOU는 양 당사자가 서명한 날로부터 효력을 발생하며, 당사자 간 별도 합의 또는 해지 통지가 없는 한 협력 목적 달성을 위하여 유지된다.'],
    ['제8조 (분쟁 해결)', '본 MOU의 해석이나 적용과 관련하여 분쟁이나 이견이 발생하는 경우 양 당사자는 상호 협의를 통해 우호적으로 해결하기 위해 최선의 노력을 다한다.'],
    ['제9조 (본 계약으로의 전환)', '양 당사자는 본 MOU의 내용을 바탕으로 구체적인 권리와 의무를 규정하는 정식 계약 체결을 위해 성실하게 협상한다.'],
    ['제10조 (준거법 및 관할권)', '본 MOU의 해석 및 적용은 대한민국 법률에 따르며, 관련 분쟁은 당사자가 합의한 관할 법원에서 해결한다.'],
  ];

  for (const [heading, body] of articleBodies) {
    elements.push(textParagraph(heading, fontFamily, fontSize + 2, { bold: true, underline: true, before: 180 }));
    elements.push(textParagraph(body, fontFamily, fontSize));
  }

  elements.push(textParagraph('서명', fontFamily, fontSize + 2, { bold: true, before: 240 }));
  elements.push(textParagraph('본 MOU는 그 내용을 증명하기 위하여 2부를 작성하여 양 당사자가 기명날인 또는 서명한 후 각각 1부씩 보관한다.', fontFamily, fontSize));
  if (contractDate) {
    elements.push(textParagraph(`계약체결일: ${contractDate}`, fontFamily, fontSize, { bold: true, center: true, before: 160 }));
  }

  elements.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          valueCell(`주식회사 ${partyA}\n회사주소: ${r.party_a_address || ''}\n대표이사 ${r.party_a_representative || ''} (인)`, fontFamily, fontSize),
          valueCell(`주식회사 ${partyB}\n회사주소: ${r.party_b_address || ''}\n대표이사 ${r.party_b_representative || ''} (인)`, fontFamily, fontSize),
        ],
      }),
    ],
  }));

  return elements;
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function htmlToTextBlocks(html: string) {
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

function buildGenericHtmlTemplateDocxChildren(
  templateBundle: TemplateBundle,
  replacements: Record<string, string>,
  fontFamily: string,
  fontSize: number,
): Paragraph[] {
  const interpolatedHtml = templateBundle.layoutHtml.replace(/\{\{([^}]+)\}\}/g, (_match, key: string) => replacements[key.trim()] ?? '');
  return htmlToTextBlocks(interpolatedHtml).map((line, index) => {
    const isTitle = index === 0 || /^(사업 협력을 위한|양해각서|업무협약서|MOU)/i.test(line);
    const isArticleHeading = /^제\s*\d+\s*조|^제\d+조/.test(line);
    const isBullet = line.startsWith('- ');
    return new Paragraph({
      alignment: isTitle ? AlignmentType.CENTER : AlignmentType.LEFT,
      spacing: { after: isArticleHeading || isTitle ? 180 : 100 },
      bullet: isBullet ? { level: 0 } : undefined,
      children: [
        new TextRun({
          text: isBullet ? line.slice(2) : line,
          bold: isTitle || isArticleHeading,
          size: isTitle ? fontSize + 8 : isArticleHeading ? fontSize + 2 : fontSize,
          font: fontFamily,
        }),
      ],
    });
  });
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
  normalizeDocxPackage(zipAfter);
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

// ─── DOCX 테이블 구조 분석 ─────────────────────────────────

/** XML에서 최상위 블록 태그 추출 (중첩 안전) */
function findTopLevelBlocks(xml: string, tagName: string): { content: string; start: number; end: number }[] {
  const blocks: { content: string; start: number; end: number }[] = [];
  const openTag = `<${tagName}`;
  const closeTag = `</${tagName}>`;

  // 정확한 태그만 매칭하는 헬퍼 (예: <w:tbl> 또는 <w:tbl ... 은 매칭, <w:tblPr 은 무시)
  function findExactTag(src: string, from: number): number {
    let idx = from;
    while (idx < src.length) {
      const found = src.indexOf(openTag, idx);
      if (found === -1) return -1;
      const afterChar = src[found + openTag.length];
      if (afterChar === '>' || afterChar === ' ' || afterChar === '/' || afterChar === '\n' || afterChar === '\r') {
        return found;
      }
      idx = found + 1;
    }
    return -1;
  }

  let pos = 0;
  while (pos < xml.length) {
    const start = findExactTag(xml, pos);
    if (start === -1) break;
    let depth = 1;
    let scan = start + openTag.length;
    while (depth > 0 && scan < xml.length) {
      const nextOpen = findExactTag(xml, scan);
      const nextClose = xml.indexOf(closeTag, scan);
      if (nextClose === -1) break;
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        scan = nextOpen + openTag.length;
      } else {
        depth--;
        scan = nextClose + closeTag.length;
      }
    }
    blocks.push({ content: xml.slice(start, scan), start, end: scan });
    pos = scan;
  }
  return blocks;
}

/** w:tc 셀에서 텍스트 추출 */
function extractCellText(cellXml: string): string {
  const texts: string[] = [];
  const regex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let m;
  while ((m = regex.exec(cellXml)) !== null) {
    texts.push(m[1]);
  }
  return texts.join('').trim();
}

function escapeXmlText(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function replaceParagraphsByContains(xmlContent: string, needle: string, replacement: string) {
  if (!needle) return xmlContent;
  const paragraphs = findTopLevelBlocks(xmlContent, 'w:p');
  let nextXml = xmlContent;

  for (let i = paragraphs.length - 1; i >= 0; i--) {
    const paragraph = paragraphs[i];
    const plainText = extractCellText(paragraph.content).replace(/\s+/g, ' ').trim();
    if (!plainText.includes(needle)) continue;

    const pPrMatch = paragraph.content.match(/<w:pPr[\s\S]*?<\/w:pPr>/);
    const pPr = pPrMatch ? pPrMatch[0] : '';
    const runXml = `<w:r><w:t xml:space="preserve">${escapeXmlText(replacement)}</w:t></w:r>`;
    const newParagraph = paragraph.content.replace(/<w:p[^>]*>[\s\S]*<\/w:p>/, (fullMatch) => {
      const openMatch = fullMatch.match(/^<w:p[^>]*>/)?.[0] ?? '<w:p>';
      return `${openMatch}${pPr}${runXml}</w:p>`;
    });

    nextXml = nextXml.slice(0, paragraph.start) + newParagraph + nextXml.slice(paragraph.end);
  }

  return nextXml;
}

/** w:tc 셀에서 gridSpan 추출 */
function extractGridSpan(cellXml: string): number {
  const m = cellXml.match(/<w:gridSpan\s+w:val="(\d+)"/);
  return m ? parseInt(m[1], 10) : 1;
}

/** w:tc 셀이 vMerge 계속(continuation)인지 확인 */
function isVMergeContinuation(cellXml: string): boolean {
  // <w:vMerge/> 또는 <w:vMerge w:val="continue"/> → 병합 계속
  // <w:vMerge w:val="restart"/> → 병합 시작 (= 실제 셀)
  if (!/<w:vMerge/.test(cellXml)) return false;
  return !/<w:vMerge\s+w:val="restart"/.test(cellXml);
}

/** DOCX 템플릿 Buffer에서 테이블 구조 추출 */
export function extractDocxTableStructure(templateBuffer: Buffer): DocxTableStructure {
  const zip = new PizZip(templateBuffer);
  const docXml = zip.file('word/document.xml')?.asText() ?? '';

  const tables = findTopLevelBlocks(docXml, 'w:tbl');
  const result: DocxTableStructure = { tables: [], emptyCells: [], hasEmptyCells: false };

  tables.forEach((tbl, tableIndex) => {
    const tblRows = findTopLevelBlocks(tbl.content, 'w:tr');
    const parsedRows: DocxTableCell[][] = [];
    let headers: string[] = [];

    tblRows.forEach((tr, rowIndex) => {
      const tblCells = findTopLevelBlocks(tr.content, 'w:tc');
      const row: DocxTableCell[] = [];

      tblCells.forEach((tc, colIndex) => {
        if (isVMergeContinuation(tc.content)) return; // 병합 계속은 건너뜀

        const text = extractCellText(tc.content);
        const gridSpan = extractGridSpan(tc.content);
        const isEmpty = text.replace(/[\d.]/g, '').trim() === ''; // 숫자/마침표만 있으면 빈칸 취급

        const cell: DocxTableCell = {
          fieldId: `field_${tableIndex}_${rowIndex}_${colIndex}`,
          tableIndex,
          rowIndex,
          colIndex,
          isEmpty,
          text,
          contextLabel: '',
          gridSpan,
        };
        row.push(cell);
      });

      // 첫 행을 헤더로 인식
      if (rowIndex === 0) {
        headers = row.map(c => c.text);
      }

      parsedRows.push(row);
    });

    // 빈 셀에 contextLabel 매핑 (row 0 포함 — 작성자 소속/직급/명 등 첫 행 빈칸도 감지)
    for (let r = 0; r < parsedRows.length; r++) {
      for (let c = 0; c < parsedRows[r].length; c++) {
        const cell = parsedRows[r][c];
        const leftNeighbor = c > 0 ? parsedRows[r][c - 1] : null;
        cell.contextLabel = (leftNeighbor && !leftNeighbor.isEmpty && leftNeighbor.text)
          ? leftNeighbor.text
          : (r > 0 ? (headers[c] ?? '') : '');
        if (cell.isEmpty) {
          result.emptyCells.push(cell);
        }
      }
    }

    result.tables.push({ tableIndex, headers, rows: parsedRows });
  });

  result.hasEmptyCells = result.emptyCells.length > 0;
  return result;
}

export function collapseWorklogNextPlanRows(docxBuffer: Buffer): Buffer {
  try {
    const zip = new PizZip(docxBuffer);
    const documentPath = 'word/document.xml';
    const docXml = zip.file(documentPath)?.asText();
    if (!docXml) return docxBuffer;

    const paragraphs = findTopLevelBlocks(docXml, 'w:p');
    const nextPlanParagraph = paragraphs.find((paragraph) => {
      const text = extractCellText(paragraph.content).replace(/\s+/g, '');
      return text.includes('차일업무계획');
    });
    if (!nextPlanParagraph) return docxBuffer;

    const tables = findTopLevelBlocks(docXml, 'w:tbl');
    const targetTable = tables.find((table) => {
      if (table.start < nextPlanParagraph.end) return false;
      const rows = findTopLevelBlocks(table.content, 'w:tr');
      if (rows.length < 3) return false;
      const firstRowTexts = findTopLevelBlocks(rows[0].content, 'w:tc')
        .map((cell) => extractCellText(cell.content).replace(/\s+/g, ''));
      return firstRowTexts.includes('번호') && firstRowTexts.includes('작업내용');
    });
    if (!targetTable) return docxBuffer;

    const rows = findTopLevelBlocks(targetTable.content, 'w:tr');
    if (rows.length <= 2) return docxBuffer;

    let nextTableXml = targetTable.content;
    for (let index = rows.length - 1; index >= 2; index--) {
      const row = rows[index];
      nextTableXml = nextTableXml.slice(0, row.start) + nextTableXml.slice(row.end);
    }

    const nextDocXml = docXml.slice(0, targetTable.start) + nextTableXml + docXml.slice(targetTable.end);
    zip.file(documentPath, nextDocXml);
    return Buffer.from(zip.generate({ type: 'nodebuffer' }));
  } catch (error) {
    console.error('[collapseWorklogNextPlanRows]', error);
    return docxBuffer;
  }
}

// ─── Placeholder 주입 ───────────────────────────────────────

/** 빈 셀에 {{field_T_R_C}} placeholder를 주입한 DOCX Buffer 반환 */
export function injectPlaceholders(
  templateBuffer: Buffer,
  structure: DocxTableStructure,
): { modifiedBuffer: Buffer; placeholderMap: Record<string, string> } {
  const zip = new PizZip(templateBuffer);
  let xml = zip.file('word/document.xml')?.asText() ?? '';
  const placeholderMap: Record<string, string> = {};

  // 역순 처리 (뒤에서부터 삽입해야 앞쪽 위치가 안 밀림)
  const sortedCells = [...structure.emptyCells].sort((a, b) => {
    if (a.tableIndex !== b.tableIndex) return b.tableIndex - a.tableIndex;
    if (a.rowIndex !== b.rowIndex) return b.rowIndex - a.rowIndex;
    return b.colIndex - a.colIndex;
  });

  // 테이블/행/셀을 순서대로 찾아 위치 특정
  const tblBlocks = findTopLevelBlocks(xml, 'w:tbl');

  for (const cell of sortedCells) {
    const tbl = tblBlocks[cell.tableIndex];
    if (!tbl) continue;

    const rows = findTopLevelBlocks(tbl.content, 'w:tr');
    const row = rows[cell.rowIndex];
    if (!row) continue;

    const cells = findTopLevelBlocks(row.content, 'w:tc');
    const tc = cells[cell.colIndex];
    if (!tc) continue;

    const placeholder = `{{${cell.fieldId}}}`;
    placeholderMap[cell.fieldId] = cell.contextLabel || `행${cell.rowIndex}_열${cell.colIndex}`;

    // 셀 수직 정렬을 상단(top)으로 강제 설정
    let cellXml = tc.content;
    if (/<w:vAlign[^/]*\/>/.test(cellXml)) {
      cellXml = cellXml.replace(/<w:vAlign[^/]*\/>/, '<w:vAlign w:val="top"/>');
    } else if (/<w:tcPr\/>/.test(cellXml)) {
      cellXml = cellXml.replace(/<w:tcPr\/>/, '<w:tcPr><w:vAlign w:val="top"/></w:tcPr>');
    } else if (/<w:tcPr>/.test(cellXml)) {
      cellXml = cellXml.replace(/<\/w:tcPr>/, '<w:vAlign w:val="top"/></w:tcPr>');
    } else {
      cellXml = cellXml.replace(/(<w:tc[^>]*>)/, '$1<w:tcPr><w:vAlign w:val="top"/></w:tcPr>');
    }

    // 셀 내 XML에서 빈 w:t에 placeholder 삽입
    const hasRunWithText = /<w:r[^>]*>[\s\S]*?<w:t[^>]*>[^<]*<\/w:t>[\s\S]*?<\/w:r>/.test(cellXml);

    if (hasRunWithText) {
      // 기존 텍스트를 placeholder로 교체 (첫 번째 w:t만)
      let replaced = false;
      cellXml = cellXml.replace(/<w:t([^>]*)>([^<]*)<\/w:t>/, (_match, attrs) => {
        if (!replaced) {
          replaced = true;
          return `<w:t${attrs}>${placeholder}</w:t>`;
        }
        return _match;
      });
    } else {
      // w:r이 없으면 </w:p> 앞에 삽입
      cellXml = cellXml.replace(
        /<\/w:p>/,
        `<w:r><w:t xml:space="preserve">${placeholder}</w:t></w:r></w:p>`,
      );
    }

    // 원본 XML에서 해당 셀 영역 교체 (절대 위치 사용)
    const absStart = tbl.start + row.start + tc.start;
    const absEnd = tbl.start + row.start + tc.end;
    xml = xml.slice(0, absStart) + cellXml + xml.slice(absEnd);
  }

  zip.file('word/document.xml', xml);
  const modifiedBuffer = Buffer.from(zip.generate({ type: 'nodebuffer' }));
  return { modifiedBuffer, placeholderMap };
}

// ─── FormData 기반 렌더링 ───────────────────────────────────

/** 빈 셀에 AI 생성 내용을 채운 DOCX 렌더링 */
export async function renderDocxFromFormData(
  templateBuffer: Buffer,
  formData: DocxFormData,
  tableStructure: DocxTableStructure,
  title: string,
  extraReplacements?: DocxReplacement,
): Promise<RenderOutput> {
  const { modifiedBuffer } = injectPlaceholders(templateBuffer, tableStructure);

  const zip = new PizZip(modifiedBuffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{{', end: '}}' },
  });

  try {
    doc.render(formData);
  } catch (e) {
    console.error('[renderDocxFromFormData] docxtemplater render error:', e);
  }

  // 추가 텍스트 치환 (비테이블 영역)
  if (extraReplacements && Object.keys(extraReplacements).length > 0) {
    const zipAfter = doc.getZip();
    const xmlFiles = ['word/document.xml', 'word/header1.xml', 'word/header2.xml', 'word/footer1.xml', 'word/footer2.xml'];
    const paragraphReplacements = Object.entries(extraReplacements).filter(([key, value]) => key.startsWith('__paragraph__:') && value);
    const textReplacements = Object.entries(extraReplacements).filter(([key, value]) => !key.startsWith('__paragraph__:') && key && value);
    for (const xmlPath of xmlFiles) {
      const file = zipAfter.file(xmlPath);
      if (!file) continue;
      let xmlContent = file.asText();
      for (const [oldText, newText] of textReplacements) {
        if (!oldText || !newText) continue;
        const escaped = oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        xmlContent = xmlContent.replace(new RegExp(escaped, 'g'), newText);
      }
      for (const [key, newText] of paragraphReplacements) {
        xmlContent = replaceParagraphsByContains(xmlContent, key.replace('__paragraph__:', ''), newText);
      }
      zipAfter.file(xmlPath, xmlContent);
    }
  }

  // 연락처 열 삭제 + 테이블 너비 100% 설정
  {
    const zz = doc.getZip();
    const dxf = zz.file('word/document.xml');
    if (dxf) {
      let dx = dxf.asText();
      const tables = findTopLevelBlocks(dx, 'w:tbl');
      for (let ti = tables.length - 1; ti >= 0; ti--) {
        const tbl = tables[ti];
        if (!tbl.content.includes('연락처')) continue;
        const rows = findTopLevelBlocks(tbl.content, 'w:tr');
        if (rows.length === 0) continue;
        const firstRowCells = findTopLevelBlocks(rows[0].content, 'w:tc');
        let colIdx = -1;
        for (let ci = 0; ci < firstRowCells.length; ci++) {
          if (extractCellText(firstRowCells[ci].content).includes('연락처')) { colIdx = ci; break; }
        }
        if (colIdx === -1) continue;
        // 각 행에서 해당 열의 셀 제거 (역순)
        let newTblContent = tbl.content;
        for (let ri = rows.length - 1; ri >= 0; ri--) {
          const rowCells = findTopLevelBlocks(rows[ri].content, 'w:tc');
          if (colIdx < rowCells.length) {
            const cellToRemove = rowCells[colIdx];
            const newRowContent = rows[ri].content.slice(0, cellToRemove.start) + rows[ri].content.slice(cellToRemove.end);
            newTblContent = newTblContent.slice(0, rows[ri].start) + newRowContent + newTblContent.slice(rows[ri].end);
          }
        }
        // gridCol 제거 (n번째 gridCol 삭제)
        const gridColRegex = /<w:gridCol[^/]*\/>/g;
        let gcIdx = 0;
        newTblContent = newTblContent.replace(gridColRegex, (match) => {
          return gcIdx++ === colIdx ? '' : match;
        });
        // 테이블 너비를 100%로 설정 (상단 테이블과 동일 너비)
        newTblContent = newTblContent.replace(/<w:tblW[^/]*\/>/, '<w:tblW w:w="5000" w:type="pct"/>');
        dx = dx.slice(0, tbl.start) + newTblContent + dx.slice(tbl.end);
      }
      // ── 1열 테이블: 빈 행 삭제 + 내용 행 높이 자동 맞춤 ──
      const allTables = findTopLevelBlocks(dx, 'w:tbl');
      for (let ti2 = allTables.length - 1; ti2 >= 0; ti2--) {
        const tbl2 = allTables[ti2];
        const rows2 = findTopLevelBlocks(tbl2.content, 'w:tr');
        if (rows2.length <= 1) continue;
        const firstRowCells2 = findTopLevelBlocks(rows2[0].content, 'w:tc');
        if (firstRowCells2.length > 1) continue;

        let modified2 = tbl2.content;
        for (let ri2 = rows2.length - 1; ri2 >= 1; ri2--) {
          const rowCells2 = findTopLevelBlocks(rows2[ri2].content, 'w:tc');
          const allEmpty2 = rowCells2.every(tc2 => {
            const txt = extractCellText(tc2.content);
            return txt.replace(/[\d.]/g, '').trim() === '';
          });
          if (allEmpty2) {
            // 빈 행 삭제
            modified2 = modified2.slice(0, rows2[ri2].start) + modified2.slice(rows2[ri2].end);
          } else {
            // 내용 있는 행: 고정 높이 제거 → 자동 맞춤
            const newRow = rows2[ri2].content.replace(
              /<w:trHeight[^/]*\/>/g, '<w:trHeight w:val="0" w:hRule="auto"/>'
            );
            if (newRow !== rows2[ri2].content) {
              modified2 = modified2.slice(0, rows2[ri2].start) + newRow + modified2.slice(rows2[ri2].end);
            }
          }
        }
        if (modified2 !== tbl2.content) {
          dx = dx.slice(0, tbl2.start) + modified2 + dx.slice(tbl2.end);
        }
      }

      zz.file('word/document.xml', dx);
    }
  }

  // 폰트를 페이퍼로지로 변경 (document.xml + styles.xml + theme)
  const zipFinal = doc.getZip();
  normalizeDocxPackage(zipFinal);
  const fontTargets = ['word/document.xml', 'word/styles.xml', 'word/theme/theme1.xml'];
  for (const xmlPath of fontTargets) {
    const f = zipFinal.file(xmlPath);
    if (!f) continue;
    let content = f.asText();
    content = content.replace(/w:eastAsia="[^"]*"/g, 'w:eastAsia="페이퍼로지"');
    content = content.replace(/w:hAnsi="[^"]*"/g, 'w:hAnsi="페이퍼로지"');
    content = content.replace(/w:ascii="[^"]*"/g, 'w:ascii="페이퍼로지"');
    content = content.replace(/w:cs="[^"]*"/g, 'w:cs="페이퍼로지"');
    // theme 폰트도 교체
    content = content.replace(/<a:latin typeface="[^"]*"/g, '<a:latin typeface="페이퍼로지"');
    content = content.replace(/<a:ea typeface="[^"]*"/g, '<a:ea typeface="페이퍼로지"');
    content = content.replace(/<a:cs typeface="[^"]*"/g, '<a:cs typeface="페이퍼로지"');
    zipFinal.file(xmlPath, content);
  }

  const buffer = Buffer.from(zipFinal.generate({ type: 'nodebuffer' }));

  return {
    buffer,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extension: 'docx',
    fileName: `${title}.docx`,
  };
}
