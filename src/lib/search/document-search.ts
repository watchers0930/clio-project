/**
 * 검색의 문서 조회 — 권한 조건을 DB 조회 자체에 넣는다.
 *
 * 전에는 서버 권한으로 최신순 후보(텍스트 60건·벡터 15건)를 가져온 뒤 앱에서 권한을 걸렀다.
 * 문서가 늘면 볼 수 있는 문서가 후보 밖으로 밀려 검색에 안 나왔다(볼 수 없는 문서가 상위를 차지하는 만큼 결과가 줄어든다).
 * 규칙은 앱 getAccessibleDocumentIds 와 같다: 관리자 전체 / 본인 작성 / 사용자·부서 공유(document_permissions).
 * 새 버전(generate 로 만든 2판 이상)도 검색되도록 버전 행까지 찾고, 묶음마다 가장 높은 판 하나만 남긴다.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { UUID_RE } from '@/lib/documents/document-links';

export interface SearchUser {
  id: string;
  role: string;
  departmentId?: string | null;
}

const MAX_GRANTED_IDS = 500; // 공유 목록 상한(조건 길이) — 넘으면 오래된 공유부터 빠진다(현재 운영 0건)

/** 관리자는 null(조건 없음), 직원은 `created_by.eq.나[,id.in.(공유 id)]` — PostgREST or 조건 */
export function buildDocumentAccessFilter(user: SearchUser, grantedIds: string[]): string | null {
  if (user.role === 'admin') return null;
  if (!UUID_RE.test(user.id)) throw new Error('잘못된 사용자 id');
  const ids = grantedIds.filter((id) => UUID_RE.test(id));
  return ids.length > 0 ? `created_by.eq.${user.id},id.in.(${ids.join(',')})` : `created_by.eq.${user.id}`;
}

/** match_document_embeddings(064) 권한 인자 — 관리자는 없음, 직원은 작성자 + 공유 id(빈 배열이어도 조건이 걸린다) */
export function vectorAccessArgs(user: SearchUser, grantedIds: string[]): { filter_owner?: string; filter_document_ids?: string[] } {
  if (user.role === 'admin') return {};
  return { filter_owner: user.id, filter_document_ids: grantedIds.filter((id) => UUID_RE.test(id)) };
}

export async function loadGrantedDocumentIds(admin: SupabaseClient, user: SearchUser): Promise<string[]> {
  if (user.role === 'admin') return [];
  const target = user.departmentId && UUID_RE.test(user.departmentId)
    ? `granted_to_user.eq.${user.id},granted_to_dept.eq.${user.departmentId}`
    : `granted_to_user.eq.${user.id}`;
  const { data, error } = await admin
    .from('document_permissions')
    .select('document_id')
    .or(target)
    .order('created_at', { ascending: false })
    .limit(MAX_GRANTED_IDS);
  if (error) throw new Error(`공유 문서 조회 실패: ${error.message}`);
  return [...new Set(((data ?? []) as Array<{ document_id: string | null }>).map((r) => r.document_id).filter((id): id is string => !!id))];
}

interface VersionedRow {
  id: string;
  parent_id: string | null;
  version_number: number | null;
  created_at: string;
}

/** 버전 묶음(원본 id 기준)마다 가장 높은 판 하나 — 입력 순서(최신순)를 유지한다 */
export function collapseVersionChains<T extends VersionedRow>(rows: T[]): Array<T & { chainId: string }> {
  const best = new Map<string, T>();
  for (const row of rows) {
    const chainId = row.parent_id ?? row.id;
    const current = best.get(chainId);
    const better = !current
      || (row.version_number ?? 1) > (current.version_number ?? 1)
      || ((row.version_number ?? 1) === (current.version_number ?? 1) && row.created_at > current.created_at);
    if (better) best.set(chainId, row);
  }
  const picked = new Set(best.values());
  return rows.filter((row) => picked.has(row)).map((row) => ({ ...row, chainId: row.parent_id ?? row.id }));
}

export const DOCUMENT_TEXT_LIMIT = 15;
// 같은 묶음의 여러 판이 함께 걸리면 접은 뒤 줄어드므로 조금 더 가져온다(권한은 이미 DB 에서 걸렀다)
const DOCUMENT_TEXT_FETCH = DOCUMENT_TEXT_LIMIT * 3;

export async function searchDocumentsByText<T extends VersionedRow>(params: {
  admin: SupabaseClient;
  user: SearchUser;
  grantedIds: string[];
  textFilter: string;
  columns: string;
}): Promise<Array<T & { chainId: string }>> {
  const { admin, user, grantedIds, textFilter, columns } = params;
  let query = admin.from('documents').select(columns).or(textFilter);
  const access = buildDocumentAccessFilter(user, grantedIds);
  if (access) query = query.or(access); // 두 or 조건은 AND 로 묶인다
  const { data, error } = await query.order('created_at', { ascending: false }).limit(DOCUMENT_TEXT_FETCH);
  if (error) throw new Error(`문서 검색 실패: ${error.message}`);
  return collapseVersionChains((data ?? []) as unknown as T[]).slice(0, DOCUMENT_TEXT_LIMIT);
}
