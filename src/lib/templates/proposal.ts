import type { TemplateBundle, TemplateFieldDefinition, TemplateSectionDefinition } from '@/lib/templates/template-schema';

const PROPOSAL_TEMPLATE_PATTERN = /^제안서$/;

export const PROPOSAL_FIELDS: TemplateFieldDefinition[] = [
  { key: 'report_title', label: '문서 제목', type: 'text', required: true, placeholder: '예: 2026 통합 운영체계 구축 제안서' },
  { key: 'demand_org', label: '수요기관명', type: 'text', required: true, placeholder: '예: 한국OO공단' },
  { key: 'proposer_name', label: '제안사명', type: 'text', required: true, placeholder: '예: 클리오 주식회사' },
  { key: 'project_name', label: '사업명 또는 과업명', type: 'text', required: true, placeholder: '예: 문서 운영 플랫폼 고도화 사업' },
  { key: 'proposal_objective', label: '제안 목적', type: 'textarea', required: true, placeholder: '예: 기관의 문서 생산성과 협업 흐름을 개선하기 위한 목적과 기대 효과를 입력합니다.' },
  { key: 'scope_summary', label: '핵심 수행 범위', type: 'textarea', required: true, placeholder: '예: 분석, 설계, 구축, 테스트, 교육, 안정화 등 핵심 범위를 입력합니다.' },
  { key: 'special_notes', label: '특기사항 또는 작성 메모', type: 'textarea', required: true, placeholder: '예: 기관 요청사항, 유의점, 강조할 방향, 제외 범위를 입력합니다.' },
];

export const PROPOSAL_SECTIONS: TemplateSectionDefinition[] = [
  { key: 'proposal_overview', title: '1. 제안 개요', prompt: '문서 제목, 수요기관, 사업명, 제안 목적을 반영해 제안 개요를 공식 문체로 작성합니다.' },
  { key: 'project_understanding', title: '2. 사업 이해 및 추진 방향', prompt: '참조자료를 기반으로 현황, 문제점, 과업 이해, 추진 방향을 정리합니다. 근거가 부족한 값은 [확인필요]로 남깁니다.' },
  { key: 'scope_and_deliverables', title: '3. 수행 범위 및 세부 내용', prompt: '핵심 수행 범위를 기반으로 포함 범위, 세부 작업, 주요 산출물을 작성합니다.' },
  { key: 'execution_plan', title: '4. 수행 방법 및 일정 계획', prompt: '과업 수행 절차와 예상 일정을 단계별로 작성합니다. 일정이 불명확하면 일반적인 단계 기준으로 작성하고 [확인필요]를 병기합니다.' },
  { key: 'organization_plan', title: '5. 수행 조직 및 인력 투입 계획', prompt: '제안사 수행 조직, 역할, 연락 체계를 일반적인 제안서 형식으로 작성합니다. 특정 인력이 없으면 역할 중심으로 작성합니다.' },
  { key: 'quality_and_risk', title: '6. 품질보증 및 위험관리 방안', prompt: '품질관리 방안과 예상 위험요소 및 대응방안을 작성합니다.' },
  { key: 'pricing_and_terms', title: '7. 사업비 산출 및 계약 조건', prompt: '참조자료에 비용 정보가 있으면 반영하고, 없으면 비용 확정 없이 일반적인 계약 조건과 [확인필요] 항목을 작성합니다.' },
  { key: 'special_and_approval', title: '8. 기타 제안사항 및 승인', prompt: '특기사항 또는 작성 메모를 반영해 마무리 문안과 승인 안내를 작성합니다.' },
];

const PROPOSAL_OUTLINE = [
  '# 제안서',
  '## 1. 제안 개요',
  '## 2. 사업 이해 및 추진 방향',
  '## 3. 수행 범위 및 세부 내용',
  '## 4. 수행 방법 및 일정 계획',
  '## 5. 수행 조직 및 인력 투입 계획',
  '## 6. 품질보증 및 위험관리 방안',
  '## 7. 사업비 산출 및 계약 조건',
  '## 8. 기타 제안사항 및 승인',
].join('\n');

function buildProposalHtml(sections: TemplateSectionDefinition[]) {
  const tocItems = sections
    .map((section) => `<li>{{${section.key}_title}}</li>`)
    .join('');
  const sectionHtml = sections
    .map((section) => [
      '<section class="report-section proposal-section">',
      `  <h2>{{${section.key}_title}}</h2>`,
      `  <div class="section-body">{{${section.key}_body}}</div>`,
      '</section>',
    ].join('\n'))
    .join('\n');

  return [
    '<article class="report-shell proposal-shell">',
    '  <header class="report-header proposal-header">',
    '    <p class="proposal-eyebrow">BUSINESS MANAGEMENT INTERGRATED CONSULTING &amp; SERVICES</p>',
    '    <h1>{{report_title}}</h1>',
    '    <div class="report-meta proposal-meta">',
    '      <span>수요기관 {{demand_org}}</span>',
    '      <span>제안사 {{proposer_name}}</span>',
    '      <span>사업명 {{project_name}}</span>',
    '    </div>',
    '  </header>',
    '  <section class="report-section proposal-summary">',
    '    <h2>핵심 입력 정보</h2>',
    '    <div class="section-body">',
    '      <p><strong>제안 목적</strong></p>',
    '      <p>{{proposal_objective}}</p>',
    '      <p><strong>핵심 수행 범위</strong></p>',
    '      <p>{{scope_summary}}</p>',
    '      <p><strong>특기사항 또는 작성 메모</strong></p>',
    '      <p>{{special_notes}}</p>',
    '    </div>',
    '  </section>',
    '  <nav class="report-toc">',
    '    <h2>목차</h2>',
    `    <ol>${tocItems}</ol>`,
    '  </nav>',
    `  ${sectionHtml}`,
    '</article>',
  ].join('\n');
}

export function isProposalTemplateName(templateName: string | null | undefined) {
  return Boolean(templateName && PROPOSAL_TEMPLATE_PATTERN.test(templateName.trim()));
}

export function createProposalTemplateBundle(): TemplateBundle {
  return {
    version: 1,
    mode: 'html-template',
    layoutHtml: buildProposalHtml(PROPOSAL_SECTIONS),
    outline: PROPOSAL_OUTLINE,
    fields: [...PROPOSAL_FIELDS],
    sections: [...PROPOSAL_SECTIONS],
  };
}
