import { test } from "node:test";
import assert from "node:assert/strict";
import { parseYear, validateEntryCreate, validateEntryUpdate, validateItemInput, validateReorder } from "./validate";

const ID = "3f2b8c1e-1234-4abc-9def-0123456789ab";
const upd = { usage: null, unit_price: null, amount: 1000, amount_overridden: false, memo: null, updated_at: "2026-11-16T03:00:00.123456+00:00" };
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
    assert.equal(ok.value.tax_type, "taxable");
  }
});

test("본문이 객체가 아니면 거부", () => {
  assert.equal(validateEntryCreate(null).ok, false);
  assert.equal(validateEntryUpdate("x").ok, false);
  assert.equal(validateItemInput([], "create").ok, false);
});

test("수정 입력은 item_id·month 를 받지 않는다", () => {
  const r = validateEntryUpdate({ ...upd, item_id: ID, month: "2026-01" });
  assert.ok(r.ok);
  if (r.ok) assert.equal("item_id" in r.value || "month" in r.value, false);
});

test("항목 수정은 is_active 를 받는다, 생성은 무시", () => {
  const u = validateItemInput({ name: "전기", unit: null, default_unit_price: null, tax_type: "taxable", is_active: false }, "update");
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


test("DB 자릿수: usage 1e12 거부·999999999999.999 통과, 소수 자릿수 초과 거부", () => {
  assert.equal(validateEntryCreate({ ...base, usage: 1e12 }).ok, false);
  assert.equal(validateEntryCreate({ ...base, usage: 999999999999.999 }).ok, true);
  assert.equal(validateEntryCreate({ ...base, usage: "0.0004" }).ok, false);
  assert.equal(validateEntryCreate({ ...base, unit_price: "1.234" }).ok, false);
  assert.equal(validateEntryCreate({ ...base, unit_price: "1.23" }).ok, true);
});

test('숫자 문자열 엄격: "0x10"·"1e5"·"1.2.3" 거부', () => {
  assert.equal(validateEntryCreate({ ...base, usage: "0x10" }).ok, false);
  assert.equal(validateEntryCreate({ ...base, usage: "1e5" }).ok, false);
  assert.equal(validateEntryCreate({ ...base, usage: "1.2.3" }).ok, false);
});

test("기록 수정은 모든 칸과 updated_at 이 있어야 한다(빠진 칸 덮어쓰기 방지)", () => {
  assert.equal(validateEntryUpdate({ amount: 5000, memo: "x" }).ok, false);
  assert.equal(validateEntryUpdate({ ...upd, updated_at: undefined }).ok, false);
  const r = validateEntryUpdate(upd);
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.value.updated_at, upd.updated_at);
});

test("항목 수정은 모든 칸이 있어야 한다(숨김 해제·구분 초기화 방지)", () => {
  assert.equal(validateItemInput({ name: "전기" }, "update").ok, false);
  assert.equal(validateItemInput({ name: "전기", unit: null, default_unit_price: null, tax_type: "taxable", is_active: false }, "update").ok, true);
});

test("항목명 정리: NFC·보이지 않는 문자 제거·연속 공백 하나로", () => {
  const r = validateItemInput({ name: " 전기​  요금 ", unit: null, default_unit_price: null, sort_order: 0 }, "create");
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.value.name, "전기 요금");
  const nfd = validateItemInput({ name: "가스", unit: null }, "create");
  assert.ok(nfd.ok);
  if (nfd.ok) assert.equal(nfd.value.name, "가스");
  assert.equal(validateItemInput({ name: "​﻿" }, "create").ok, false);
});

test("항목명 정리: 소프트하이픈·방향 표시 문자도 제거", () => {
  const r = validateItemInput({ name: "전\u00AD기\u200E\u202A\u2066", unit: null }, "create");
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.value.name, "전기");
});

test("과세 구분: 생성 생략은 과세, 잘못된 값 거부, 수정은 필수", () => {
  const c = validateItemInput({ name: "부가세", tax_type: "vat" }, "create");
  assert.ok(c.ok);
  if (c.ok) assert.equal(c.value.tax_type, "vat");
  assert.equal(validateItemInput({ name: "x", tax_type: "free" }, "create").ok, false);
  assert.equal(validateItemInput({ name: "x", unit: null, default_unit_price: null, is_active: true }, "update").ok, false);
  const r = validateItemInput({ name: "x", sort_order: 3, tax_type: "exempt" }, "create");
  assert.ok(r.ok);
  if (r.ok) assert.equal("sort_order" in r.value, false); // 순서는 items/order 로만
});

test("순서 저장 검증: UUID 배열·중복(대소문자 무시)·빈 배열·201개 거부", () => {
  const A = "3f2b8c1e-1234-4abc-9def-0123456789ab";
  const B = "4f2b8c1e-1234-4abc-9def-0123456789ab";
  assert.deepEqual(validateReorder({ ids: [A, B] }), { ok: true, value: [A, B] });
  assert.equal(validateReorder({ ids: [A, A.toUpperCase()] }).ok, false);
  assert.equal(validateReorder({ ids: [] }).ok, false);
  assert.equal(validateReorder({ ids: ["x"] }).ok, false);
  assert.equal(validateReorder({ ids: "x" }).ok, false);
  assert.equal(validateReorder(null).ok, false);
  assert.equal(validateReorder({ ids: Array.from({ length: 201 }, () => A) }).ok, false);
});
