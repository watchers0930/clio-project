/**
 * 검색의 문서 조회 — 권한 조건을 DB 조회 자체에 넣는다.
 *
 * 전에는 서버 권한으로 최신순 후보(텍스트 60건·벡터 15건)를 가져온 뒤 앱에서 권한을 걸렀다.
 * 문서가 늘면 볼 수 있는 문서가 후보 밖으로 밀려 검색에 안 나왔다(볼 수 없는 문서가 상위를 차지하는 만큼 결과가 줄어든다).
 * 규칙은 앱 getAccessibleDocumentIds 와 같다: 관리자 전체 / 본인 작성 / 사용자·부서 공유(document_permissions).
 * 검색 대상은 원본 행(parent_id 없음)만 — 버전 행까지 넓히려면 '현재 판'을 DB 에서 정의해야 한다
 * (코멘트 반영은 원본을 최신으로 두고 옛 판을 스냅샷 행으로, 새 버전 생성은 자식 행을 최신으로 둬 모델이 섞여 있다. 별도 과제).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { UUID_RE } from '@/lib/documents/document-links';

export interface SearchUser {
  id: string;
  role: string;
  departmentId?: string | null;
}

const MAX_GRANTED_IDS = 200; // 공유 목록 상한 — id 목록이 GET 조회 주소에 들어가므로(200개 ≈ 7.5KB) 넘으면 오래된 공유부터 빠진다(현재 운영 0건)

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

/** 공유받은 문서 id — 실패하면 빈 목록(본인 문서만 검색) */
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
  if (error) {
    // 공유 목록을 못 읽으면 본인 문서만으로 검색한다(범위를 넓히지 않고, 검색 전체를 실패시키지도 않는다)
    console.error('[search] granted documents error:', error.message);
    return [];
  }
  return [...new Set(((data ?? []) as Array<{ document_id: string | null }>).map((r) => r.document_id).filter((id): id is string => !!id))];
}

export const DOCUMENT_TEXT_LIMIT = 15;

/**
 * 텍스트 조건과 권한 조건을 한 논리식으로 — or=(and(or(텍스트),or(권한))).
 * `.or()` 를 두 번 부르면 같은 이름의 쿼리 파라미터가 두 개 나가는데, 그 결합 방식에 기대지 않고 AND 를 문법으로 고정한다.
 */
export function combineTextAndAccess(textFilter: string, access: string | null): string {
  return access ? `and(or(${textFilter}),or(${access}))` : textFilter;
}

export async function searchDocumentsByText<T>(params: {
  admin: SupabaseClient;
  user: SearchUser;
  grantedIds: string[];
  textFilter: string;
  columns: string;
}): Promise<T[]> {
  const { admin, user, grantedIds, textFilter, columns } = params;
  const filter = combineTextAndAccess(textFilter, buildDocumentAccessFilter(user, grantedIds));
  const { data, error } = await admin.from('documents').select(columns).is('parent_id', null).or(filter)
    .order('created_at', { ascending: false }).limit(DOCUMENT_TEXT_LIMIT);
  if (error) throw new Error(`문서 검색 실패: ${error.message}`);
  return (data ?? []) as unknown as T[];
}
