import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthRange, prevMonth } from './month-utils';

test('monthRange: 같은 달이면 한 달만', () => {
  assert.deepEqual(monthRange('2026-11', '2026-11'), ['2026-11']);
});

test('monthRange: 연도를 넘어가도 빠짐없이 오름차순', () => {
  assert.deepEqual(monthRange('2025-11', '2026-02'), ['2025-11', '2025-12', '2026-01', '2026-02']);
});

test('monthRange: 역순·잘못된 형식은 빈 배열', () => {
  assert.deepEqual(monthRange('2026-11', '2026-08'), []);
  assert.deepEqual(monthRange('2026-13', '2026-12'), []);
  assert.deepEqual(monthRange('', '2026-12'), []);
});

test('prevMonth: 1월의 전월은 전년 12월', () => {
  assert.equal(prevMonth('2026-01'), '2025-12');
});
