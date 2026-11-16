import { test } from "node:test";
import assert from "node:assert/strict";
import { stripEmbeddedInputs } from "./embedded-inputs";

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
