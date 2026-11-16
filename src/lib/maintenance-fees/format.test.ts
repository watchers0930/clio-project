import { test } from "node:test";
import assert from "node:assert/strict";
import { formatNumberInput, parseNumberInput, won } from "./format";

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
