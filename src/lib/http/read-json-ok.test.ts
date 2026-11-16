import { test } from "node:test";
import assert from "node:assert/strict";
import { readJsonOk } from "./read-json-ok";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

test("성공 응답이면 본문을 돌려준다", async () => {
  const body = await readJsonOk<{ success: boolean; data: { id: string } }>(json(200, { success: true, data: { id: "a" } }), "실패");
  assert.equal(body.data.id, "a");
});

test("HTTP 실패면 서버가 준 사유로 오류를 던진다", async () => {
  await assert.rejects(readJsonOk(json(403, { success: false, error: "보안 토큰이 만료되었거나 유효하지 않습니다." }), "저장 실패"), {
    message: "보안 토큰이 만료되었거나 유효하지 않습니다.",
  });
});

test("200 이어도 success:false 면 실패로 본다", async () => {
  await assert.rejects(readJsonOk(json(200, { success: false, error: "제목이 필요합니다." }), "저장 실패"), { message: "제목이 필요합니다." });
});

test("사유가 없거나 본문이 JSON 이 아니면 기본 문구", async () => {
  await assert.rejects(readJsonOk(json(500, { success: false }), "저장 실패"), { message: "저장 실패" });
  await assert.rejects(readJsonOk(new Response("oops", { status: 502 }), "저장 실패"), { message: "저장 실패" });
  await assert.rejects(readJsonOk(json(400, { error: { message: "형식 오류" } }), "저장 실패"), { message: "형식 오류" });
});
