import { test } from "node:test";
import assert from "node:assert/strict";
import { createDialogStack } from "./dialog-stack";

test("맨 위 창만 top, 닫으면 아래 창이 top", () => {
  const s = createDialogStack();
  const a = s.push();
  const b = s.push();
  assert.equal(s.isTop(a), false);
  assert.equal(s.isTop(b), true);
  s.remove(b);
  assert.equal(s.isTop(a), true);
});

test("가운데 창이 먼저 닫혀도 순서 유지, 없는 id 제거는 무시", () => {
  const s = createDialogStack();
  const a = s.push();
  const b = s.push();
  const c = s.push();
  s.remove(b);
  assert.equal(s.isTop(c), true);
  s.remove(999);
  s.remove(c);
  assert.equal(s.isTop(a), true);
  s.remove(a);
  assert.equal(s.size(), 0);
});
