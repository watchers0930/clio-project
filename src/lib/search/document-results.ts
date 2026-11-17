// 검색 결과의 문서 항목 — 텍스트·벡터 두 경로가 같은 모양으로 만든다.
import type { SupabaseClient } from '@supabase/supabase-js';
import { originContextLabel as formatOriginLabel } from '@/lib/documents/origin-context';
import { stripEmbeddedInputs } from '@/lib/documents/embedded-inputs';
import type { SearchResultItem } from '@/lib/search/keyword-file-search';

export interface DocRow {
  id: string;
  title: string;
  content: string | null;
  created_at: string;
  created_by: string | null;
  origin_document_id?: string | null;
  origin_context?: string | null;
  template_id?: string | null;
  source_file_ids?: string[] | null;
  templates: { name: string } | null;
}

interface UserRow { id: string; department_id: string | null }

export async function buildCreatorDepartmentMap(
  admin: SupabaseClient,
  deptMap: Map<string, string>,
  creatorIds: Array<string | null | undefined>,
) {
  const ids = [...new Set(creatorIds.filter((id): id is string => !!id))];
  const creatorDeptMap = new Map<string, string>();

  if (ids.length === 0) return creatorDeptMap;

  const { data: userRows } = await admin.from('users').select('id, department_id').in('id', ids);
  for (const user of (userRows as UserRow[] ?? [])) {
    creatorDeptMap.set(user.id, deptMap.get(user.department_id ?? '') ?? '미분류');
  }

  return creatorDeptMap;
}

export function toDocumentSearchItem(
  d: DocRow,
  relevance: number,
  creatorDeptMap: Map<string, string>,
  originTitleMap: Map<string, string>,
): SearchResultItem {
  return {
    id: d.id,
    name: d.title,
    excerpt: stripEmbeddedInputs(d.content ?? '').slice(0, 200), // 내부 입력값 주석은 미리보기에서 제외
    relevance,
    fileType: d.templates?.name ?? 'AI문서',
    department: creatorDeptMap.get(d.created_by ?? '') ?? '미분류',
    date: d.created_at.split('T')[0],
    aiSummary: '',
    sourceType: 'document',
    relationLabel: formatOriginLabel(d.origin_context ?? null),
    originDocumentId: d.origin_document_id ?? null,
    originDocumentTitle: d.origin_document_id ? (originTitleMap.get(d.origin_document_id) ?? null) : null,
    // 새 문서 활용(후속 문서)이 원본과 같은 양식·참고 파일로 작성하도록
    templateId: d.template_id ?? null,
    sourceFileIds: d.source_file_ids ?? [],
  };
}
