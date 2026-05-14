import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

function readEnvValue(key) {
  const raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .find((line) => line.startsWith(`${key}=`));
  if (!raw) return '';
  return raw
    .split('=', 2)[1]
    .trim()
    .replace(/^"/, '')
    .replace(/"$/, '')
    .replace(/\\n/g, '');
}

const supabaseUrl = readEnvValue('NEXT_PUBLIC_SUPABASE_URL');
const serviceRoleKey = readEnvValue('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Supabase env is missing.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);
const dotxPath = '/Users/watchers/Desktop/업무일지.dotx';
const templateName = '업무일지';
const templateDescription = '일일 업무 보고 및 실행 계획 기록용 정식 업무일지 템플릿';
const worklogTemplateHtml = [
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
  '      <td><p><strong>특이사항/건의사항</strong></p></td>',
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
  '    <tr><td><p>2</p></td><td></td><td></td></tr>',
  '    <tr><td><p>3</p></td><td></td><td></td></tr>',
  '    <tr><td><p>4</p></td><td></td><td></td></tr>',
  '  </table>',
  '</article>',
].join('\n');
const worklogFields = [
  { key: 'author_department', label: '소속팀', type: 'text', autoFill: 'user' },
  { key: 'author', label: '작성자', type: 'text', autoFill: 'user' },
  { key: 'report_date', label: '작성일자', type: 'date', autoFill: 'document' },
  { key: 'today_work', label: '금일업무내용', type: 'textarea', required: true, placeholder: '금일 업무 내용을 입력하세요.' },
  { key: 'note', label: '특이사항', type: 'textarea', placeholder: '특이사항 또는 건의사항을 입력하세요.' },
  { key: 'tomorrow_work', label: '차일업무계획', type: 'textarea', required: true, placeholder: '차일 업무 계획을 입력하세요.' },
  { key: 'source_file_summary', label: 'AI 분석 요약', type: 'textarea', autoFill: 'source', aiAssist: true },
];
const worklogSections = [
  { key: 'section_1_today', title: '금일업무내용', prompt: '오늘 수행한 업무를 사실 중심으로 정리합니다.' },
  { key: 'section_2_note', title: '특이사항', prompt: '이슈, 건의사항, 지원 필요 내용을 정리합니다.' },
  { key: 'section_3_tomorrow', title: '차일업무계획', prompt: '다음 업무 계획을 번호와 실행 항목 중심으로 정리합니다.' },
];
const worklogOutline = ['# 업무일지', '## 금일업무내용', '## 특이사항', '## 차일업무계획'].join('\n');

const bundle = JSON.stringify({
  version: 1,
  mode: 'html-template',
  layoutHtml: worklogTemplateHtml,
  outline: worklogOutline,
  fields: worklogFields,
  sections: worklogSections,
});

const { data: existingTemplates, error: templateError } = await supabase
  .from('templates')
  .select('id, name, created_by, template_file_id')
  .or('name.ilike.%업무일지%,name.ilike.%일일 업무보고서%,name.ilike.%일일업무보고서%')
  .order('updated_at', { ascending: false });

if (templateError) throw templateError;
if (!existingTemplates?.length) {
  throw new Error('기존 업무일지 템플릿을 찾지 못했습니다.');
}

const [primaryTemplate, ...duplicateTemplates] = existingTemplates;
const dotxBuffer = readFileSync(dotxPath);
const storagePath = `uploads/templates/${randomUUID()}.dotx`;

const { error: storageError } = await supabase.storage
  .from('files')
  .upload(storagePath, dotxBuffer, {
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
    upsert: false,
  });

if (storageError) throw storageError;

const { data: fileRow, error: fileError } = await supabase
  .from('files')
  .insert({
    name: '업무일지.dotx',
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
    size: dotxBuffer.byteLength,
    department_id: null,
    uploaded_by: primaryTemplate.created_by,
    status: 'completed',
    storage_path: storagePath,
    scope: 'company',
  })
  .select('id')
  .single();

if (fileError) throw fileError;

const { error: updateError } = await supabase
  .from('templates')
  .update({
    name: templateName,
    description: templateDescription,
    content: bundle,
    placeholders: [],
    template_file_id: fileRow.id,
    updated_at: new Date().toISOString(),
  })
  .eq('id', primaryTemplate.id);

if (updateError) throw updateError;

if (duplicateTemplates.length > 0) {
  const duplicateIds = duplicateTemplates.map((item) => item.id);
  const { error: deleteError } = await supabase.from('templates').delete().in('id', duplicateIds);
  if (deleteError) throw deleteError;
}

console.log(JSON.stringify({
  updatedTemplateId: primaryTemplate.id,
  uploadedTemplateFileId: fileRow.id,
  deletedDuplicateTemplateIds: duplicateTemplates.map((item) => item.id),
}, null, 2));
