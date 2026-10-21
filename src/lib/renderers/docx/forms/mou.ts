/**
 * DOCX 렌더러 — 양해각서(MOU) 전용
 */

import {
  Paragraph,
  Table,
  TableRow,
  WidthType,
} from 'docx';
import type { TemplateBundle } from '@/lib/templates/template-schema';
import {
  valueCell,
  textParagraph,
  bulletParagraph,
  splitItems,
} from '../shared';

export function isMouTemplate(templateBundle: TemplateBundle) {
  return templateBundle.outline.includes('양해각서') || templateBundle.fields.some((field) => field.key === 'party_a_name' || field.key === 'party_b_name');
}

export function buildMouDocxChildren(
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
