/**
 * PDF 렌더러 — 마크다운 → 스타일된 HTML 반환
 * 서버에서는 print-ready HTML을 반환하고,
 * 클라이언트에서 iframe + window.print() 또는 브라우저 PDF 저장으로 처리
 */

import type { RenderOutput, CorporateTheme } from './types';
import { DEFAULT_THEME } from './types';

function markdownToHtml(md: string, theme: CorporateTheme): string {
  let html = md;

  // 코드블록 래핑 제거
  html = html.replace(/^```\w*\s*\n?/, '').replace(/\n?```\s*$/, '');

  // 헤딩
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // 볼드/이탤릭
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/`(.+?)`/g, '<code>$1</code>');

  // 불릿 리스트
  html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

  // 수평선
  html = html.replace(/^---+$/gm, '<hr/>');

  // 테이블 (간단 처리)
  const tableRegex = /(\|.+\|\n)+/g;
  html = html.replace(tableRegex, (tableBlock) => {
    const rows = tableBlock.trim().split('\n').filter(r => !/^\|[\s\-:|]+\|$/.test(r));
    if (rows.length === 0) return '';
    const headerCells = rows[0].split('|').filter(c => c.trim()).map(c => `<th>${c.trim()}</th>`).join('');
    const bodyRows = rows.slice(1).map(row => {
      const cells = row.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    return `<table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
  });

  // 빈 줄 → 문단 분리
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br/>');

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8"/>
<title>CLIO Document</title>
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
<p>${html}</p>
</body>
</html>`;
}

export async function renderPdf(
  markdown: string,
  title: string,
  theme: CorporateTheme = DEFAULT_THEME,
): Promise<RenderOutput> {
  const html = markdownToHtml(markdown, theme);
  const buffer = Buffer.from(html, 'utf-8');

  return {
    buffer,
    mimeType: 'text/html',
    extension: 'html',
    fileName: `${title}.html`,
  };
}
