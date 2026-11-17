import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDocumentTextFilter, bodyHasAllTokens, buildIlikeAny, cleanSearchTokens, containsPattern, exactLikePattern, MAX_SEARCH_TOKENS, MAX_TOKEN_LENGTH } from "./search-text-filter";

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

test("검색어 정리: 소문자·NFC, '*' 제거(PostgREST 가 % 로 바꿔 전부 일치), 단어 50자·8개 상한, 중복 제거", () => {
  assert.deepEqual(cleanSearchTokens("  임금   지급일 임금 "), ["임금", "지급일"]);
  assert.deepEqual(cleanSearchTokens("*"), []);
  assert.deepEqual(cleanSearchTokens("a*b **"), ["ab"]);
  assert.deepEqual(cleanSearchTokens("ABC"), ["abc"]);
  assert.equal(cleanSearchTokens("x".repeat(80))[0].length, MAX_TOKEN_LENGTH);
  assert.equal(cleanSearchTokens(Array.from({ length: 20 }, (_, i) => `t${i}`).join(" ")).length, MAX_SEARCH_TOKENS);
  assert.deepEqual(cleanSearchTokens("한가"), ["한가"]); // NFD → NFC
});

test("여러 칸 중 하나라도 단어 하나라도(OR) — 파일명·청크·업무일지용, 이스케이프 동일", () => {
  assert.equal(buildIlikeAny(["name"], ["a", "b"]), 'name.ilike."%a%",name.ilike."%b%"');
  assert.equal(buildIlikeAny(["done", "plan"], ["50%"]), 'done.ilike."%50\\\\%%",plan.ilike."%50\\\\%%"');
  assert.equal(buildIlikeAny(["name"], []), null);
});

test("단일 칸 '포함' 패턴(.ilike 용): '*' 제거, % _ \\ 는 글자로", () => {
  assert.equal(containsPattern("계약서"), "%계약서%");
  assert.equal(containsPattern("50%_a\\b"), "%50\\%\\_a\\\\b%");
  assert.equal(containsPattern("a*b"), "%ab%");
  // '*' 뿐이거나 공백뿐이면 '' — ilike '' 는 빈 값만 맞으므로 '전부 일치' 대신 '일치 없음'
  assert.equal(containsPattern("*"), "");
  assert.equal(containsPattern("  "), "");
});

test("정확히 같은 값 패턴(대소문자 무시 비교용): 와일드카드 없음, % _ 는 글자로", () => {
  assert.equal(exactLikePattern("김_철수"), "김\\_철수");
  assert.equal(exactLikePattern(" 홍길동 "), "홍길동");
});
