import type { SupabaseClient } from '@supabase/supabase-js';
import { filterAccessibleDocumentRows } from '@/lib/permissions';

/**
 * 검색 결과의 '원본 문서' 제목 — 사용자가 볼 수 있는 원본만 제목을 돌려준다.
 * (볼 수 있는 문서의 origin_document_id 를 따라가 권한 없는 원본 제목까지 내보내던 문제 방지)
 */
export async function loadAccessibleOriginTitles(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  supabase: SupabaseClient,
  user: { id: string; role: string; departmentId: string | null },
  originIds: string[],
): Promise<Map<string, string>> {
  const ids = [...new Set(originIds.filter(Boolean))];
  if (ids.length === 0) return new Map();
  const { data } = await admin.from('documents').select('id, title, created_by').in('id', ids);
  const rows = (data ?? []) as Array<{ id: string; title: string; created_by: string | null }>;
  const visible = await filterAccessibleDocumentRows(supabase, user.id, user.role, user.departmentId, rows);
  return new Map(visible.map((doc) => [doc.id, doc.title]));
}
