import type { QualityCheckResponse } from '@/lib/supabase/types';

/**
 * POST /api/quality-check — 검수 요청
 */
export async function requestQualityCheck(
  documentId: string,
  force = false,
): Promise<QualityCheckResponse> {
  const res = await fetch('/api/quality-check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document_id: documentId, force }),
  });

  const json = await res.json();

  if (!res.ok) {
    throw new Error(json.error ?? 'AI 검수 요청에 실패했습니다.');
  }

  return json as QualityCheckResponse;
}

/**
 * GET /api/quality-check?document_id={id} — 최신 캐시 조회
 */
export async function fetchQualityCheck(
  documentId: string,
): Promise<QualityCheckResponse | null> {
  const res = await fetch(`/api/quality-check?document_id=${encodeURIComponent(documentId)}`);
  const json = await res.json();

  if (!res.ok) return null;

  // check_id가 null이면 결과 없음
  if (!json.check_id) return null;

  return json as QualityCheckResponse;
}
