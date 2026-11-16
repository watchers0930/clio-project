import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMonthlyView, buildYearlyView, computeAmount, prevMonth, resolveAmount } from "./calc";
import type { FeeEntry, FeeItem } from "./types";

const item = (id: string, name: string, over: Partial<FeeItem> = {}): FeeItem => ({
  id, name, unit: null, default_unit_price: null, sort_order: 0, is_active: true, ...over,
});
const entry = (id: string, item_id: string, month: string, amount: number, usage: number | null = null): FeeEntry => ({
  id, item_id, month, usage, unit_price: null, amount, amount_overridden: false, memo: null, updated_at: "2026-11-16T00:00:00Z",
});

test("computeAmount 반올림·부동소수", () => {
  assert.equal(computeAmount(0.5, 5), 3);
  assert.equal(computeAmount(1.15, 100), 115);
  assert.equal(computeAmount(-2.5, 1), -3);
  assert.equal(computeAmount(null, 100), null);
  assert.equal(computeAmount(10, null), null);
});

test("resolveAmount — 자동/직접/사용량 없음", () => {
  assert.deepEqual(resolveAmount({ usage: 10, unit_price: 120.5, amount: null, amount_overridden: false }), { amount: 1205, amount_overridden: false });
  assert.deepEqual(resolveAmount({ usage: 10, unit_price: 120.5, amount: 1500, amount_overridden: true }), { amount: 1500, amount_overridden: true });
  assert.deepEqual(resolveAmount({ usage: null, unit_price: null, amount: 50000, amount_overridden: false }), { amount: 50000, amount_overridden: false });
  assert.ok("error" in resolveAmount({ usage: null, unit_price: null, amount: null, amount_overridden: false }));
  assert.ok("error" in resolveAmount({ usage: 1, unit_price: 1, amount: null, amount_overridden: true }));
});

test("resolveAmount — 자동 계산이면 넘어온 금액보다 계산값 우선", () => {
  assert.deepEqual(resolveAmount({ usage: 2, unit_price: 100, amount: 999, amount_overridden: false }), { amount: 200, amount_overridden: false });
});

test("prevMonth 연 경계", () => {
  assert.equal(prevMonth("2026-01"), "2025-12");
  assert.equal(prevMonth("2026-11"), "2026-10");
});

test("buildMonthlyView 1월 전월=전년 12월, 합계", () => {
  const items = [item("e", "전기")];
  const v = buildMonthlyView(items, [entry("1", "e", "2025-12", 1000), entry("2", "e", "2026-01", 1300)], "2026-01");
  assert.equal(v.rows.length, 1);
  assert.equal(v.rows[0].prevAmount, 1000);
  assert.equal(v.rows[0].diff, 300);
  assert.equal(v.total, 1300);
  assert.equal(v.prevTotal, 1000);
});

test("buildMonthlyView 전월 기록 없으면 prevAmount·diff null, prevTotal null", () => {
  const v = buildMonthlyView([item("e", "전기")], [entry("2", "e", "2026-03", 500)], "2026-03");
  assert.equal(v.rows[0].prevAmount, null);
  assert.equal(v.rows[0].diff, null);
  assert.equal(v.prevTotal, null);
  assert.equal(v.total, 500);
});

test("buildMonthlyView 정렬 sort_order → name, 그 달 기록 있는 항목만", () => {
  const items = [item("b", "수도", { sort_order: 1 }), item("a", "가스", { sort_order: 1 }), item("c", "전기", { sort_order: 0 }), item("d", "없음")];
  const v = buildMonthlyView(items, [entry("1", "b", "2026-05", 1), entry("2", "a", "2026-05", 1), entry("3", "c", "2026-05", 1)], "2026-05");
  assert.deepEqual(v.rows.map((r) => r.item.name), ["전기", "가스", "수도"]);
});

test("buildYearlyView 숨긴 항목 기록 포함·빈 달 null·평균단가", () => {
  const items = [item("e", "전기", { is_active: false, sort_order: 0 }), item("g", "일반관리비", { sort_order: 1 }), item("x", "미사용")];
  const entries = [
    entry("1", "e", "2026-01", 12000, 100),
    entry("2", "e", "2026-03", 6500, 50),
    entry("3", "g", "2026-01", 50000),
    entry("4", "e", "2025-12", 9999, 10),
  ];
  const v = buildYearlyView(items, entries, 2026);
  assert.equal(v.rows.length, 2);
  const e = v.rows[0];
  assert.equal(e.item.name, "전기");
  assert.equal(e.months[0], 12000);
  assert.equal(e.months[1], null);
  assert.equal(e.usageTotal, 150);
  assert.equal(e.avgUnitPrice, 123.33);
  assert.equal(e.amountTotal, 18500);
  const g = v.rows[1];
  assert.equal(g.usageTotal, null);
  assert.equal(g.avgUnitPrice, null);
  assert.equal(v.monthTotals[0], 62000);
  assert.equal(v.monthTotals.length, 12);
  assert.equal(v.grandTotal, 68500);
});
