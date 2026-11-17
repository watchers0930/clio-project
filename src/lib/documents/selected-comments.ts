// 코멘트 반영(reflect·apply-comments)에서 사용자가 고른 코멘트 확인 — 두 라우트가 함께 쓴다.
// 서버 권한으로 코멘트를 읽고 상태를 바꾸므로, 이 문서의 코멘트인지 확인하지 않으면
// 내 문서에 남의 문서 코멘트 id 를 넣어 그 내용을 AI 로 내 본문에 옮기고(유출) 남의 코멘트를 '반영됨'으로 바꿀 수 있다.
import type { SupabaseClient } from '@supabase/supabase-js';
import { UUID_RE } from './document-links';

export const MAX_SELECTED_COMMENTS = 50;

export function parseSelectedCommentIds(value: unknown): { ok: true; ids: string[] } | { ok: false; error: string } {
  if (!Array.isArray(value) || value.length === 0) return { ok: false, error: '반영할 댓글을 선택해주세요.' };
  const ids = [...new Set(value)];
  if (ids.length > MAX_SELECTED_COMMENTS) return { ok: false, error: `댓글은 한 번에 ${MAX_SELECTED_COMMENTS}개까지 반영할 수 있습니다.` };
  if (!ids.every((id): id is string => typeof id === 'string' && UUID_RE.test(id))) {
    return { ok: false, error: '선택한 댓글 값이 올바르지 않습니다.' };
  }
  return { ok: true, ids };
}

export interface SelectedCommentRow {
  id: string;
  document_id: string;
  content: string;
  user_id: string | null;
}

/** 고른 id 가 전부 이 문서의 코멘트일 때만 그 행들, 하나라도 아니면 null(부분 반영 없이 전체 거부). */
export function pickDocumentComments<T extends SelectedCommentRow>(rows: T[], documentId: string, ids: string[]): T[] | null {
  const own = rows.filter((row) => row.document_id === documentId);
  return own.length === ids.length && ids.every((id) => own.some((row) => row.id === id)) ? own : null;
}

export async function loadSelectedComments(admin: SupabaseClient, documentId: string, ids: string[]) {
  const { data, error } = await admin
    .from('document_comments')
    .select('id, document_id, content, user_id')
    .eq('document_id', documentId)
    .in('id', ids);
  if (error) throw new Error(`댓글 조회 실패: ${error.message}`);
  return pickDocumentComments((data ?? []) as SelectedCommentRow[], documentId, ids);
}
