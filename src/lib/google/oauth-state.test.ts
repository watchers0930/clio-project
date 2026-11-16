import { test } from "node:test";
import assert from "node:assert/strict";
import { createOAuthState, oauthStateMatches } from "./oauth-state";

test("state 는 매번 다른 64자리 16진수", () => {
  const a = createOAuthState();
  const b = createOAuthState();
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.notEqual(a, b);
});

test("쿠키와 돌아온 state 가 같을 때만 통과", () => {
  const s = createOAuthState();
  assert.equal(oauthStateMatches(s, s), true);
  assert.equal(oauthStateMatches(s, createOAuthState()), false);
});

test("한쪽이 비었거나 길이가 다르면 거부(예외 없이)", () => {
  const s = createOAuthState();
  assert.equal(oauthStateMatches(undefined, s), false);
  assert.equal(oauthStateMatches(s, null), false);
  assert.equal(oauthStateMatches("", ""), false);
  assert.equal(oauthStateMatches(s, s.slice(1)), false);
});
