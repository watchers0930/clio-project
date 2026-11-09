import { isUserSettableStatus } from '@/lib/documents/document-status';

/** Validate the existing PATCH contract without transforming or rewriting content. */
export type DocumentUpdate = { content?: string; title?: string; status?: string };
export function validateDocumentUpdate(body: unknown):
  | { ok: true; updates: DocumentUpdate }
  | { ok: false; error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: '요청 본문은 객체여야 합니다.' };
  }
  const record = body as Record<string, unknown>;
  const updates: DocumentUpdate = {};
  for (const key of ['content', 'title', 'status'] as const) {
    if (!Object.hasOwn(record, key)) continue;
    if (typeof record[key] !== 'string') return { ok: false, error: `${key}는 문자열이어야 합니다.` };
    updates[key] = record[key];
  }
  if (updates.title !== undefined && !updates.title.trim()) {
    return { ok: false, error: '문서 제목을 입력해 주세요.' };
  }
  // 결재 상태(in_approval/approved/rejected)는 결재 API만 설정한다 — PATCH는 초안·완료만.
  if (updates.status !== undefined && !isUserSettableStatus(updates.status)) {
    return { ok: false, error: '유효하지 않은 문서 상태입니다.' };
  }
  if (!Object.keys(updates).length) return { ok: false, error: '수정할 내용이 없습니다.' };
  return { ok: true, updates };
}
