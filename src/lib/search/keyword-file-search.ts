import { filterAccessibleFileRows } from '@/lib/permissions';

// 검색 결과 아이템 (파일·문서 공용). route에서 import.
export interface SearchResultItem {
  id: string;
  name: string;
  excerpt: string;
  relevance: number;
  fileType: string;
  department: string;
  date: string;
  aiSummary: string;
  sourceType: 'file' | 'document';
  dataSource?: 'gmail' | 'upload';
  externalId?: string | null;
  duplicateCount?: number; // 같은 제목 중복 알림 접기 시 묶인 총 건수(대표 포함)
  relationLabel?: string | null;
  originDocumentId?: string | null;
  originDocumentTitle?: string | null;
}

const FILE_TYPE_MAP: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
  'audio/m4a': 'M4A',
  'text/markdown': 'MD',
};

export function getFileType(mimeType: string | null, fileName: string): string {
  if (mimeType && FILE_TYPE_MAP[mimeType]) return FILE_TYPE_MAP[mimeType];
  return fileName.split('.').pop()?.toUpperCase() ?? 'FILE';
}

interface FileRow {
  id: string; name: string; type: string | null; department_id: string | null;
  created_at: string; uploaded_by: string | null;
  source?: string | null; external_id?: string | null; source_date?: string | null;
}

const FILE_SELECT = 'id, name, type, department_id, created_at, uploaded_by, source, external_id, source_date';

interface KeywordSearchParams {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  queryTokens: string[];
  department?: string;
  deptIdByName: Map<string, string>;
  deptMap: Map<string, string>;
  authUserId: string;
  role: string;
  userDepartmentId: string | null;
  excludeIds: Set<string>; // 벡터 등에서 이미 담긴 파일 id
}

/**
 * 파일명 + 본문(청크) 부분일치(ilike) 키워드 검색.
 * 벡터(의미) 검색이 놓치는 짧은 단일 키워드(브랜드명·발신자명 등)를 확실히 매칭한다.
 * excludeIds(벡터 결과)와 중복 제거하여 새로 발견한 파일만 반환.
 */
export async function keywordFileSearch(p: KeywordSearchParams): Promise<SearchResultItem[]> {
  const { sb, supabase, queryTokens, department, deptIdByName, deptMap, authUserId, role, userDepartmentId, excludeIds } = p;

  // ① 본문 청크 부분일치 → file_id별 대표 스니펫
  const { data: kwChunks } = await sb
    .from('file_chunks').select('file_id, content')
    .or(queryTokens.map((t) => `content.ilike.%${t}%`).join(','))
    .limit(40);
  const snippetByFile = new Map<string, string>();
  for (const c of ((kwChunks ?? []) as Array<{ file_id: string; content: string }>)) {
    if (!snippetByFile.has(c.file_id)) snippetByFile.set(c.file_id, c.content);
  }

  // ② 파일명 부분일치
  let fileQuery = sb.from('files').select(FILE_SELECT)
    .or(queryTokens.map((t) => `name.ilike.%${t}%`).join(','));
  if (department && department !== '전체') {
    const deptId = deptIdByName.get(department);
    if (deptId) fileQuery = fileQuery.eq('department_id', deptId);
  }
  const { data: nameFiles } = await fileQuery.limit(20);
  const nameRows = (nameFiles ?? []) as FileRow[];
  const nameIds = new Set(nameRows.map((f) => f.id));

  // ③ 본문에만 걸린(파일명엔 없고 벡터에도 없던) 파일 행 추가 조회
  const extraIds = [...snippetByFile.keys()].filter((id) => !nameIds.has(id) && !excludeIds.has(id));
  const { data: contentFiles } = extraIds.length
    ? await sb.from('files').select(FILE_SELECT).in('id', extraIds)
    : { data: [] };

  // ④ 접근권한 필터
  const candidates = [...nameRows, ...((contentFiles ?? []) as FileRow[])];
  const accessible = await filterAccessibleFileRows(supabase, authUserId, role, userDepartmentId, candidates);

  const out: SearchResultItem[] = [];
  const seen = new Set(excludeIds);
  for (const f of accessible as FileRow[]) {
    if (seen.has(f.id)) continue;
    seen.add(f.id);
    const nameLower = f.name.toLowerCase();
    const inName = queryTokens.some((t) => nameLower.includes(t));
    let score = 0;
    for (const token of queryTokens) score += (nameLower.split(token).length - 1) * 25;
    const snippet = snippetByFile.get(f.id);
    out.push({
      id: f.id,
      name: f.name,
      excerpt: (snippet ?? `${f.name} 파일입니다.`).slice(0, 200),
      // 제목 매칭은 강하게, 본문만 매칭이면 중간 점수
      relevance: inName ? Math.min(85, Math.max(30, score + 50)) : 45,
      fileType: getFileType(f.type, f.name),
      department: deptMap.get(f.department_id ?? '') ?? '미분류',
      date: (f.source_date ?? f.created_at).split('T')[0],
      aiSummary: '',
      sourceType: 'file',
      dataSource: f.source === 'gmail' ? 'gmail' : 'upload',
      externalId: f.external_id ?? null,
    });
  }
  return out;
}
