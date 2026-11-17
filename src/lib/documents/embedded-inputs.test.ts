import { test } from "node:test";
import assert from "node:assert/strict";
import { composeInputsContent, readDocumentInputs, serializeInputsComment, splitInputsContent, stripEmbeddedInputs } from "./embedded-inputs";

test("본문 맨 앞의 입력값 주석(DOCUMENT/PROPOSAL)을 걷어내고 본문만 남긴다", () => {
  const inputs = JSON.stringify({ employer_name: "주식회사 예시", memo: "줄\n바꿈" }); // 값의 줄바꿈은 \n 으로 이스케이프돼 한 줄
  assert.equal(stripEmbeddedInputs(`<!--DOCUMENT_INPUTS:${inputs}-->\n# 표준근로계약서\n본문`), "# 표준근로계약서\n본문");
  assert.equal(stripEmbeddedInputs(`<!--PROPOSAL_INPUTS:{"a":"b"}-->본문`), "본문");
});

test("주석이 없거나 맨 앞이 아니면 그대로 둔다(본문 중간의 같은 문자열은 사용자 내용)", () => {
  assert.equal(stripEmbeddedInputs("# 제목\n본문"), "# 제목\n본문");
  assert.equal(stripEmbeddedInputs('본문 <!--DOCUMENT_INPUTS:{"a":"b"}--> 계속'), '본문 <!--DOCUMENT_INPUTS:{"a":"b"}--> 계속');
  assert.equal(stripEmbeddedInputs(""), "");
});

test("값 안에 '-->' 가 이스케이프 없이 들어간 옛 저장분도 첫 줄 전체를 주석으로 보고 걷어낸다", () => {
  const legacy = '<!--DOCUMENT_INPUTS:{"memo":"1단계 --> 2단계","name":"홍길동"}-->\n# 본문';
  assert.equal(stripEmbeddedInputs(legacy), "# 본문");
  assert.deepEqual(readDocumentInputs({ content: legacy }).inputs, { memo: "1단계 --> 2단계", name: "홍길동" });
});

test("입력값은 DB 칸(input_values)을 먼저 쓰고, 없으면 본문 주석에서 읽는다", () => {
  const content = '<!--DOCUMENT_INPUTS:{"a":"주석값"}-->\n본문';
  assert.deepEqual(readDocumentInputs({ content, input_values: { a: "칸값" } }), { inputs: { a: "칸값" }, body: "본문", hasInputs: true });
  assert.deepEqual(readDocumentInputs({ content }), { inputs: { a: "주석값" }, body: "본문", hasInputs: true });
  // 코멘트 반영 등으로 본문에서 주석이 사라져도 칸 값은 남는다
  assert.deepEqual(readDocumentInputs({ content: "본문만", input_values: { a: "칸값" } }), { inputs: { a: "칸값" }, body: "본문만", hasInputs: true });
  assert.deepEqual(readDocumentInputs({ content: "본문만" }), { inputs: {}, body: "본문만", hasInputs: false });
  assert.deepEqual(readDocumentInputs({ content: null, input_values: null }), { inputs: {}, body: "", hasInputs: false });
  // 칸 값이 문자열 객체가 아니면 무시하고 주석으로
  assert.deepEqual(readDocumentInputs({ content, input_values: ["x"] }).inputs, { a: "주석값" });
});

test("주석 직렬화는 '-->' 를 이스케이프해 다시 읽으면 같은 값", () => {
  const comment = serializeInputsComment({ memo: "a --> b", n: "1" });
  assert.equal(comment.includes("a -->"), false);
  assert.deepEqual(readDocumentInputs({ content: `${comment}\n본문` }), { inputs: { memo: "a --> b", n: "1" }, body: "본문", hasInputs: true });
});

test("화면 편집용 합성: 칸 값이 있고 본문에 주석이 없을 때만 앞에 붙인다(이미 있으면 그대로)", () => {
  assert.equal(composeInputsContent("본문", { a: "1" }), '<!--DOCUMENT_INPUTS:{"a":"1"}-->\n본문');
  const already = '<!--DOCUMENT_INPUTS:{"a":"주석"}-->\n본문';
  assert.equal(composeInputsContent(already, { a: "칸" }), already);
  assert.equal(composeInputsContent("본문", null), "본문");
  assert.equal(composeInputsContent("본문", ["x"]), "본문");
  assert.equal(composeInputsContent(null, { a: "1" }), '<!--DOCUMENT_INPUTS:{"a":"1"}-->\n');
});

test("저장용 분리: 주석이 유효하면 본문과 칸으로 나누고, 아니면 본문만(칸은 손대지 않음)", () => {
  assert.deepEqual(splitInputsContent('<!--DOCUMENT_INPUTS:{"a":"1"}-->\n본문'), { content: "본문", inputValues: { a: "1" } });
  assert.deepEqual(splitInputsContent("본문만"), { content: "본문만", inputValues: undefined });
  // 깨진 주석은 걷어내지 않는다 — 사용자가 쓴 내용일 수 있어 지우면 유실
  assert.deepEqual(splitInputsContent('<!--DOCUMENT_INPUTS:{깨짐-->\n본문'), { content: '<!--DOCUMENT_INPUTS:{깨짐-->\n본문', inputValues: undefined });
  // 합성 → 분리 왕복
  const round = splitInputsContent(composeInputsContent("본문", { memo: "a --> b" }));
  assert.deepEqual(round, { content: "본문", inputValues: { memo: "a --> b" } });
});
