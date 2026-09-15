import { gmail_v1 } from 'googleapis';
import { parseMessagePayload } from './gmail-message';

export interface GmailSearchHit {
  id: string;
  subject: string;
  from: string;
  date: string;
}

export interface GmailSearchResult {
  hits: GmailSearchHit[];
  totalEstimate: number;
  truncated: boolean; // limit을 초과하는 결과가 더 있는지
}

// 미리보기에서 한 번에 보여줄 최대 건수. Gmail messages.get quota 및 화면 부담을 고려한 상한.
export const PREVIEW_LIMIT = 100;
// batchModify 1회 최대 처리 건수 (Gmail API 제한).
const BATCH_SIZE = 1000;
// messages.get 병렬 동시 실행 수 (rate limit 회피).
const METADATA_CONCURRENCY = 15;

/** 동시 실행 수를 제한하며 배열을 매핑한다. (외부 의존성 없이 rate limit 방어) */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Gmail 검색(q)으로 매칭되는 메시지를 찾아 메타(제목/발신/날짜)를 반환한다.
 * q에는 Gmail 검색 문법을 그대로 사용(예: from:foo, subject:bar). 메일함 전체가 대상.
 */
export async function searchGmailMessages(
  gmail: gmail_v1.Gmail,
  query: string,
  limit: number = PREVIEW_LIMIT,
): Promise<GmailSearchResult> {
  const listRes = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: limit,
  });

  const messages = listRes.data.messages ?? [];
  const totalEstimate = listRes.data.resultSizeEstimate ?? messages.length;
  const truncated = Boolean(listRes.data.nextPageToken);

  const hits = await mapWithConcurrency(messages, METADATA_CONCURRENCY, async (m) => {
    const { data } = await gmail.users.messages.get({
      userId: 'me',
      id: m.id!,
      format: 'metadata',
      metadataHeaders: ['Subject', 'From', 'Date'],
    });
    const parsed = parseMessagePayload(data);
    return { id: m.id!, subject: parsed.subject, from: parsed.from, date: parsed.date };
  });

  return { hits, totalEstimate, truncated };
}

/**
 * 지정한 메시지들을 Gmail 휴지통으로 이동한다(TRASH 라벨 부여, INBOX 제거).
 * 영구 삭제가 아니므로 Gmail 휴지통에서 복구 가능. 1000개 초과 시 청크로 반복 처리.
 * 반환값 = 요청 처리한 총 건수.
 */
export async function trashGmailMessages(gmail: gmail_v1.Gmail, ids: string[]): Promise<number> {
  let moved = 0;
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const chunk = ids.slice(i, i + BATCH_SIZE);
    await gmail.users.messages.batchModify({
      userId: 'me',
      requestBody: { ids: chunk, addLabelIds: ['TRASH'], removeLabelIds: ['INBOX', 'UNREAD'] },
    });
    moved += chunk.length;
  }
  return moved;
}
