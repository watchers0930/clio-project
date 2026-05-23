import type { TemplateBundle } from '@/lib/templates/template-schema';

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

export function buildTemplatePreviewData(bundle: TemplateBundle, name: string) {
  const replacements: Record<string, string> = {
    report_title: `${name || '문서'} 샘플 제목`,
    subtitle: '템플릿 미리보기용 부제목',
    author: '홍길동',
    author_department: '전략기획팀',
    author_position: '매니저',
    report_date: '2026-04-27',
    report_time: '10:30',
    source_file_count: '2',
    source_file_names: '사업계획서.pdf, 회의록.docx',
    source_file_summary: '선택한 소스 파일의 핵심 요약이 이 영역에 자동으로 반영됩니다.',
    today_work: '주요 실적 정리 및 리스크 검토',
    tomorrow_work: '후속 보고서 정리 및 의사결정안 작성',
    note: '사용자가 직접 입력한 메모나 AI 첨언이 반영됩니다.',
    demand_org: '한국OO공단',
    proposer_name: '클리오 주식회사',
    project_name: '문서 운영 플랫폼 고도화 사업',
    proposal_objective: '기관의 문서 운영 효율성과 협업 품질을 개선하기 위한 제안 목적이 이 영역에 반영됩니다.',
    scope_summary: '분석, 설계, 구축, 테스트, 교육, 안정화 등 핵심 수행 범위가 반영됩니다.',
    special_notes: '기관 요청사항, 제외 범위, 작성 메모가 이 영역에 반영됩니다.',
  };

  for (const field of bundle.fields) {
    if (!replacements[field.key]) {
      replacements[field.key] = field.placeholder || `${field.label} 샘플`;
    }
  }

  bundle.sections.forEach((section, index) => {
    replacements[`${section.key}_title`] = section.title;
    replacements[`${section.key}_body`] = markdownFragmentToHtml(
      `${index + 1}. ${section.prompt}\n\n- 자동 입력 데이터와 AI 생성 결과가 이 영역에 반영됩니다.`
    );
  });

  return replacements;
}

export function renderTemplatePreviewHtml(bundle: TemplateBundle, name: string) {
  const replacements = buildTemplatePreviewData(bundle, name);
  const bodyHtml = bundle.layoutHtml.replace(/\{\{([^}]+)\}\}/g, (_match, key: string) => replacements[key.trim()] ?? '');

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<style>
  body {
    margin: 0;
    padding: 24px;
    background: #f6f7fb;
    color: #1b1f2b;
    font-family: "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
  }
  .report-shell, .worklog-shell {
    max-width: 860px;
    margin: 0 auto;
    background: white;
    border: 1px solid #dde3ea;
    border-radius: 18px;
    padding: 28px;
    box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
  }
  .report-header {
    border-bottom: 2px solid #2e6ff2;
    padding-bottom: 18px;
    margin-bottom: 20px;
  }
  .report-header h1 {
    margin: 0;
    color: #2e6ff2;
    font-size: 28px;
  }
  .report-subtitle {
    margin: 8px 0 0;
    color: #667085;
  }
  .report-meta {
    display: flex;
    gap: 10px 16px;
    flex-wrap: wrap;
    margin-top: 12px;
    color: #475467;
    font-size: 13px;
  }
  .report-toc {
    margin: 0 0 24px;
    padding: 16px 18px;
    border-radius: 14px;
    background: #f8fafc;
    border: 1px solid #dde3ea;
  }
  .report-section {
    margin-bottom: 20px;
  }
  .report-section h2 {
    margin: 0 0 10px;
    padding-left: 10px;
    border-left: 4px solid #2e6ff2;
    font-size: 18px;
  }
  .section-body p {
    margin: 0 0 10px;
    line-height: 1.7;
  }
  .section-body ul {
    margin: 0;
    padding-left: 20px;
  }
  .preview-empty {
    color: #98a2b3;
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
    font-size: 13px;
  }
  .worklog-form-shell p {
    margin: 0;
  }
  .worklog-form-shell .multiline-field {
    min-height: 72px;
    white-space: pre-wrap;
    line-height: 1.7;
  }
</style>
</head>
<body>${bodyHtml}</body>
</html>`;
}
