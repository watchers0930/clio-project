import { test } from "node:test";
import assert from "node:assert/strict";
import { unitPriceOnItemChange, won } from "./format";



test("won 천 단위", () => {
  assert.equal(won(1234567), "1,234,567");
  assert.equal(won(-3000), "-3,000");
});


test("항목 변경 시 단가: 비었거나 이전 기본 단가 그대로면 새 기본 단가, 직접 친 값은 유지", () => {
  const a = { default_unit_price: 120 } as const;
  const b = { default_unit_price: 800 } as const;
  const none = { default_unit_price: null } as const;
  assert.equal(unitPriceOnItemChange("", null, a), "120");
  assert.equal(unitPriceOnItemChange("120", a, b), "800");
  assert.equal(unitPriceOnItemChange("120", a, none), "");
  assert.equal(unitPriceOnItemChange("150", a, b), "150");
});
