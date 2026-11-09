import { test } from 'node:test';
import assert from 'node:assert/strict';
import { documentStatusLabel, userDocumentUpdateViolation } from '@/lib/documents/document-status';
import { validateDocumentUpdate } from '@/schemas/document-update';
import { buildContentWithInputs, parseEmbeddedInputs } from '@/lib/documents/embedded-inputs';
import { getWeekInfo } from '@/components/weekly-reports/helpers';
import { resolveDocumentInputForm } from '@/lib/documents/resolve-input-form';

test('PATCH accepts only user-settable statuses (workflow states are approval-API only)', () => {
  for (const status of ['draft', 'completed']) {
    assert.equal(validateDocumentUpdate({ status }).ok, true, status);
  }
  for (const status of ['approved', 'in_approval', 'rejected', 'submitted', 'APPROVED', '']) {
    assert.equal(validateDocumentUpdate({ status }).ok, false, status);
  }
  assert.equal(validateDocumentUpdate({ status: 1 }).ok, false);
  assert.equal(validateDocumentUpdate({}).ok, false);
});

test('status transitions: draft<->completed, rejected->draft only; approval-owned docs cannot be reverted or edited', () => {
  assert.equal(userDocumentUpdateViolation('draft', { status: 'completed', content: 'x' }), null);
  assert.equal(userDocumentUpdateViolation('completed', { status: 'draft' }), null);
  assert.equal(userDocumentUpdateViolation('draft', { content: 'x', title: 't' }), null);
  assert.equal(userDocumentUpdateViolation('rejected', { content: 'x' }), null);

  // forging / escaping the approval workflow
  assert.ok(userDocumentUpdateViolation('draft', { status: 'approved' }));
  assert.ok(userDocumentUpdateViolation('in_approval', { status: 'draft' }));
  assert.ok(userDocumentUpdateViolation('approved', { status: 'completed' }));
  assert.ok(userDocumentUpdateViolation('rejected', { status: 'completed' }));
  assert.equal(userDocumentUpdateViolation('rejected', { status: 'draft' }), null);

  // editing locked documents
  for (const locked of ['in_approval', 'submitted', 'approved']) {
    assert.ok(userDocumentUpdateViolation(locked, { content: 'x' }), locked);
    assert.ok(userDocumentUpdateViolation(locked, { title: 'x' }), locked);
  }
  // same-status no-op is not a transition
  assert.equal(userDocumentUpdateViolation('approved', { status: 'approved' }), null);
});

test('status labels are a single source including legacy values', () => {
  assert.equal(documentStatusLabel('in_approval'), '결재중');
  assert.equal(documentStatusLabel('submitted'), '결재중');
  assert.equal(documentStatusLabel('approved'), '승인됨');
  assert.equal(documentStatusLabel('unknown_x'), 'unknown_x');
});

test('embedded inputs round-trip keeps body intact and blocks comment injection', () => {
  const body = '\n# 주간업무\n\n본문 --> 화살표 포함\n';
  const content = `<!--DOCUMENT_INPUTS:${JSON.stringify({ a: '1', b: '2' })}-->${body}`;
  const built = buildContentWithInputs(content, { b: 'x --> <script>' });
  assert.equal(built.ok, true);
  if (!built.ok) return;
  assert.equal(built.changed, true);
  assert.ok(built.content.endsWith(body), 'body must be preserved byte-for-byte');
  const reparsed = parseEmbeddedInputs(built.content);
  assert.equal(reparsed.ok, true);
  if (reparsed.ok) assert.deepEqual(reparsed.inputs, { a: '1', b: 'x --> <script>' });
  // only one comment terminator before the body
  assert.equal(built.content.indexOf('-->'), built.content.length - body.length - 3);

  const same = buildContentWithInputs(content, { a: '1' });
  assert.deepEqual(same, { ok: true, content, changed: false });
  assert.deepEqual(buildContentWithInputs('no comment', { a: '1' }), { ok: false, reason: 'no-comment' });
  assert.equal(parseEmbeddedInputs('<!--DOCUMENT_INPUTS:{"a":1}-->').ok, false);
});

test('weekly grouping uses KST Monday-Sunday weeks and Thursday month attribution', () => {
  // KST 2026-11-01(일) 23:59 → 10월 5주차 / KST 2026-11-02(월) 00:00 → 11월 1주차
  assert.equal(getWeekInfo('2026-11-01T14:59:00Z')?.label, '10월 5주차');
  assert.equal(getWeekInfo('2026-11-01T15:00:00Z')?.label, '11월 1주차');
  assert.equal(getWeekInfo('2026-11-02T00:00:00Z')?.range, '2026.11.02 ~ 11.08');
  assert.equal(getWeekInfo('2026-11-08T23:45:05Z')?.label, '11월 2주차');
  assert.equal(getWeekInfo('not-a-date'), null);
});

test('builtin form docs without template_id resolve even when list API sends placeholder template name', () => {
  // 운영 주간업무 문서 형태: template_id null, 목록 API template='기본', 선두 DOCUMENT_INPUTS
  const content = `<!--DOCUMENT_INPUTS:${JSON.stringify({ report_title: '주간업무' })}-->\n# 주간업무\n`;
  const base = { title: '주간업무 (2026-11-02 생성)', templateId: null, content };
  const placeholder = resolveDocumentInputForm({ ...base, templateName: '기본' });
  assert.equal(placeholder.ok, true);
  if (placeholder.ok) assert.equal(placeholder.form.kind, 'weekly');
  assert.deepEqual(resolveDocumentInputForm({ ...base, templateName: '기본' }), resolveDocumentInputForm({ ...base, templateName: null }));
  // 입력값 편집 대상(4종)이 아닌 빌트인 양식은 '모호'가 아니라 '대상 아님'
  assert.deepEqual(resolveDocumentInputForm({ ...base, title: '품의서 (2026-10-23 생성)', templateName: '기본' }), { ok: false, reason: 'not-target' });
  // 커스텀 DB 템플릿(id 보유)이 빌트인 이름과 겹치면 여전히 차단
  const custom = resolveDocumentInputForm({ ...base, templateId: '11111111-1111-4111-8111-111111111111', templateName: '주간업무' });
  assert.equal(custom.ok, false);
});

test('weekly report documents are identified by stored template name, not only by title', async () => {
  const { isWeeklyReportDocument } = await import('@/lib/documents/weekly-report-document');
  const legacy = `<!--DOCUMENT_INPUTS:${JSON.stringify({ report_title: '토목몰 웹사이트 UIUX 및 기능 개선', report_period: 'x', work_rows: '[]' })}-->\n# 본문`;
  // 운영 사례: 보고서 제목을 바꾼 옛 주간업무(양식명 없음) → 고유 입력값으로 포함
  assert.equal(isWeeklyReportDocument({ title: '토목몰 웹사이트 UIUX 및 기능 개선 (2026-11-06 생성)', content: legacy }), true);
  assert.equal(isWeeklyReportDocument({ title: '주간업무 (2026-11-02 생성)', content: '# 본문' }), true);
  const stamped = (name: string) => `<!--DOCUMENT_INPUTS:${JSON.stringify({ __template_name: name, report_period: 'x', work_rows: '[]' })}-->\n`;
  assert.equal(isWeeklyReportDocument({ title: '아무 제목', content: stamped('주간업무') }), true);
  // 저장된 양식명이 우선: 제목에 '주간 업무'가 있어도 다른 양식이면 제외
  assert.equal(isWeeklyReportDocument({ title: '주간 업무 정리 휴가원', content: stamped('휴가원') }), false);
  assert.equal(isWeeklyReportDocument({ title: '품의서', content: '본문에 report_period 언급' }), false);
  // 제목이 바뀐 주간업무도 양식명이 저장돼 있으면 입력값 편집 대상
  const r = resolveDocumentInputForm({ title: '토목몰 개선 (2026-11-06 생성)', templateId: null, templateName: '기본', content: stamped('주간업무') });
  assert.equal(r.ok && r.form.kind, 'weekly');
});
