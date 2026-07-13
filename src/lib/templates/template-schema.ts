import {
  getWorklogDocumentTitle,
  isWorklogTemplateName,
  WORKLOG_OUTLINE,
  WORKLOG_TEMPLATE_HTML,
  WORKLOG_FIELDS,
} from '@/lib/templates/worklog';
import { createProposalTemplateBundle, isProposalTemplateName } from '@/lib/templates/proposal';
import {
  isBusinessPlanTemplateName,
  createBusinessPlanTemplateBundle,
  BUSINESS_PLAN_FIELDS,
  BUSINESS_PLAN_OUTLINE,
  BUSINESS_PLAN_TEMPLATE_HTML,
} from '@/lib/templates/business-plan';
import {
  createEmploymentCertificateTemplateBundle,
  EMPLOYMENT_CERTIFICATE_FIELDS,
  EMPLOYMENT_CERTIFICATE_OUTLINE,
  EMPLOYMENT_CERTIFICATE_TEMPLATE_HTML,
  isEmploymentCertificateTemplateName,
} from '@/lib/templates/employment-certificate';

export interface TemplateFieldDefinition {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'date';
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  autoFill?: 'user' | 'source' | 'document';
  aiAssist?: boolean;
}

export interface TemplateSectionDefinition {
  key: string;
  title: string;
  prompt: string;
}

export interface TemplateBundle {
  version: 1;
  mode: 'html-template';
  layoutHtml: string;
  outline: string;
  fields: TemplateFieldDefinition[];
  sections: TemplateSectionDefinition[];
}

const DEFAULT_FIELDS: TemplateFieldDefinition[] = [
  { key: 'report_title', label: '문서 제목', type: 'text', required: true, placeholder: '예: 2026년 2분기 사업 보고서' },
  { key: 'subtitle', label: '소제목', type: 'text', placeholder: '예: 투자 검토용 보고서' },
  { key: 'author', label: '작성자', type: 'text', autoFill: 'user' },
  { key: 'author_department', label: '소속', type: 'text', autoFill: 'user' },
  { key: 'author_position', label: '직급', type: 'text', autoFill: 'user' },
  { key: 'report_date', label: '작성일', type: 'date', autoFill: 'document' },
  { key: 'report_time', label: '작성시간', type: 'text', autoFill: 'document' },
  { key: 'source_file_names', label: '참조 파일명', type: 'textarea', autoFill: 'source' },
  { key: 'source_file_count', label: '참조 파일 수', type: 'text', autoFill: 'source' },
  { key: 'source_file_summary', label: '참조 파일 요약', type: 'textarea', autoFill: 'source', aiAssist: true },
];

function slugify(value: string, fallback: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || fallback;
}

function parseOutlineSections(outline: string) {
  const sections = outline
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^(#+)\s+/.test(line))
    .map((line, index) => {
      const title = line.replace(/^(#+)\s+/, '').trim();
      return {
        key: `section_${index + 1}_${slugify(title, `section_${index + 1}`)}`,
        title,
        prompt: `${title} 섹션을 보고서 맥락에 맞게 구체적으로 작성합니다.`,
      };
    });

  if (sections.length > 0) return sections;

  return [
    { key: 'section_1_overview', title: '개요', prompt: '문서의 목적과 배경을 요약합니다.' },
    { key: 'section_2_analysis', title: '주요 내용', prompt: '핵심 사실, 분석, 근거를 정리합니다.' },
    { key: 'section_3_conclusion', title: '결론 및 제안', prompt: '결론과 후속 조치를 정리합니다.' },
  ];
}

function buildDefaultHtml(name: string, sections: TemplateSectionDefinition[]) {
  if (isProposalTemplateName(name)) {
    return createProposalTemplateBundle().layoutHtml;
  }

  if (isBusinessPlanTemplateName(name)) {
    return BUSINESS_PLAN_TEMPLATE_HTML;
  }

  if (isWorklogTemplateName(name)) {
    return WORKLOG_TEMPLATE_HTML;
  }

  if (isEmploymentCertificateTemplateName(name)) {
    return EMPLOYMENT_CERTIFICATE_TEMPLATE_HTML;
  }

  const tocItems = sections
    .map((section) => `<li>{{${section.key}_title}}</li>`)
    .join('');
  const sectionHtml = sections
    .map((section) => [
      '<section class="report-section">',
      `  <h2>{{${section.key}_title}}</h2>`,
      `  <div class="section-body">{{${section.key}_body}}</div>`,
      '</section>',
    ].join('\n'))
    .join('\n');

  return [
    '<article class="report-shell">',
    '  <header class="report-header">',
    `    <h1>{{report_title}}</h1>`,
    '    <p class="report-subtitle">{{subtitle}}</p>',
    '    <div class="report-meta">',
    '      <span>작성자 {{author}}</span>',
    '      <span>소속 {{author_department}}</span>',
    '      <span>직급 {{author_position}}</span>',
    '      <span>작성일 {{report_date}}</span>',
    '      <span>참조 파일 {{source_file_count}}건</span>',
    '    </div>',
    '  </header>',
    '  <section class="report-section">',
    '    <h2>참조 자료</h2>',
    '    <div class="section-body">{{source_file_summary}}</div>',
    '  </section>',
    '  <nav class="report-toc">',
    `    <h2>${name} 목차</h2>`,
    `    <ol>${tocItems}</ol>`,
    '  </nav>',
    `  ${sectionHtml}`,
    '</article>',
  ].join('\n');
}

export function createTemplateBundle(params: {
  name: string;
  description?: string | null;
  outline?: string | null;
  placeholders?: unknown;
}) {
  if (isProposalTemplateName(params.name)) {
    const proposalBundle = createProposalTemplateBundle();
    const placeholderFields = Array.isArray(params.placeholders)
      ? params.placeholders
          .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
          .map((item, index) => ({
            key: String(item.key ?? `placeholder_${index + 1}`),
            label: String(item.label ?? item.key ?? `플레이스홀더 ${index + 1}`),
            type: 'text' as const,
            placeholder: typeof item.context === 'string' ? item.context : undefined,
          }))
      : [];

    return {
      ...proposalBundle,
      fields: [
        ...proposalBundle.fields,
        ...placeholderFields.filter((field) => !proposalBundle.fields.some((base) => base.key === field.key)),
      ],
    };
  }

  if (isBusinessPlanTemplateName(params.name)) {
    const bpBundle = createBusinessPlanTemplateBundle();
    const placeholderFields = Array.isArray(params.placeholders)
      ? params.placeholders
          .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
          .map((item, index) => ({
            key: String(item.key ?? `placeholder_${index + 1}`),
            label: String(item.label ?? item.key ?? `플레이스홀더 ${index + 1}`),
            type: 'text' as const,
            placeholder: typeof item.context === 'string' ? item.context : undefined,
          }))
      : [];

    return {
      ...bpBundle,
      fields: [
        ...bpBundle.fields,
        ...placeholderFields.filter((field) => !bpBundle.fields.some((base) => base.key === field.key)),
      ],
    };
  }

  if (isEmploymentCertificateTemplateName(params.name)) {
    const certificateBundle = createEmploymentCertificateTemplateBundle();
    const placeholderFields = Array.isArray(params.placeholders)
      ? params.placeholders
          .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
          .map((item, index) => ({
            key: String(item.key ?? `placeholder_${index + 1}`),
            label: String(item.label ?? item.key ?? `플레이스홀더 ${index + 1}`),
            type: 'text' as const,
            placeholder: typeof item.context === 'string' ? item.context : undefined,
          }))
      : [];

    return {
      ...certificateBundle,
      fields: [
        ...certificateBundle.fields,
        ...placeholderFields.filter((field) => !certificateBundle.fields.some((base) => base.key === field.key)),
      ],
    };
  }

  const outline = (params.outline ?? '').trim() || `# ${params.name}\n## 개요\n## 주요 내용\n## 결론`;
  const resolvedOutline = isWorklogTemplateName(params.name)
    ? WORKLOG_OUTLINE
    : isBusinessPlanTemplateName(params.name)
      ? BUSINESS_PLAN_OUTLINE
      : isEmploymentCertificateTemplateName(params.name)
        ? EMPLOYMENT_CERTIFICATE_OUTLINE
      : outline;
  const sections = parseOutlineSections(resolvedOutline);
  const placeholderFields = Array.isArray(params.placeholders)
    ? params.placeholders
        .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
        .map((item, index) => ({
          key: String(item.key ?? `placeholder_${index + 1}`),
          label: String(item.label ?? item.key ?? `플레이스홀더 ${index + 1}`),
          type: 'text' as const,
          placeholder: typeof item.context === 'string' ? item.context : undefined,
        }))
    : [];

  const baseFields: TemplateFieldDefinition[] = isWorklogTemplateName(params.name)
    ? [...WORKLOG_FIELDS]
    : isBusinessPlanTemplateName(params.name)
      ? [...BUSINESS_PLAN_FIELDS]
      : isEmploymentCertificateTemplateName(params.name)
        ? [...EMPLOYMENT_CERTIFICATE_FIELDS]
      : DEFAULT_FIELDS;
  const fields = [
    ...baseFields,
    ...placeholderFields.filter((field) => !baseFields.some((base) => base.key === field.key)),
  ];

  return {
    version: 1 as const,
    mode: 'html-template' as const,
    layoutHtml: buildDefaultHtml(params.name, sections),
    outline: resolvedOutline,
    fields,
    sections,
  };
}

export function parseTemplateBundle(rawContent: string | null | undefined, fallback: {
  name: string;
  description?: string | null;
  placeholders?: unknown;
}) {
  if (rawContent) {
    try {
      const parsed = JSON.parse(rawContent) as Partial<TemplateBundle>;
      if (parsed?.mode === 'html-template' && parsed.version === 1) {
        if (isProposalTemplateName(fallback.name) || isBusinessPlanTemplateName(fallback.name)) {
          return createTemplateBundle({
            name: fallback.name,
            description: fallback.description,
            outline: rawContent,
            placeholders: fallback.placeholders,
          });
        }
        return {
          version: 1 as const,
          mode: 'html-template' as const,
          layoutHtml: typeof parsed.layoutHtml === 'string' ? parsed.layoutHtml : buildDefaultHtml(fallback.name, Array.isArray(parsed.sections) ? parsed.sections as TemplateSectionDefinition[] : []),
          outline: typeof parsed.outline === 'string' ? parsed.outline : '',
          fields: Array.isArray(parsed.fields)
            ? parsed.fields as TemplateFieldDefinition[]
            : isWorklogTemplateName(fallback.name) ? [...WORKLOG_FIELDS] : [...DEFAULT_FIELDS],
          sections: Array.isArray(parsed.sections) ? parsed.sections as TemplateSectionDefinition[] : parseOutlineSections(typeof parsed.outline === 'string' ? parsed.outline : ''),
        };
      }
    } catch {
      // legacy plain text content
    }
  }

  return createTemplateBundle({
    name: fallback.name,
    description: fallback.description,
    outline: rawContent,
    placeholders: fallback.placeholders,
  });
}

export function serializeTemplateBundle(bundle: TemplateBundle) {
  return JSON.stringify(bundle);
}

export function buildTemplateMarkdownScaffold(bundle: TemplateBundle, documentInputs?: Record<string, string>) {
  const isWorklogBundle = bundle.fields.some((field) => field.key === 'today_work') && bundle.fields.some((field) => field.key === 'tomorrow_work');
  const fieldBlock = bundle.fields
    .map((field) => `- ${field.label}: ${documentInputs?.[field.key] || '[미입력]'}`)
    .join('\n');
  const sectionBlock = bundle.sections
    .map((section) => `## ${section.title}\n- 이 섹션은 ${section.prompt}`)
    .join('\n\n');

  return [
    `# ${documentInputs?.report_title || (isWorklogBundle ? getWorklogDocumentTitle(documentInputs?.report_date || '오늘', '업무일지') : '문서 제목')}`,
    '',
    fieldBlock,
    '',
    sectionBlock,
  ].join('\n');
}
