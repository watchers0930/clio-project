import { test } from "node:test";
import assert from "node:assert/strict";
import { caretAfterFormat, countSignificant, extractPastedNumber, formatNumberInput, parseNumberInput } from "./number-input";

test("formatNumberInput 쉼표·소수·음수·자릿수", () => {
  assert.equal(formatNumberInput("1234567", { decimals: 0 }), "1,234,567");
  assert.equal(formatNumberInput("1234.567", { decimals: 2 }), "1,234.56");
  assert.equal(formatNumberInput("12.", { decimals: 3 }), "12.");
  assert.equal(formatNumberInput("-5000", { decimals: 0, allowNegative: true }), "-5,000");
  assert.equal(formatNumberInput("-5000", { decimals: 0 }), null);
  assert.equal(formatNumberInput("-", { decimals: 0, allowNegative: true }), "-");
  assert.equal(formatNumberInput("", { decimals: 0 }), "");
  assert.equal(formatNumberInput("1234567890123", { decimals: 0 }), "1,234,567,890,123");
});

test("붙여넣기: 통화·괄호 음수 인식, 숫자 아닌 형식은 null(이전 값 유지)", () => {
  assert.equal(formatNumberInput("₩-1,000", { decimals: 0, allowNegative: true }), "-1,000");
  assert.equal(formatNumberInput("(1,000)", { decimals: 0, allowNegative: true }), "-1,000");
  assert.equal(formatNumberInput("1,234원", { decimals: 0 }), "1,234");
  assert.equal(formatNumberInput(" 1 234 ", { decimals: 0 }), "1,234");
  assert.equal(formatNumberInput("1e3", { decimals: 0 }), null);
  assert.equal(formatNumberInput("abc", { decimals: 0 }), null);
  assert.equal(formatNumberInput("1.2.3", { decimals: 3 }), null);
  assert.equal(formatNumberInput("0x10", { decimals: 0 }), null);
});

test("parseNumberInput", () => {
  assert.equal(parseNumberInput("1,234.5"), 1234.5);
  assert.equal(parseNumberInput(""), null);
  assert.equal(parseNumberInput("-"), null);
  assert.equal(parseNumberInput("12."), 12);
  assert.equal(parseNumberInput("-5,000"), -5000);
});

test("커서: 쉼표가 늘거나 줄어도 같은 숫자 뒤에 남는다", () => {
  // '1234' 에서 끝에 5를 쳐 '12345'(커서 5) → '12,345' 커서 6
  assert.equal(caretAfterFormat("12,345", countSignificant("12345", 5)), 6);
  // '1,234' 의 가운데(1 뒤, raw 커서 1)에 9 입력 → raw '19,234' 커서 2 → '192,34'? 아님: '19,234'→'19,234'
  assert.equal(caretAfterFormat("19,234", countSignificant("19,234", 2)), 2);
  // '12,345' 맨 앞 1 삭제 → raw '2,345' 커서 0 → '2,345' 커서 0
  assert.equal(caretAfterFormat("2,345", countSignificant("2,345", 0)), 0);
  // '1,234,567' 에서 '4' 뒤(raw 커서 5) 삭제 후 raw '1,23,567' 커서 4 → '123,567' 커서 3
  assert.equal(caretAfterFormat("123,567", countSignificant("1,23,567", 4)), 3);
  // 음수·소수
  assert.equal(caretAfterFormat("-1,234.5", countSignificant("-1234.5", 5)), 6);
});

test("입력 실수는 값을 몰래 바꾸지 않고 거부(null)한다", () => {
  // 정수칸에 '.' — 예전엔 뒤를 버려 1,000,000 → 1 이 됐다
  assert.equal(formatNumberInput("1,.000,000", { decimals: 0 }), null);
  assert.equal(formatNumberInput("1000.", { decimals: 0 }), null);
  // 음수 불가 칸의 '-'·괄호
  assert.equal(formatNumberInput("-1,000", { decimals: 0 }), null);
  assert.equal(formatNumberInput("(1,000)", { decimals: 0 }), null);
  // 정수부 자릿수 초과
  assert.equal(formatNumberInput("12345678901234", { decimals: 0 }), null);
  assert.equal(formatNumberInput("12345678901", { decimals: 2, maxInt: 10 }), null);
});

test("붙여넣기: 은행·PDF 문구에서 숫자를 너그럽게 뽑는다", () => {
  assert.equal(extractPastedNumber("KRW 1,234", { decimals: 0 }), "1234");
  assert.equal(extractPastedNumber("금1,000원정", { decimals: 0 }), "1000");
  assert.equal(extractPastedNumber("1,234.56원", { decimals: 0 }), "1234");
  assert.equal(extractPastedNumber("1,234.56", { decimals: 2 }), "1234.56");
  assert.equal(extractPastedNumber("1.234.567", { decimals: 0 }), "1234567");
  assert.equal(extractPastedNumber("(1,000)", { decimals: 0, allowNegative: true }), "-1000");
  assert.equal(extractPastedNumber("₩-1,000", { decimals: 0, allowNegative: true }), "-1000");
  assert.equal(extractPastedNumber("-1,000", { decimals: 0 }), null);
  assert.equal(extractPastedNumber("없음", { decimals: 0 }), null);
});
