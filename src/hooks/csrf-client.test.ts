import { test } from "node:test";
import assert from "node:assert/strict";
import { apiMutate, csrfFetch, isCsrfRejection, resetCsrfToken } from "./csrf-client";

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

// ---- 재시도 흐름: 대상 요청을 몇 번 보내는지 센다 (서버 응답 형식이 바뀌어 재시도가 조용히 꺼지는 것을 막는다)
type Reply = { status: number; body: unknown };
function mockFetch(replies: Reply[]) {
  const calls: { url: string; token: string | null }[] = [];
  const original = globalThis.fetch;
  let i = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/csrf") {
      return json(200, { success: true, data: { token: `tok-${calls.length}`, expiresAt: new Date(Date.now() + 3600_000).toISOString() } });
    }
    calls.push({ url, token: new Headers(init?.headers).get("X-CSRF-Token") });
    const r = replies[Math.min(i++, replies.length - 1)];
    return json(r.status, r.body);
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = original; } };
}
const CSRF_REJECT: Reply = { status: 403, body: { success: false, error: "보안 토큰이 만료되었거나 유효하지 않습니다.", code: "csrf_invalid" } };
const ROLE_DENIED: Reply = { status: 403, body: { success: false, error: "접근 권한이 없습니다." } };
const OK: Reply = { status: 200, body: { success: true, data: { id: "x" } } };

test("csrfFetch: CSRF 거절이면 토큰을 다시 받아 1회 재시도(총 2번)", async () => {
  resetCsrfToken();
  const m = mockFetch([CSRF_REJECT, OK]);
  try {
    const res = await csrfFetch("/api/x", { method: "POST", body: "{}" });
    assert.equal(res.status, 200);
    assert.equal(m.calls.length, 2);
    assert.ok(m.calls.every((c) => c.token), "두 번 모두 토큰을 보낸다");
  } finally { m.restore(); }
});

test("csrfFetch: 권한 거부 403 은 다시 보내지 않음(총 1번)", async () => {
  resetCsrfToken();
  const m = mockFetch([ROLE_DENIED, OK]);
  try {
    const res = await csrfFetch("/api/x", { method: "DELETE" });
    assert.equal(res.status, 403);
    assert.equal(m.calls.length, 1);
  } finally { m.restore(); }
});

test("apiMutate: CSRF 거절이면 2번, 권한 거부면 1번", async () => {
  resetCsrfToken();
  let m = mockFetch([CSRF_REJECT, OK]);
  try {
    const r = await apiMutate("/api/x", "PATCH", { a: 1 });
    assert.equal(r.ok, true);
    assert.equal(m.calls.length, 2);
  } finally { m.restore(); }
  resetCsrfToken();
  m = mockFetch([ROLE_DENIED, OK]);
  try {
    const r = await apiMutate("/api/x", "PATCH", { a: 1 });
    assert.equal(r.ok, false);
    assert.equal(r.status, 403);
    assert.equal(m.calls.length, 1);
  } finally { m.restore(); }
});

test("csrfFetch: GET 은 토큰 없이 한 번만", async () => {
  resetCsrfToken();
  const m = mockFetch([OK]);
  try {
    await csrfFetch("/api/x");
    assert.equal(m.calls.length, 1);
    assert.equal(m.calls[0].token, null);
  } finally { m.restore(); }
});
