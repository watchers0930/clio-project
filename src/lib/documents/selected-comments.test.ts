import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSelectedCommentIds, pickDocumentComments, MAX_SELECTED_COMMENTS } from "./selected-comments";

const A = "0b6c1f0e-3a3b-4c4d-8e8f-9a9b0c0d1e1f";
const B = "1c7d2a1f-4b4c-4d5e-9f90-ab0c1d2e3f40";
const DOC = "2d8e3b2a-5c5d-4e6f-a0a1-bc1d2e3f4051";
const OTHER_DOC = "3e9f4c3b-6d6e-4f70-b1b2-cd2e3f405162";

test("선택 코멘트 id: UUID 배열만, 중복 제거, 상한", () => {
  assert.deepEqual(parseSelectedCommentIds([A, B, A]), { ok: true, ids: [A, B] });
  assert.equal(parseSelectedCommentIds([]).ok, false);
  assert.equal(parseSelectedCommentIds(undefined).ok, false);
  assert.equal(parseSelectedCommentIds(A).ok, false);
  assert.equal(parseSelectedCommentIds([A, "x,id.neq.0"]).ok, false);
  const many = Array.from({ length: MAX_SELECTED_COMMENTS + 1 }, (_, i) => `0b6c1f0e-3a3b-4c4d-8e8f-${String(i).padStart(12, "0")}`);
  assert.equal(parseSelectedCommentIds(many).ok, false);
});

test("다른 문서의 코멘트가 하나라도 섞이면 전체 거부(남의 코멘트 유출·상태 변조 차단)", () => {
  const rows = [
    { id: A, document_id: DOC, content: "a", user_id: null },
    { id: B, document_id: OTHER_DOC, content: "b", user_id: null },
  ];
  assert.equal(pickDocumentComments(rows, DOC, [A, B]), null);
  assert.equal(pickDocumentComments(rows.slice(0, 1), DOC, [A, B]), null); // 없는 id
  assert.deepEqual(pickDocumentComments(rows.slice(0, 1), DOC, [A])?.map((r) => r.id), [A]);
});
