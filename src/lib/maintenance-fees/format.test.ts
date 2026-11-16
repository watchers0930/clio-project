import { test } from "node:test";
import assert from "node:assert/strict";
import { formatNumberInput, parseNumberInput, unitPriceOnItemChange, won } from "./format";

test("formatNumberInput 쉼표·소수·음수", () => {
  assert.equal(formatNumberInput("1234567", { decimals: 0 }), "1,234,567");
  assert.equal(formatNumberInput("1234.567", { decimals: 2 }), "1,234.56");
  assert.equal(formatNumberInput("12.", { decimals: 3 }), "12.");
  assert.equal(formatNumberInput("1.2.3", { decimals: 3 }), "1.23");
  assert.equal(formatNumberInput("-5000", { decimals: 0, allowNegative: true }), "-5,000");
  assert.equal(formatNumberInput("-5000", { decimals: 0 }), "5,000");
  assert.equal(formatNumberInput("-", { decimals: 0, allowNegative: true }), "-");
  assert.equal(formatNumberInput("abc", { decimals: 0 }), "");
});

test("parseNumberInput", () => {
  assert.equal(parseNumberInput("1,234.5"), 1234.5);
  assert.equal(parseNumberInput(""), null);
  assert.equal(parseNumberInput("-"), null);
  assert.equal(parseNumberInput("12."), 12);
  assert.equal(parseNumberInput("-5,000"), -5000);
});

test("won 천 단위", () => {
  assert.equal(won(1234567), "1,234,567");
  assert.equal(won(-3000), "-3,000");
});

test("금액칸(소수 0자리): 점 뒤는 버린다, 정수부 13자리 제한", () => {
  assert.equal(formatNumberInput("12.5", { decimals: 0 }), "12");
  assert.equal(formatNumberInput("1,234.5원", { decimals: 0 }), "1,234");
  assert.equal(formatNumberInput("12345678901234567", { decimals: 0 }), "1,234,567,890,123");
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
