import { test } from "node:test";
import assert from "node:assert/strict";
import {
  correctionBody,
  dateRange,
  kstToday,
  validDate,
  pageNumber,
} from "./attendance-validation";
import {
  leaveInput,
  balanceDate,
  leaveFilters,
} from "@/lib/leave/leave-validation";
import { issueCsrfToken, verifyCsrfToken } from "@/lib/csrf";
test("KST rollover, strict dates and bounded ranges", () => {
  assert.equal(kstToday(new Date("2026-10-15T15:00:00Z")), "2026-10-16");
  assert.equal(validDate("2026-02-30"), false);
  assert.throws(() => dateRange("2026-01-01", "2026-04-03"));
  assert.throws(() => pageNumber("1.1", 1, 100));
  assert.throws(() => balanceDate("2199-12-31"));
});
test("correction rejects invalid times, dates, reason and stale input shapes", () => {
  const body = {
    mode: "correct",
    checkInAt: "2025-10-15T09:00:00+09:00",
    checkOutAt: "2025-10-15T18:00:00+09:00",
    reason: "사유",
    version: 0,
  };
  assert.equal(correctionBody("2025-10-15", body).version, 0);
  for (const patch of [
    { reason: "" },
    { version: -1 },
    { checkOutAt: "2025-10-15T08:00:00+09:00" },
    { checkInAt: "2025-10-16T09:00:00+09:00" },
    { checkInAt: "2025-10-15T09:00:00" },
    { mode: "forged" },
  ])
    assert.throws(() => correctionBody("2025-10-15", { ...body, ...patch }));
  assert.equal(
    correctionBody("2025-10-15", { ...body, mode: "restore" }).checkInAt,
    null,
  );
});
test("leave strips client authority fields, rejects bad dates and foreign scope", () => {
  const body = {
    leaveType: "annual",
    startDate: "2026-10-15",
    endDate: "2026-10-16",
    idempotencyKey: "retry",
    deductDays: 0,
    userId: "forged",
    status: "approved",
  };
  const result = leaveInput(body);
  assert.equal(result.deductDays, undefined);
  assert.equal(result.userId, undefined);
  assert.equal(result.status, undefined);
  assert.throws(() => leaveInput({ ...body, startDate: "2026-02-30" }));
  assert.throws(() => leaveInput({ ...body, idempotencyKey: "" }));
  assert.throws(() => leaveFilters(new URLSearchParams({ userId: "someone" })));
});
test("CSRF token is bound to user and login session and rejects tampering/expiry", () => {
  const old = process.env.CSRF_SECRET;
  process.env.CSRF_SECRET = "test-secret-only-not-for-production";
  try {
    const ctx = { userId: "user-a", sessionId: "session-a" };
    const { token } = issueCsrfToken(ctx.userId, ctx.sessionId);
    assert.equal(verifyCsrfToken(token, ctx), true);
    assert.equal(verifyCsrfToken(token, { ...ctx, userId: "user-b" }), false);
    assert.equal(
      verifyCsrfToken(token, { ...ctx, sessionId: "session-b" }),
      false,
    );
    assert.equal(verifyCsrfToken(token + "x", ctx), false);
    assert.equal(verifyCsrfToken(token + ".extra", ctx), false);
    const now = Date.now;
    Date.now = () => now() + 3600001;
    try {
      assert.equal(verifyCsrfToken(token, ctx), false);
    } finally {
      Date.now = now;
    }
  } finally {
    if (old === undefined) delete process.env.CSRF_SECRET;
    else process.env.CSRF_SECRET = old;
  }
});
