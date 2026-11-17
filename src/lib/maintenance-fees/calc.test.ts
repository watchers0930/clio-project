import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMonthlyView, buildYearlyView, computeAmount, moveFeeItem, prevMonth, resolveAmount, sortFeeItems } from "./calc";
import type { FeeEntry, FeeItem } from "./types";

const item = (id: string, name: string, over: Partial<FeeItem> = {}): FeeItem => ({
  id, name, unit: null, default_unit_price: null, tax_type: "taxable", sort_order: 0, is_active: true, ...over,
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

test("resolveAmount — 계산 금액이 DB 범위(±1e13)를 넘으면 오류", () => {
  assert.ok("error" in resolveAmount({ usage: 1e9, unit_price: 1e10, amount: null, amount_overridden: false }));
});

// 실제 고지서(2026년 10월분 관리비 납입영수증)
const billItems = [
  item("t1", "일반관리비(과)", { sort_order: 1 }),
  item("t2", "관리비공제", { sort_order: 2 }),
  item("t3", "기본전기료", { sort_order: 3 }),
  item("t4", "전기사용료", { sort_order: 4, unit: "kWh" }),
  item("t5", "공동전기료", { sort_order: 5 }),
  item("v", "부가세", { tax_type: "vat", sort_order: 6 }),
  item("x1", "일반관리비(비)", { tax_type: "exempt", sort_order: 7 }),
  item("x2", "전력기금", { tax_type: "exempt", sort_order: 8 }),
  item("x3", "장기수선충당금", { tax_type: "exempt", sort_order: 9 }),
  item("x4", "공동수도료", { tax_type: "exempt", sort_order: 10 }),
];
const billEntries = [
  entry("1", "t1", "2026-10", 83360), entry("2", "t2", "2026-10", -13320), entry("3", "t3", "2026-10", 17780),
  entry("4", "t4", "2026-10", 16360, 135.3), entry("5", "t5", "2026-10", 11630), entry("6", "v", "2026-10", 11580),
  entry("7", "x1", "2026-10", 2850), entry("8", "x2", "2026-10", 1990), entry("9", "x3", "2026-10", 3470), entry("10", "x4", "2026-10", 4000),
];

test("고지서 재현: 공급가액 115,810 · 과세합 127,390 · 비과세합 12,310 · 당월 부과액 139,700", () => {
  const v = buildMonthlyView([...billItems].reverse(), billEntries, "2026-10");
  const sub = Object.fromEntries(v.lines.filter((l) => l.kind === "subtotal").map((l) => [l.key, l.amount]));
  assert.deepEqual(sub, { supply: 115810, taxTotal: 127390, exemptTotal: 12310 });
  assert.equal(v.supply, 115810);
  assert.equal(v.total, 139700);
  const shape = v.lines.map((l) => (l.kind === "item" ? l.row.item.name : l.kind === "header" ? `[${l.taxType}]` : `=${l.key}`));
  assert.deepEqual(shape, [
    "[taxable]", "일반관리비(과)", "관리비공제", "기본전기료", "전기사용료", "공동전기료", "=supply",
    "부가세", "=taxTotal",
    "[exempt]", "일반관리비(비)", "전력기금", "장기수선충당금", "공동수도료", "=exemptTotal",
  ]);
});

test("연도별 소계: 기록 없는 달은 null, 연 합계는 묶음 합", () => {
  const v = buildYearlyView(billItems, billEntries, 2026);
  const subs = v.lines.filter((l) => l.kind === "subtotal");
  const tax = subs.find((l) => l.key === "taxTotal");
  assert.ok(tax && tax.kind === "subtotal");
  assert.equal(tax.months[9], 127390);
  assert.equal(tax.months[0], null);
  assert.equal(tax.total, 127390);
  assert.equal(v.grandTotal, 139700);
});

test("묶음이 비면 그 묶음 줄을 만들지 않는다(비과세만 있는 달)", () => {
  const v = buildMonthlyView(billItems, [entry("7", "x1", "2026-10", 2850)], "2026-10");
  const shape = v.lines.map((l) => (l.kind === "item" ? l.row.item.name : l.kind === "header" ? `[${l.taxType}]` : `=${l.key}`));
  assert.deepEqual(shape, ["[exempt]", "일반관리비(비)", "=exemptTotal"]);
  assert.equal(v.supply, 0);
});

test("전월 소계: 구분별 전월 기록으로 계산, 없으면 null", () => {
  const v = buildMonthlyView(billItems, [...billEntries, entry("p1", "t1", "2026-11", 80000)], "2026-11");
  const supply = v.lines.find((l) => l.kind === "subtotal" && l.key === "supply");
  assert.ok(supply && supply.kind === "subtotal");
  assert.equal(supply.amount, 80000);
  assert.equal(supply.prevAmount, 115810);
});

test("sortFeeItems: 과세 → 부가세 → 비과세, 그 안에서 sort_order", () => {
  const items = [item("x", "수도", { tax_type: "exempt", sort_order: 0 }), item("v", "부가세", { tax_type: "vat" }), item("a", "전기", { sort_order: 5 })];
  assert.deepEqual(sortFeeItems(items).map((i) => i.id), ["a", "v", "x"]);
});

test("moveFeeItem: 같은 구분 안에서만 옮긴다, 끝이면 null", () => {
  assert.deepEqual(moveFeeItem(billItems, "t2", -1)?.slice(0, 2), ["t2", "t1"]);
  assert.equal(moveFeeItem(billItems, "t1", -1), null);
  assert.equal(moveFeeItem(billItems, "t5", 1), null); // 다음은 부가세 — 구분이 달라 못 넘어간다
  assert.equal(moveFeeItem(billItems, "x1", -1), null);
  assert.equal(moveFeeItem(billItems, "nope", 1), null);
  assert.equal(moveFeeItem(billItems, "x3", 1)?.length, billItems.length);
});

test("부가세만 있는 달도 과세 머리줄로 시작", () => {
  const v = buildMonthlyView(billItems, [entry("6", "v", "2026-10", 11580)], "2026-10");
  const shape = v.lines.map((l) => (l.kind === "item" ? l.row.item.name : l.kind === "header" ? `[${l.taxType}]` : `=${l.key}`));
  assert.deepEqual(shape, ["[taxable]", "부가세", "=taxTotal"]);
});
