/**
 * PDF 렌더러 — 마크다운 → 스타일된 HTML 반환
 * 서버에서는 print-ready HTML을 반환하고,
 * 클라이언트에서 iframe + window.print() 또는 브라우저 PDF 저장으로 처리
 */

import type { TemplateBundle } from '@/lib/templates/template-schema';
import type { RenderOutput, CorporateTheme } from './types';
import { DEFAULT_THEME } from './types';
import { buildTemplateRenderData, stripFencedCode } from './template-render-data';

interface RenderPdfOptions {
  templateBundle?: TemplateBundle | null;
  documentInputs?: Record<string, string>;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function markdownFragmentToHtml(md: string): string {
  let html = stripFencedCode(md).trim();
  if (!html) return '';

  html = escapeHtml(html);

  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/`(.+?)`/g, '<code>$1</code>');

  html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

  html = html.replace(/^---+$/gm, '<hr/>');

  const tableRegex = /(\|.+\|\n?)+/g;
  html = html.replace(tableRegex, (tableBlock) => {
    const rows = tableBlock.trim().split('\n').filter((row) => !/^\|[\s\-:|]+\|$/.test(row));
    if (rows.length === 0) return '';
    const headerCells = rows[0].split('|').filter((cell) => cell.trim()).map((cell) => `<th>${cell.trim()}</th>`).join('');
    const bodyRows = rows.slice(1).map((row) => {
      const cells = row.split('|').filter((cell) => cell.trim()).map((cell) => `<td>${cell.trim()}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    return `<table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
  });

  const blocks = html
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      if (/^<(h1|h2|h3|ul|table|hr)/.test(block)) return block;
      return `<p>${block.replace(/\n/g, '<br/>')}</p>`;
    });

  return blocks.join('\n');
}

function markdownToHtmlDocument(md: string, theme: CorporateTheme, title: string): string {
  const fragment = markdownFragmentToHtml(md);
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8"/>
<title>${escapeHtml(title)}</title>
<style>
  @page { size: A4; margin: 20mm; }
  @media print {
    body { margin: 0; padding: 20mm; }
  }
  body {
    font-family: '${theme.fontFamily}', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
    font-size: ${theme.fontSize}pt;
    line-height: 1.6;
    color: #1B1F2B;
    max-width: 800px;
    margin: 0 auto;
    padding: 40px;
  }
  h1 { font-size: 22pt; color: #${theme.primaryColor}; border-bottom: 2px solid #${theme.primaryColor}; padding-bottom: 8px; }
  h2 { font-size: 18pt; color: #1B1F2B; margin-top: 24px; }
  h3 { font-size: 14pt; color: #333; margin-top: 18px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th { background: #${theme.primaryColor}; color: #fff; padding: 8px 12px; text-align: center; }
  td { padding: 8px 12px; border: 1px solid #E2E5EA; }
  tr:nth-child(even) td { background: #F7F8FA; }
  code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; font-family: Consolas, monospace; }
  ul { padding-left: 24px; }
  li { margin: 4px 0; }
  hr { border: none; border-top: 1px solid #E2E5EA; margin: 20px 0; }
</style>
</head>
<body>
${fragment}
</body>
</html>`;
}

function buildTemplateHtml(
  markdown: string,
  title: string,
  theme: CorporateTheme,
  templateBundle: TemplateBundle,
  documentInputs?: Record<string, string>,
): string {
  const data = buildTemplateRenderData({ markdown, title, templateBundle, documentInputs });
  const replacements = { ...data.replacements };

  data.sections.forEach((section) => {
    replacements[`${section.key}_title`] = section.title;
    replacements[`${section.key}_body`] = section.bodyMarkdown ? markdownFragmentToHtml(section.bodyMarkdown) : '<p>[내용 없음]</p>';
  });

  const bodyHtml = templateBundle.layoutHtml.replace(/\{\{([^}]+)\}\}/g, (_match, key: string) => {
    return replacements[key.trim()] ?? '';
  });

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8"/>
<title>${escapeHtml(title)}</title>
<style>
  @page { size: A4; margin: 18mm; }
  body {
    font-family: '${theme.fontFamily}', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
    color: #1B1F2B;
    background: #fff;
    margin: 0;
    padding: 32px;
    line-height: 1.7;
    font-size: ${theme.fontSize}pt;
  }
  .report-shell {
    max-width: 860px;
    margin: 0 auto;
  }
  .report-header {
    padding-bottom: 18px;
    margin-bottom: 22px;
    border-bottom: 2px solid #${theme.primaryColor};
  }
  .report-header h1 {
    font-size: 22pt;
    margin: 0;
    color: #${theme.primaryColor};
  }
  .report-subtitle {
    margin: 10px 0 0;
    color: #667085;
    font-size: 11pt;
  }
  .report-meta {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    margin-top: 14px;
    color: #475467;
    font-size: 10.5pt;
  }
  .report-toc {
    margin: 0 0 26px;
    padding: 18px 20px;
    border: 1px solid #DDE3EA;
    border-radius: 14px;
    background: #F8FAFC;
  }
  .report-toc h2 {
    margin: 0 0 12px;
    font-size: 13pt;
  }
  .report-toc ol {
    margin: 0;
    padding-left: 20px;
  }
  .report-section {
    margin-bottom: 26px;
  }
  .report-section h2 {
    margin: 0 0 12px;
    padding-left: 10px;
    border-left: 4px solid #${theme.primaryColor};
    font-size: 15pt;
  }
  .worklog-form-shell table {
    width: 100%;
    border-collapse: collapse;
    margin: 8px 0 16px;
  }
  .worklog-form-shell td,
  .worklog-form-shell th {
    border: 1px solid #cdd5df;
    padding: 8px 10px;
    vertical-align: top;
    font-size: 10.5pt;
  }
  .worklog-form-shell p {
    margin: 0;
  }
  .worklog-form-shell .multiline-field {
    min-height: 72px;
    white-space: pre-wrap;
    line-height: 1.7;
  }
  .section-body p {
    margin: 0 0 10px;
  }
  .section-body h3 {
    margin: 14px 0 8px;
    font-size: 12pt;
  }
  .section-body table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0;
  }
  .section-body th {
    background: #${theme.primaryColor};
    color: #fff;
    padding: 8px 10px;
    border: 1px solid #DDE3EA;
    text-align: left;
  }
  .section-body td {
    padding: 8px 10px;
    border: 1px solid #DDE3EA;
    vertical-align: top;
  }
  .section-body ul {
    margin: 10px 0;
    padding-left: 20px;
  }
  code {
    background: #F2F4F7;
    padding: 2px 6px;
    border-radius: 4px;
  }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

export async function renderPdf(
  markdown: string,
  title: string,
  theme: CorporateTheme = DEFAULT_THEME,
  options?: RenderPdfOptions,
): Promise<RenderOutput> {
  const html = options?.templateBundle
    ? buildTemplateHtml(markdown, title, theme, options.templateBundle, options.documentInputs)
    : markdownToHtmlDocument(markdown, theme, title);
  const buffer = Buffer.from(html, 'utf-8');

  return {
    buffer,
    mimeType: 'text/html',
    extension: 'html',
    fileName: `${title}.html`,
  };
}
