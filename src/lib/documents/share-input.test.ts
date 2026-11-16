import { test } from "node:test";
import assert from "node:assert/strict";
import { parseShareInput } from "./share-input";

const U = "0b6c1f0e-3a3b-4c4d-8e8f-9a9b0c0d1e1f";
const D = "1c7d2a1f-4b4c-4d5e-9f90-ab0c1d2e3f40";

test("사용자 또는 부서 하나 + 허용된 권한이면 통과(권한 기본값 read)", () => {
  assert.deepEqual(parseShareInput({ userId: U }), { ok: true, userId: U, departmentId: null, permission: "read" });
  assert.deepEqual(parseShareInput({ departmentId: D, permission: "edit" }), { ok: true, userId: null, departmentId: D, permission: "edit" });
});

test("대상이 없거나 둘 다 있으면 거부", () => {
  assert.equal(parseShareInput({}).ok, false);
  assert.equal(parseShareInput({ userId: U, departmentId: D }).ok, false);
});

test("uuid 형식이 아니면 거부(DB 오류 500 대신 400)", () => {
  assert.equal(parseShareInput({ userId: "abc" }).ok, false);
  assert.equal(parseShareInput({ departmentId: 123 }).ok, false);
});

test("허용 목록 밖 권한 값은 거부", () => {
  assert.equal(parseShareInput({ userId: U, permission: "owner" }).ok, false);
  assert.equal(parseShareInput({ userId: U, permission: "" }).ok, false);
});

test("본문이 객체가 아니면 거부", () => {
  assert.equal(parseShareInput(null).ok, false);
  assert.equal(parseShareInput("x").ok, false);
});
