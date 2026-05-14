const WORKLOG_TEMPLATE_PATTERN = /(업무일지|업무\s*일지|work\s*log)/i;

export const WORKLOG_FIELDS = [
  { key: 'author_department', label: '소속팀', type: 'text', autoFill: 'user' as const },
  { key: 'author', label: '작성자', type: 'text', autoFill: 'user' as const },
  { key: 'report_date', label: '작성일자', type: 'date', autoFill: 'document' as const },
  { key: 'today_work', label: '금일업무내용', type: 'textarea', required: true, placeholder: '금일 업무 내용을 입력하세요.' },
  { key: 'note', label: '특이사항', type: 'textarea', placeholder: '특이사항 또는 건의사항을 입력하세요.' },
  { key: 'tomorrow_work', label: '차일업무계획', type: 'textarea', required: true, placeholder: '차일 업무 계획을 입력하세요.' },
  { key: 'source_file_summary', label: 'AI 분석 요약', type: 'textarea', autoFill: 'source' as const, aiAssist: true },
] as const;

export const WORKLOG_TEMPLATE_HTML = [
  '<article class="report-shell worklog-form-shell">',
  '  <table class="worklog-approval-table">',
  '    <tr>',
  '      <td colspan="5" rowspan="3"><p><strong>일일 업무보고서</strong></p></td>',
  '      <td rowspan="3"><p>결</p><p>재</p></td>',
  '      <td><p>작성자</p></td>',
  '      <td><p>팀장</p></td>',
  '    </tr>',
  '    <tr>',
  '      <td></td>',
  '      <td></td>',
  '    </tr>',
  '    <tr>',
  '      <td><p>/</p></td>',
  '      <td><p>/</p></td>',
  '    </tr>',
  '    <tr>',
  '      <td><p><strong>소속팀</strong></p></td>',
  '      <td><p>{{author_department}}</p></td>',
  '      <td><p><strong>작성자</strong></p></td>',
  '      <td><p>{{author}}</p></td>',
  '      <td><p><strong>작성일자</strong></p></td>',
  '      <td colspan="3"><p>{{report_date}}</p></td>',
  '    </tr>',
  '  </table>',
  '  <p><strong>∙금일업무내용</strong></p>',
  '  <table class="worklog-today-table">',
  '    <tr>',
  '      <td colspan="2"><p><strong>업무내용</strong></p></td>',
  '      <td><p><strong>비고</strong></p></td>',
  '    </tr>',
  '    <tr>',
  '      <td colspan="2"><div class="multiline-field">{{today_work}}</div></td>',
  '      <td></td>',
  '    </tr>',
  '    <tr>',
  '      <td><p><strong>특이사항</strong></p></td>',
  '      <td colspan="2"><div class="multiline-field">{{note}}</div></td>',
  '    </tr>',
  '    <tr><td colspan="3"></td></tr>',
  '    <tr><td colspan="3"></td></tr>',
  '  </table>',
  '  <p><strong>∙차일업무계획</strong></p>',
  '  <table class="worklog-next-table">',
  '    <tr>',
  '      <td><p><strong>번호</strong></p></td>',
  '      <td><p><strong>작업내용</strong></p></td>',
  '      <td><p><strong>비고</strong></p></td>',
  '    </tr>',
  '    <tr><td><p>1</p></td><td><div class="multiline-field">{{tomorrow_work}}</div></td><td></td></tr>',
  '  </table>',
  '</article>',
].join('\n');

export const WORKLOG_OUTLINE = [
  '# 업무일지',
  '## 금일업무내용',
  '## 특이사항',
  '## 차일업무계획',
].join('\n');

export function isWorklogTemplateName(templateName: string | null | undefined) {
  return Boolean(templateName && WORKLOG_TEMPLATE_PATTERN.test(templateName));
}

export function getWorklogDocumentTitle(dateStr: string, templateName?: string | null) {
  return `${templateName && templateName.trim() ? templateName.trim() : '업무일지'} (${dateStr} 생성)`;
}
