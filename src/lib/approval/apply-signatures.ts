import type { SupabaseClient } from '@supabase/supabase-js';
import { injectApprovalSignatures, buildApprovalFills } from './inject-signatures';

/** storage의 서명 이미지 경로를 data URL로 변환 (실패 시 null) */
async function toDataUrl(admin: SupabaseClient, path: string): Promise<string | null> {
  try {
    const { data } = await admin.storage.from('files').download(path);
    if (!data) return null;
    const buf = Buffer.from(await data.arrayBuffer());
    const ext = path.split('.').pop()?.toLowerCase() ?? 'png';
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

/**
 * 렌더된 양식 HTML의 결재란(ap-sign 칸)에, 이 문서의 결재 진행 상태에 따라
 * 각 결재자 서명을 주입한다. 결재 건이 없으면 원본 HTML 그대로 반환.
 */
export async function applyApprovalSignatures(admin: SupabaseClient, documentId: string, html: string): Promise<string> {
  const { data: req } = await admin
    .from('approval_requests')
    .select('id')
    .eq('document_id', documentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!req) return html;

  const { data: steps } = await admin
    .from('approval_steps')
    .select('step_order, status, signature_path')
    .eq('request_id', req.id)
    .order('step_order', { ascending: true });
  if (!steps || steps.length === 0) return html;

  const filled = await Promise.all(
    steps.map(async (s: { step_order: number; status: string; signature_path: string | null }) => ({
      step_order: s.step_order,
      status: s.status,
      signatureDataUrl:
        (s.status === 'approved' || s.status === 'delegated') && s.signature_path
          ? await toDataUrl(admin, s.signature_path)
          : null,
    })),
  );

  return injectApprovalSignatures(html, buildApprovalFills(filled));
}
