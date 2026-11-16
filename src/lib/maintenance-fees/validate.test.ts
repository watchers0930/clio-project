import { test } from "node:test";
import assert from "node:assert/strict";
import { parseYear, validateEntryCreate, validateEntryUpdate, validateItemInput } from "./validate";

const ID = "3f2b8c1e-1234-4abc-9def-0123456789ab";
const base = { item_id: ID, month: "2026-01", usage: null, unit_price: null, amount: 1000, amount_overridden: false, memo: null };

test('숫자 필드: "1,234"→1234, ""→null, "abc"·Infinity·1e20 거부', () => {
  const r = validateEntryCreate({ ...base, usage: "1,234", unit_price: "" });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.usage, 1234);
    assert.equal(r.value.unit_price, null);
  }
  assert.equal(validateEntryCreate({ ...base, usage: "abc" }).ok, false);
  assert.equal(validateEntryCreate({ ...base, usage: Infinity }).ok, false);
  assert.equal(validateEntryCreate({ ...base, amount: 1e20 }).ok, false);
  assert.equal(validateEntryCreate({ ...base, usage: -1 }).ok, false);
  assert.equal(validateEntryCreate({ ...base, amount: 10.5 }).ok, false);
  const neg = validateEntryCreate({ ...base, amount: -3000 });
  assert.ok(neg.ok);
});

test('월 형식: "2026-13"·"2026-1"·"1999-01" 거부, "2026-01" 통과', () => {
  assert.equal(validateEntryCreate({ ...base, month: "2026-13" }).ok, false);
  assert.equal(validateEntryCreate({ ...base, month: "2026-1" }).ok, false);
  assert.equal(validateEntryCreate({ ...base, month: "1999-01" }).ok, false);
  assert.equal(validateEntryCreate({ ...base, month: "2026-01" }).ok, true);
});

test("item_id UUID 아님 거부, memo 201자 거부, name 공백만 거부", () => {
  assert.equal(validateEntryCreate({ ...base, item_id: "abc" }).ok, false);
  assert.equal(validateEntryCreate({ ...base, memo: "가".repeat(201) }).ok, false);
  assert.equal(validateItemInput({ name: "   " }, "create").ok, false);
  const ok = validateItemInput({ name: " 전기 ", unit: "kWh", default_unit_price: "120.5" }, "create");
  assert.ok(ok.ok);
  if (ok.ok) {
    assert.equal(ok.value.name, "전기");
    assert.equal(ok.value.default_unit_price, 120.5);
    assert.equal(ok.value.sort_order, 0);
  }
});

test("본문이 객체가 아니면 거부", () => {
  assert.equal(validateEntryCreate(null).ok, false);
  assert.equal(validateEntryUpdate("x").ok, false);
  assert.equal(validateItemInput([], "create").ok, false);
});

test("수정 입력은 item_id·month 를 받지 않는다", () => {
  const r = validateEntryUpdate({ ...base });
  assert.ok(r.ok);
  if (r.ok) assert.equal("item_id" in r.value || "month" in r.value, false);
});

test("항목 수정은 is_active 를 받는다, 생성은 무시", () => {
  const u = validateItemInput({ name: "전기", is_active: false }, "update");
  assert.ok(u.ok);
  if (u.ok) assert.equal(u.value.is_active, false);
  const c = validateItemInput({ name: "전기", is_active: false }, "create");
  assert.ok(c.ok);
  if (c.ok) assert.equal(c.value.is_active, true);
});

test('parseYear: "2026"→2026, "abc"·"1999"·null→null', () => {
  assert.equal(parseYear("2026"), 2026);
  assert.equal(parseYear("abc"), null);
  assert.equal(parseYear("1999"), null);
  assert.equal(parseYear(null), null);
});
