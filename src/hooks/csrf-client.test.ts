import { test } from "node:test";
import assert from "node:assert/strict";
import { isCsrfRejection } from "./csrf-client";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

test("CSRF 토큰 거절(code: csrf_invalid)일 때만 재시도 대상", async () => {
  assert.equal(await isCsrfRejection(json(403, { success: false, error: "보안 토큰이 만료되었거나 유효하지 않습니다.", code: "csrf_invalid" })), true);
});

test("권한 거부·비활성 사용자 등 다른 403 은 재시도하지 않음", async () => {
  assert.equal(await isCsrfRejection(json(403, { success: false, error: "접근 권한이 없습니다." })), false);
  assert.equal(await isCsrfRejection(json(403, { success: false, error: "활성 사용자만 요청할 수 있습니다." })), false);
});

test("403 이 아니거나 본문이 JSON 이 아니면 재시도하지 않음", async () => {
  assert.equal(await isCsrfRejection(json(401, { code: "csrf_invalid" })), false);
  assert.equal(await isCsrfRejection(new Response("forbidden", { status: 403 })), false);
});

test("판정 후에도 원래 응답 본문을 그대로 읽을 수 있음(복제본으로 확인)", async () => {
  const res = json(403, { error: "접근 권한이 없습니다." });
  await isCsrfRejection(res);
  assert.deepEqual(await res.json(), { error: "접근 권한이 없습니다." });
});
