import { gmail_v1 } from 'googleapis';
import { trashGmailMessages } from './gmail-delete';

// 규칙 1건당 한 번의 실행에서 휴지통으로 옮길 최대 건수. 첫 실행 시 대량 이동 폭주를 막는 상한.
export const AUTO_DELETE_PER_RULE_LIMIT = 500;

// 자동삭제 규칙 pattern 길이 제한 (등록 API와 공유).
export const RULE_MIN_LEN = 2;
export const RULE_MAX_LEN = 200;

// 모든 자동삭제 검색에 강제로 AND되는 안전 보호식.
// - 별표(is:starred)·중요(is:important) 표시한 메일은 이용자가 소중히 여긴 것이므로 절대 건드리지 않는다.
// - 이미 휴지통/스팸인 메일은 다시 처리하지 않는다.
const SAFETY_SUFFIX = '-is:starred -is:important -in:trash -in:spam';

/** 규칙 패턴을 안전 보호식과 결합한 실제 Gmail 검색식을 만든다. */
export function buildAutoDeleteQuery(pattern: string): string {
  return `(${pattern.trim()}) ${SAFETY_SUFFIX}`;
}

/** 검색식에 매칭되는 메시지 id만 가볍게 조회한다(메타 get 없이). 최대 limit건. */
async function listMessageIds(
  gmail: gmail_v1.Gmail,
  query: string,
  limit: number,
): Promise<string[]> {
  const res = await gmail.users.messages.list({ userId: 'me', q: query, maxResults: limit });
  return (res.data.messages ?? [])
    .map((m) => m.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
}

export interface AutoDeleteRule {
  id: string;
  pattern: string;
}

export interface AutoDeleteRuleResult {
  id: string;
  pattern: string;
  trashed: number;
  error?: string;
}

/**
 * 한 사용자의 자동삭제 규칙들을 순회하며, 각 규칙에 매칭되는 메일을 휴지통으로 이동한다.
 * - 별표·중요 메일은 안전 보호식으로 항상 제외한다.
 * - 규칙당 최대 AUTO_DELETE_PER_RULE_LIMIT건까지만 처리한다.
 * - 영구 삭제가 아니라 휴지통 이동이므로 30일 내 복구 가능하다.
 * 반환값 = 규칙별 처리 결과. (DB 갱신은 호출측에서 수행)
 */
export async function runAutoDeleteRules(
  gmail: gmail_v1.Gmail,
  rules: AutoDeleteRule[],
): Promise<AutoDeleteRuleResult[]> {
  const results: AutoDeleteRuleResult[] = [];
  for (const rule of rules) {
    try {
      const query = buildAutoDeleteQuery(rule.pattern);
      const ids = await listMessageIds(gmail, query, AUTO_DELETE_PER_RULE_LIMIT);
      const trashed = ids.length > 0 ? await trashGmailMessages(gmail, ids) : 0;
      results.push({ id: rule.id, pattern: rule.pattern, trashed });
    } catch (err) {
      results.push({
        id: rule.id,
        pattern: rule.pattern,
        trashed: 0,
        error: err instanceof Error ? err.message.slice(0, 120) : String(err).slice(0, 120),
      });
    }
  }
  return results;
}
