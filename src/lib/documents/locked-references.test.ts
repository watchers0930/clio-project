import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLockedReferenceFilter, isLockedDocumentError } from '@/lib/documents/locked-references';

const ID = '8ca93f49-8e25-4eb6-93a4-3ada1593623d';

test('locked reference filter: one PostgREST or-clause per column for a valid uuid', () => {
  assert.equal(buildLockedReferenceFilter(['created_by'], ID), `created_by.eq.${ID}`);
  assert.equal(
    buildLockedReferenceFilter(['parent_id', 'origin_document_id'], ID),
    `parent_id.eq.${ID},origin_document_id.eq.${ID}`,
  );
});

test('locked reference filter: rejects non-uuid ids (filter injection, builtin template ids) and empty columns', () => {
  assert.equal(buildLockedReferenceFilter(['template_id'], 'builtin-weekly-report'), null);
  assert.equal(buildLockedReferenceFilter(['created_by'], `${ID},status.eq.draft`), null);
  assert.equal(buildLockedReferenceFilter(['created_by'], ''), null);
  assert.equal(buildLockedReferenceFilter([], ID), null);
});

test('locked document error: only the 052 approval-lock raise maps to 409', () => {
  assert.equal(isLockedDocumentError({ code: 'P0001', message: '결재 중이거나 승인된 문서는 수정할 수 없습니다.' }), true);
  assert.equal(isLockedDocumentError({ code: 'P0001', message: '결재 상태는 결재 기능으로만 변경할 수 있습니다.' }), true);
  assert.equal(isLockedDocumentError({ code: 'P0001', message: 'leave document locked' }), false);
  assert.equal(isLockedDocumentError({ code: 'P0001' }), false);
  assert.equal(isLockedDocumentError({ code: '23503', message: '결재' }), false);
  assert.equal(isLockedDocumentError(null), false);
  assert.equal(isLockedDocumentError(undefined), false);
});
