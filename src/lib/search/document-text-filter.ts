/**
 * 문서 텍스트 검색 조건(PostgREST or 필터) — 제목은 단어 하나라도, 본문은 '모든' 단어가 있어야 걸린다.
 *
 * 본문을 '하나라도'로 찾으면 흔한 단어(업무·진행 등)로 대부분 문서가 걸려 오답이 많다(2026-11-17 운영 측정: OR 8·17건).
 * '모두'로 찾으면 본문에만 있는 말(예: 임금 지급일)을 정확히 찾는다(같은 측정에서 정답만 1건).
 * 예전에 본문 검색을 뺐던 이유(오탐)는 본문 앞 입력값 JSON 주석 탓이 컸는데, 060 에서 주석을 걷어냈다.
 *
 * 검색어는 사용자 입력이므로 PostgREST 조건 문법(쉼표·괄호·마침표)과 LIKE 와일드카드(% _)를 글자로 취급하도록 감싼다.
 */
export const MAX_SEARCH_TOKENS = 8; // 조건 길이·DB 부담 상한

/** LIKE 와일드카드(% _)와 이스케이프 문자(\)를 글자로 */
function escapeLike(token: string): string {
  return token.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** PostgREST 값 따옴표 감싸기 — 따옴표 안에서는 쉼표·괄호가 구분자가 아니고, " 와 \ 는 \ 로 이스케이프 */
function quoteValue(value: string): string {
  return `"${value.replace(/[\\"]/g, (c) => `\\${c}`)}"`;
}

function cleanTokens(tokens: string[]): string[] {
  return [...new Set(tokens.map((t) => t.trim()).filter(Boolean))].slice(0, MAX_SEARCH_TOKENS);
}

/** 단어가 없으면 null(조건 없이 검색하지 않게) */
export function buildDocumentTextFilter(tokens: string[]): string | null {
  const words = cleanTokens(tokens);
  if (words.length === 0) return null;
  const like = (column: string, word: string) => `${column}.ilike.${quoteValue(`%${escapeLike(word)}%`)}`;
  const titleAny = words.map((w) => like('title', w));
  const bodyAll = `and(${words.map((w) => like('content', w)).join(',')})`;
  return [...titleAny, bodyAll].join(',');
}

/** 본문이 모든 단어를 포함하는지(대소문자 무시) — 결과 점수 계산용 */
export function bodyHasAllTokens(content: string | null | undefined, tokens: string[]): boolean {
  const body = (content ?? '').toLowerCase();
  const words = cleanTokens(tokens);
  return words.length > 0 && words.every((w) => body.includes(w.toLowerCase()));
}
