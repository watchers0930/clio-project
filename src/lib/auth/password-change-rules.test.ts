import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePasswordChange } from "./password-change-rules";

test("현재·새 비밀번호가 있고 새 비밀번호가 규칙에 맞으면 통과", () => {
  assert.deepEqual(parsePasswordChange({ currentPassword: "old-pass", newPassword: "new-pass1" }), { ok: true, currentPassword: "old-pass", newPassword: "new-pass1" });
});

test("현재 비밀번호 없이는 거부(열린 세션만으로 변경 금지)", () => {
  assert.equal(parsePasswordChange({ newPassword: "new-pass1" }).ok, false);
  assert.equal(parsePasswordChange({ currentPassword: "", newPassword: "new-pass1" }).ok, false);
  assert.equal(parsePasswordChange({ currentPassword: 123, newPassword: "new-pass1" }).ok, false);
});

test("짧거나 72바이트 초과·현재와 같은 새 비밀번호는 거부", () => {
  assert.equal(parsePasswordChange({ currentPassword: "old-pass", newPassword: "12345" }).ok, false);
  assert.equal(parsePasswordChange({ currentPassword: "old-pass", newPassword: "가".repeat(25) }).ok, false); // 75바이트
  assert.equal(parsePasswordChange({ currentPassword: "same-pass", newPassword: "same-pass" }).ok, false);
  assert.equal(parsePasswordChange({ currentPassword: "old-pass", newPassword: ["x"] }).ok, false);
});

test("본문이 객체가 아니면 거부", () => {
  assert.equal(parsePasswordChange(null).ok, false);
  assert.equal(parsePasswordChange("x").ok, false);
});
