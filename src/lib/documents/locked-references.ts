// 결재 잠금 문서를 참조하는 행의 삭제 차단 — 결재 증적(작성자·원본·양식) 보존.
// documents 의 created_by·template_id·parent_id·origin_document_id 는 ON DELETE SET NULL 이라,
// 사용자 세션에서 대상을 지우면 잠금 문서에 연쇄 UPDATE가 일어나 052 트리거가 거부한다.
// 삭제 전에 미리 세어 409로 안내하고, 동시성으로 사전 확인을 지나친 경우는 트리거 오류를 409로 바꾼다.
import type { SupabaseClient } from '@supabase/supabase-js';
import { WORKFLOW_LOCKED_STATUSES, documentDeleteViolation } from './document-status';

export type LockedReferenceColumn = 'created_by' | 'template_id' | 'parent_id' | 'origin_document_id';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function buildLockedReferenceFilter(columns: LockedReferenceColumn[], id: string): string | null {
  if (!UUID_RE.test(id) || columns.length === 0) return null;
  return columns.map((column) => `${column}.eq.${id}`).join(',');
}

/** RLS에 가려 남의 문서를 놓치지 않도록 service role 클라이언트로 호출한다. 조회 실패는 throw(삭제 진행 금지). */
export async function countLockedDocumentReferences(
  admin: SupabaseClient,
  columns: LockedReferenceColumn[],
  id: string,
): Promise<number> {
  const filter = buildLockedReferenceFilter(columns, id);
  if (!filter) return 0;
  const { count, error } = await admin
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .in('status', [...WORKFLOW_LOCKED_STATUSES])
    .or(filter);
  if (error) throw new Error(`잠금 문서 참조 확인 실패: ${error.message}`);
  return count ?? 0;
}

/**
 * 052 트리거(결재 잠금)의 거부. raise exception 은 모두 P0001 이라 메시지로 구분한다
 * (047 leave_document_lock 'leave document locked' 등 다른 트리거는 제외).
 */
export function isLockedDocumentError(error: { code?: string; message?: string } | null | undefined): boolean {
  return error?.code === 'P0001' && (error.message ?? '').includes('결재');
}

/**
 * 문서(버전 묶음) 삭제 판정 — 문서 상태 + 결재 건(진행·승인)을 documentDeleteViolation 규칙으로 본다.
 * 허용이면 null, 아니면 응답할 상태 코드와 사유. 결재 건 조회 실패는 503(거부).
 */
export async function checkDocumentDeletion(
  admin: SupabaseClient,
  docs: Array<{ id: string; status: string | null }>,
  role: string,
): Promise<{ status: number; error: string } | null> {
  if (role === 'admin' || docs.length === 0) return null;
  const { data, error } = await admin.from('approval_requests').select('status').in('document_id', docs.map((d) => d.id));
  if (error) return { status: 503, error: '결재 확인에 실패했습니다.' };
  const violation = documentDeleteViolation(docs.map((d) => d.status ?? ''), role, ((data ?? []) as Array<{ status: string }>).map((r) => r.status));
  return violation ? { status: 403, error: violation } : null;
}
