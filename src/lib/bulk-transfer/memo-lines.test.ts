import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoLines } from './memo-lines';

test('memoLines: 빈 값은 빈 배열', () => {
  assert.deepEqual(memoLines(null), []);
  assert.deepEqual(memoLines(''), []);
  assert.deepEqual(memoLines('   '), []);
});

test('memoLines: " / " 구분', () => {
  assert.deepEqual(memoLines('김철수 3,000,000 / 이영희 2,500,000 / 박민수 2,500,000'), [
    '김철수 3,000,000',
    '이영희 2,500,000',
    '박민수 2,500,000',
  ]);
});

test('memoLines: " · " 와 줄바꿈 섞여도 구분, 괄호 안 + 는 유지', () => {
  assert.deepEqual(memoLines('최임대(가나빌딩) · 매월 초\n11월부터 600,000 (9월 550,000)'), [
    '최임대(가나빌딩)',
    '매월 초',
    '11월부터 600,000 (9월 550,000)',
  ]);
  assert.deepEqual(memoLines('원천세(국고) 169,000 + 지방소득세 16,880'), ['원천세(국고) 169,000 + 지방소득세 16,880']);
});

test('memoLines: 공백 없는 슬래시(날짜·분수)는 나누지 않는다', () => {
  assert.deepEqual(memoLines('9/4 타행송금'), ['9/4 타행송금']);
});
