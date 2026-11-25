import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutBars } from './bar-scale';

const M = 1_000_000;

test('이상치 없으면 최댓값 기준 비례, 끊김 없음', () => {
  const r = layoutBars([10 * M, 20 * M, 15 * M], 5 * M, 200);
  assert.deepEqual(r.map((b) => b.heightPx), [100, 200, 150]);
  assert.ok(r.every((b) => !b.broken));
  assert.equal(r[1].fixedPx, 50);
});

test('중앙값의 3배를 넘는 달은 최대 높이 + broken, 나머지는 나머지 최댓값 기준 140px', () => {
  // 한 달만 유난히 큰 경우
  const totals = [16_000_000, 250_000_000, 23_000_000, 17_000_000];
  const r = layoutBars(totals, 16_000_000, 200);
  assert.equal(r[1].broken, true);
  assert.equal(r[1].heightPx, 200);
  assert.equal(r[2].heightPx, 140);
  assert.ok(r[0].heightPx > 95 && r[0].heightPx < 110);
  assert.ok([0, 2, 3].every((i) => !r[i].broken));
  // 고정지출 높이는 모든 막대에서 같은 눈금
  assert.equal(r[1].fixedPx, r[2].fixedPx);
});

test('2개월 이하는 이상치 판단을 하지 않는다', () => {
  const r = layoutBars([1 * M, 100 * M], 0, 200);
  assert.ok(r.every((b) => !b.broken));
  assert.equal(r[1].heightPx, 200);
});

test('0원 달은 높이 0', () => {
  const r = layoutBars([0, 10 * M, 12 * M, 200 * M], 0, 200);
  assert.equal(r[0].heightPx, 0);
  assert.equal(r[3].broken, true);
});
