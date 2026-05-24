import { createProposalTemplateBundle } from '@/lib/templates/proposal';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function markdownFragmentToHtml(md: string) {
  let html = md.trim();
  if (!html) return '<p class="preview-empty">내용이 비어 있습니다.</p>';

  html = escapeHtml(html);
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

  return html
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => (/^<(h1|h2|h3|ul)/.test(block) ? block : `<p>${block.replace(/\n/g, '<br/>')}</p>`))
    .join('\n');
}

function normalizeTitle(value: string) {
  return value
    .replace(/^\d+(?:\.\d+)*\.?\s*/u, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseMarkdownSections(markdown: string) {
  const sections: Array<{ title: string; body: string }> = [];
  let currentTitle = '';
  let currentLines: string[] = [];

  for (const line of markdown.split('\n')) {
    const match = line.match(/^##\s+(.+)$/);
    if (match) {
      if (currentTitle || currentLines.length) {
        sections.push({ title: currentTitle, body: currentLines.join('\n').trim() });
      }
      currentTitle = match[1].trim();
      currentLines = [];
      continue;
    }

    if (!currentTitle && line.startsWith('# ')) continue;
    currentLines.push(line);
  }

  if (currentTitle || currentLines.length) {
    sections.push({ title: currentTitle, body: currentLines.join('\n').trim() });
  }

  return sections;
}

function findSectionBody(markdownSections: Array<{ title: string; body: string }>, title: string) {
  const normalizedTarget = normalizeTitle(title);
  const matched = markdownSections.find((section) => {
    const normalizedSection = normalizeTitle(section.title);
    return normalizedSection === normalizedTarget
      || normalizedSection.includes(normalizedTarget)
      || normalizedTarget.includes(normalizedSection);
  });
  return matched?.body ?? '';
}

function extractLineValue(markdown: string, labels: string[]) {
  for (const label of labels) {
    const regex = new RegExp(`${label}\\s*[:：]\\s*(.+)`, 'i');
    const match = markdown.match(regex);
    if (match?.[1]?.trim()) return match[1].trim();
  }
  return '';
}

function stripGeneratedSuffix(title: string) {
  return title.replace(/\s*\(\d{4}-\d{2}-\d{2}\s+생성\)\s*$/u, '').trim();
}

type RenderProposalDocumentParams = {
  title: string;
  content: string;
  createdAt?: string;
  documentInputs?: Record<string, string>;
};

function extractEmbeddedInputs(content: string): { inputs: Record<string, string>; markdown: string } {
  const match = content.match(/^<!--PROPOSAL_INPUTS:(.*?)-->\n?/);
  if (!match) return { inputs: {}, markdown: content };
  try {
    return { inputs: JSON.parse(match[1]), markdown: content.slice(match[0].length) };
  } catch {
    return { inputs: {}, markdown: content };
  }
}

export function renderProposalDocumentHtml({
  title,
  content,
  createdAt,
  documentInputs = {},
}: RenderProposalDocumentParams) {
  const { inputs: embeddedInputs, markdown: cleanContent } = extractEmbeddedInputs(content);
  const mergedInputs = { ...embeddedInputs, ...documentInputs };

  const bundle = createProposalTemplateBundle();
  const markdownSections = parseMarkdownSections(cleanContent);
  const overviewBody = findSectionBody(markdownSections, '1. 제안 개요');
  const understandingBody = findSectionBody(markdownSections, '2. 사업 이해 및 추진 방향');
  const scopeBody = findSectionBody(markdownSections, '3. 수행 범위 및 세부 내용');
  const cleanedTitle = stripGeneratedSuffix(title);
  const projectName = mergedInputs.project_name?.trim()
    || cleanedTitle.replace(/\s*제안서\s*$/u, '').trim()
    || cleanedTitle;

  const replacements: Record<string, string> = {
    report_title: mergedInputs.report_title?.trim() || title,
    report_date: createdAt || mergedInputs.report_date || new Date().toISOString().slice(0, 10),
    demand_org: mergedInputs.demand_org?.trim() || extractLineValue(cleanContent, ['수요기관', '발주기관']) || '[수요기관명]',
    proposer_name: mergedInputs.proposer_name?.trim() || extractLineValue(cleanContent, ['제안사', '수행사']) || '[제안사명]',
    project_name: projectName || '[사업명]',
    proposal_objective: mergedInputs.proposal_objective?.trim() || overviewBody.split('\n').find(Boolean) || '[제안 목적]',
    scope_summary: mergedInputs.scope_summary?.trim() || scopeBody.split('\n').find(Boolean) || '[핵심 수행 범위]',
    special_notes: mergedInputs.special_notes?.trim() || understandingBody.split('\n').find(Boolean) || '[특기사항]',
    source_file_summary: mergedInputs.source_file_summary?.trim() || '[참조 문서 요약]',
  };

  bundle.sections.forEach((section) => {
    const body = findSectionBody(markdownSections, section.title);
    replacements[`${section.key}_title`] = section.title;
    replacements[`${section.key}_body`] = markdownFragmentToHtml(body || section.prompt);
  });

  const bodyHtml = bundle.layoutHtml.replace(/\{\{([^}]+)\}\}/g, (_match, key: string) => {
    const val = replacements[key.trim()];
    return val !== undefined ? val : '';
  });

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body>${bodyHtml}</body>
</html>`;
}
