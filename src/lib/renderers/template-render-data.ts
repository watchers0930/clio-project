import type { TemplateBundle } from '@/lib/templates/template-schema';

export interface TemplateRenderSection {
  key: string;
  title: string;
  bodyMarkdown: string;
}

export interface TemplateRenderData {
  isWorklog: boolean;
  replacements: Record<string, string>;
  sections: TemplateRenderSection[];
}

export function stripFencedCode(md: string) {
  if (md.startsWith('```markdown')) return md.replace(/^```markdown\s*\n?/, '').replace(/\n?```\s*$/, '');
  if (md.startsWith('```')) return md.replace(/^```\w*\s*\n?/, '').replace(/\n?```\s*$/, '');
  return md;
}

export function normalizeTitle(title: string): string {
  return title.replace(/\s*\(\d{4}-\d{2}-\d{2}\s+생성\)\s*$/, '').trim();
}

function extractReportDate(title: string): string {
  const match = title.match(/\((\d{4}-\d{2}-\d{2})\s+생성\)/);
  return match?.[1] ?? '';
}

function inferMetadata(markdown: string, title: string) {
  const lines = stripFencedCode(markdown).split('\n').map((line) => line.trim());
  const reportTitle = lines.find((line) => line.startsWith('# '))?.replace(/^# /, '').trim() || normalizeTitle(title);
  const subtitle = lines.find((line) => line && !line.startsWith('#') && !/^[-*] /.test(line)) || '';
  const authorLine = lines.find((line) => /작성자/.test(line));
  const dateLine = lines.find((line) => /작성일/.test(line));
  return {
    report_title: reportTitle,
    subtitle: subtitle === reportTitle ? '' : subtitle,
    author: authorLine?.split(/[:：]/).slice(1).join(':').trim() || '',
    report_date: dateLine?.split(/[:：]/).slice(1).join(':').trim() || extractReportDate(title),
  };
}

function extractSections(markdown: string): TemplateRenderSection[] {
  const lines = stripFencedCode(markdown).split('\n');
  const sections: TemplateRenderSection[] = [];
  let current: TemplateRenderSection | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line.startsWith('## ')) {
      if (current) {
        sections.push({
          key: current.key,
          title: current.title,
          bodyMarkdown: current.bodyMarkdown.trim(),
        });
      }
      const title = line.replace(/^## /, '').trim();
      current = { key: title.replace(/\s+/g, '_').toLowerCase(), title, bodyMarkdown: '' };
      continue;
    }

    if (line.startsWith('# ')) continue;
    if (!current) continue;
    current.bodyMarkdown += `${line}\n`;
  }

  if (current) {
    sections.push({
      key: current.key,
      title: current.title,
      bodyMarkdown: current.bodyMarkdown.trim(),
    });
  }

  return sections;
}

function getSectionBodyFromInputs(sectionTitle: string, documentInputs?: Record<string, string>) {
  if (!documentInputs) return '';
  const normalized = sectionTitle.replace(/\s+/g, '');
  if (normalized.includes('금일업무')) return documentInputs.today_work || '';
  if (normalized.includes('명일업무') || normalized.includes('익일업무') || normalized.includes('차일업무')) return documentInputs.tomorrow_work || '';
  if (normalized === '비고' || normalized.includes('특이사항')) return documentInputs.note || '';
  return '';
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function multilineToListItems(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-*]\s+/, '').replace(/^\d+[.)]\s+/, ''))
    .filter(Boolean)
    .map((line) => `<li><p align="left" style="line-height: 115%; margin-bottom: 0cm">${escapeHtml(line)}</p></li>`)
    .join('\n');
}

function interpolateTemplateValue(value: string, replacements: Record<string, string>) {
  return value.replace(/\{\{([^}]+)\}\}/g, (_match, key: string) => replacements[key.trim()] ?? '');
}

export function buildTemplateRenderData(params: {
  markdown: string;
  title: string;
  templateBundle: TemplateBundle;
  documentInputs?: Record<string, string>;
}): TemplateRenderData {
  const { markdown, title, templateBundle, documentInputs } = params;
  const inferred = inferMetadata(markdown, title);
  const extractedSections = extractSections(markdown);
  const replacements: Record<string, string> = {
    report_title: documentInputs?.report_title || inferred.report_title || normalizeTitle(title),
    subtitle: documentInputs?.subtitle || inferred.subtitle || '',
    author: documentInputs?.author || inferred.author || '',
    report_date: documentInputs?.report_date || inferred.report_date || '',
    author_department: documentInputs?.author_department || '',
    author_position: documentInputs?.author_position || '',
    report_time: documentInputs?.report_time || '',
    report_no: documentInputs?.report_no || '',
    source_file_names: documentInputs?.source_file_names || '',
    source_file_count: documentInputs?.source_file_count || '',
    source_file_summary: documentInputs?.source_file_summary || '',
  };

  Object.entries(documentInputs ?? {}).forEach(([key, value]) => {
    replacements[key] = value || replacements[key] || '';
    if (key.endsWith('_items')) {
      replacements[`${key}_html`] = multilineToListItems(value || '');
    }
  });

  for (const field of templateBundle.fields) {
    const hasInputValue = Object.prototype.hasOwnProperty.call(documentInputs ?? {}, field.key);
    replacements[field.key] = hasInputValue
      ? (documentInputs?.[field.key] || field.placeholder || replacements[field.key] || '')
      : (replacements[field.key] || field.placeholder || '');
    if (field.key.endsWith('_items')) {
      const itemsValue = hasInputValue ? (documentInputs?.[field.key] ?? '') : (field.placeholder || '');
      replacements[`${field.key}_html`] = multilineToListItems(interpolateTemplateValue(itemsValue, replacements));
    }
  }

  const sections = templateBundle.sections.map((section, index) => {
    const matched = extractedSections.find((item) => item.title.replace(/\s+/g, '') === section.title.replace(/\s+/g, '')) || extractedSections[index];
    const inputBody = getSectionBodyFromInputs(section.title, documentInputs);
    replacements[`${section.key}_title`] = matched?.title || section.title;
    replacements[`${section.key}_body`] = matched?.bodyMarkdown || inputBody || '';
    return {
      key: section.key,
      title: matched?.title || section.title,
      bodyMarkdown: matched?.bodyMarkdown || inputBody || '',
    };
  });

  const isWorklog = sections.some((section) => {
    const normalized = section.title.replace(/\s+/g, '');
    return normalized.includes('금일업무') || normalized.includes('명일업무') || normalized.includes('익일업무');
  });

  return {
    isWorklog,
    replacements,
    sections,
  };
}
