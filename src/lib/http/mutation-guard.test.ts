import { test } from "node:test";
import assert from "node:assert/strict";
import type { NextRequest } from "next/server";
import { withMutationOrInternal } from "./mutation-guard";

const req = (headers: Record<string, string>) => ({ headers: new Headers(headers) }) as unknown as NextRequest;

test("내부 비밀값이 맞으면 내부 호출로 통과(쿠키·CSRF 확인 없이)", async () => {
  process.env.INTERNAL_API_SECRET = "s3cret-value-for-test";
  const r = await withMutationOrInternal(req({ "x-internal-secret": "s3cret-value-for-test" }));
  assert.equal(r.error, null);
  assert.equal(r.internal, true);
});

test("내부 비밀값이 틀리거나 서버 값이 비어 있으면 내부 호출로 인정하지 않음", async () => {
  process.env.INTERNAL_API_SECRET = "s3cret-value-for-test";
  // 사용자 요청 경로로 넘어가 출처 확인에서 막힌다(테스트 환경엔 세션이 없어 인증 단계에서 거절)
  const wrong = await withMutationOrInternal(req({ "x-internal-secret": "wrong" }));
  assert.equal(wrong.internal, false);
  assert.notEqual(wrong.error, null);

  process.env.INTERNAL_API_SECRET = "";
  const empty = await withMutationOrInternal(req({ "x-internal-secret": "" }));
  assert.equal(empty.internal, false);
  assert.notEqual(empty.error, null);
});
