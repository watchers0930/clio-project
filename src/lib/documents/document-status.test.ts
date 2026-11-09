import { test } from 'node:test';
import assert from 'node:assert/strict';
import { documentStatusLabel, userDocumentUpdateViolation } from '@/lib/documents/document-status';
import { validateDocumentUpdate } from '@/schemas/document-update';
import { buildContentWithInputs, parseEmbeddedInputs } from '@/lib/documents/embedded-inputs';
import { getWeekInfo } from '@/components/weekly-reports/helpers';

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
