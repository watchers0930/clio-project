import { csrfFetch } from '@/hooks/csrf-client';

export interface DocumentPatch {
  content?: string;
  title?: string;
  status?: 'draft' | 'completed';
}

/**
 * PATCH /api/documents/[id] 공용 호출. 실패 시 서버 사유(409 결재 잠금 등)를 담은 Error를 던진다.
 * 반환: 서버가 저장한 문서 row(data).
 */
export async function patchDocument(id: string, patch: DocumentPatch, fallbackError: string): Promise<Record<string, unknown>> {
  const res = await csrfFetch(`/api/documents/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new Error(typeof json?.error === 'string' && json.error ? json.error : fallbackError);
  }
  return (json.data ?? {}) as Record<string, unknown>;
}
