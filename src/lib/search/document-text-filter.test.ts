import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDocumentTextFilter, bodyHasAllTokens, MAX_SEARCH_TOKENS } from "./document-text-filter";

test("제목은 단어 하나라도, 본문은 모든 단어가 있어야 걸리는 조건을 만든다", () => {
  assert.equal(
    buildDocumentTextFilter(["임금", "지급일"]),
    'title.ilike."%임금%",title.ilike."%지급일%",and(content.ilike."%임금%",content.ilike."%지급일%")',
  );
});

test("검색어 안의 PostgREST 구분자·와일드카드·따옴표를 그대로 글자로 취급한다", () => {
  // 쉼표·괄호는 따옴표 안이라 조건을 깨지 못하고, % _ 는 와일드카드가 아닌 글자, " \\ 는 이스케이프
  assert.equal(buildDocumentTextFilter(["a,b)"]), 'title.ilike."%a,b)%",and(content.ilike."%a,b)%")');
  assert.equal(buildDocumentTextFilter(["50%"]), 'title.ilike."%50\\\\%%",and(content.ilike."%50\\\\%%")');
  assert.equal(buildDocumentTextFilter(['x"y']), 'title.ilike."%x\\"y%",and(content.ilike."%x\\"y%")');
});

test(`단어는 최대 ${MAX_SEARCH_TOKENS}개, 빈 단어는 버리고 중복은 한 번만`, () => {
  const many = Array.from({ length: 20 }, (_, i) => `t${i}`);
  const f = buildDocumentTextFilter(many);
  assert.equal((f?.match(/title\.ilike/g) ?? []).length, MAX_SEARCH_TOKENS);
  assert.equal(buildDocumentTextFilter(["a", "", "a"]), 'title.ilike."%a%",and(content.ilike."%a%")');
  assert.equal(buildDocumentTextFilter([]), null);
});

test("본문이 모든 단어를 포함하는지(대소문자 무시)", () => {
  assert.equal(bodyHasAllTokens("임금 지급일은 매월 25일", ["임금", "지급일"]), true);
  assert.equal(bodyHasAllTokens("임금만 있음", ["임금", "지급일"]), false);
  assert.equal(bodyHasAllTokens("ABC", ["abc"]), true);
  assert.equal(bodyHasAllTokens(null, ["a"]), false);
});
