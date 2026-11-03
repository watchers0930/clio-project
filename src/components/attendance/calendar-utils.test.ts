import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addMonths,
  approvedLeaveByDate,
  totalLeaveAmount,
  buildMonthGrid,
  monthRange,
  weekdayOf,
} from "./calendar-utils";
import type { LeaveRequestView } from "./types";

test("addMonths는 연도 경계를 넘는다", () => {
  assert.deepEqual(addMonths({ year: 2026, month: 1 }, -1), { year: 2025, month: 12 });
  assert.deepEqual(addMonths({ year: 2026, month: 12 }, 1), { year: 2027, month: 1 });
});

test("monthRange는 1일~말일(윤년 포함)", () => {
  assert.deepEqual(monthRange({ year: 2026, month: 11 }), { from: "2026-11-01", to: "2026-11-30" });
  assert.deepEqual(monthRange({ year: 2028, month: 2 }), { from: "2028-02-01", to: "2028-02-29" });
  assert.deepEqual(monthRange({ year: 2026, month: 2 }), { from: "2026-02-01", to: "2026-02-28" });
});

test("buildMonthGrid는 일요일 시작 주 단위로 채운다", () => {
  const grid = buildMonthGrid({ year: 2026, month: 11 }); // 11/1 = 일요일
  assert.equal(grid.length % 7, 0);
  assert.equal(grid[0].workDate, "2026-11-01");
  assert.equal(weekdayOf(grid[0].workDate), 0);
  assert.equal(grid.filter((s) => s.inMonth).length, 30);
  const feb = buildMonthGrid({ year: 2026, month: 2 }); // 2/1 = 일요일, 28일 → 정확히 4주
  assert.equal(feb.length, 28);
  const aug = buildMonthGrid({ year: 2026, month: 8 }); // 8/1 = 토요일 → 6주
  assert.equal(aug.length, 42);
  assert.equal(aug[0].workDate, "2026-07-26");
  assert.equal(aug[0].inMonth, false);
});

const leave = (p: Partial<LeaveRequestView>): LeaveRequestView => ({
  id: "x", leaveType: "annual", startDate: "2026-11-06", endDate: "2026-11-10",
  halfDaySlot: null, requestedDays: 3, deductDays: 3, status: "approved",
  reason: null, documentId: null, approvalRequestId: null, createdAt: "", ...p,
});

test("승인 휴가만, 주말 제외, 달 경계로 잘라서 펼친다", () => {
  const m = approvedLeaveByDate(
    [
      leave({}), // 11/6(금)~11/10(화) → 6,9,10
      leave({ id: "p", status: "pending", startDate: "2026-11-12", endDate: "2026-11-12" }),
      leave({ id: "h", leaveType: "half_day", halfDaySlot: "pm", startDate: "2026-11-20", endDate: "2026-11-20" }),
      leave({ id: "o", startDate: "2026-10-29", endDate: "2026-11-02" }), // 11/2(월)만
    ],
    { year: 2026, month: 11 },
    new Set(["2026-11-09"]), // 회사휴무(월)
  );
  assert.deepEqual([...m.keys()].sort(), ["2026-11-02", "2026-11-06", "2026-11-10", "2026-11-20"]);
  assert.equal(m.get("2026-11-20")?.[0].full, "오후반차");
  assert.equal(m.get("2026-11-20")?.[0].short, "오후");
  assert.equal(m.get("2026-11-06")?.[0].full, "연차");
  assert.equal(totalLeaveAmount(m), 3.5);
});
