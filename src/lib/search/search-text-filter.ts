/**
 * 검색 조건(PostgREST or 필터) 공용 — 문서·파일명·파일 본문 조각·업무일지 검색이 모두 이 함수로 조건을 만든다.
 *
 * 검색어는 사용자 입력이므로 PostgREST 조건 문법(쉼표·괄호·마침표)과 LIKE 와일드카드(% _)를 글자로 취급하도록 감싼다.
 * (2026-11-17 운영 확인: 감싸기 전에는 '%' 하나만 검색해도 모든 행이 일치했고, '*' 는 PostgREST 가 % 로 바꿔 역시 전부 일치)
 *
 * 문서는 제목은 단어 하나라도, 본문은 '모든' 단어가 있어야 걸린다.
 * 본문을 '하나라도'로 찾으면 흔한 단어(업무·진행 등)로 대부분 문서가 걸려 오답이 많다(같은 날 운영 측정: OR 8·17건).
 * '모두'로 찾으면 본문에만 있는 말(예: 임금 지급일)을 정확히 찾는다(정답만 1건).
 */
export const MAX_SEARCH_TOKENS = 8; // 조건 길이·DB 부담 상한
export const MAX_TOKEN_LENGTH = 50; // 단어 하나가 URL·조건을 비대하게 만들지 않게
export const MAX_QUERY_LENGTH = 200; // 임베딩·점수 계산에 쓰는 검색어 전체 길이

/** 검색어 → 단어 목록: NFC·소문자, '*' 제거(글자로 찾을 방법이 없고 전부 일치를 만든다), 길이·개수 상한, 중복 제거 */
export function cleanSearchTokens(query: string): string[] {
  const words = query.normalize('NFC').toLowerCase().replace(/\*/g, '').split(/\s+/)
    .map((w) => w.slice(0, MAX_TOKEN_LENGTH))
    .filter(Boolean);
  return [...new Set(words)].slice(0, MAX_SEARCH_TOKENS);
}

/** LIKE 와일드카드(% _)와 이스케이프 문자(\)를 글자로 */
function escapeLike(token: string): string {
  return token.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** PostgREST 값 따옴표 감싸기 — 따옴표 안에서는 쉼표·괄호가 구분자가 아니고, " 와 \ 는 \ 로 이스케이프 */
function quoteValue(value: string): string {
  return `"${value.replace(/[\\"]/g, (c) => `\\${c}`)}"`;
}

function like(column: string, word: string): string {
  return `${column}.ilike.${quoteValue(`%${escapeLike(word)}%`)}`;
}

function cleanTokens(tokens: string[]): string[] {
  return [...new Set(tokens.map((t) => t.replace(/\*/g, '').trim().slice(0, MAX_TOKEN_LENGTH)).filter(Boolean))].slice(0, MAX_SEARCH_TOKENS);
}

/** 여러 칸 중 하나라도 단어 하나라도 포함(OR). 단어가 없으면 null(조건 없는 전체 조회 방지) */
export function buildIlikeAny(columns: string[], tokens: string[]): string | null {
  const words = cleanTokens(tokens);
  if (words.length === 0) return null;
  return columns.flatMap((column) => words.map((w) => like(column, w))).join(',');
}

/** 문서: 제목은 단어 하나라도, 본문은 모든 단어. 단어가 없으면 null */
export function buildDocumentTextFilter(tokens: string[]): string | null {
  const words = cleanTokens(tokens);
  if (words.length === 0) return null;
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

/**
 * 단일 칸 '포함' 검색 패턴 — supabase-js .ilike(칸, 패턴) 용. '*' 제거, % _ \ 는 글자로.
 * 남는 글자가 없으면 '' 를 돌려준다 — ilike '' 는 빈 값만 맞으므로 '전부 일치'가 아니라 '일치 없음'이 된다.
 */
export function containsPattern(text: string): string {
  const word = text.replace(/\*/g, '').trim();
  return word ? `%${escapeLike(word)}%` : '';
}

/** 정확히 같은 값(대소문자 무시) 패턴 — 와일드카드 없이 % _ \ 를 글자로 */
export function exactLikePattern(text: string): string {
  return escapeLike(text.trim());
}
