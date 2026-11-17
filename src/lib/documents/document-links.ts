// 문서 연결(새 버전의 부모 parent_id·후속 문서의 원본 origin_document_id) 확인 — 문서 생성(/api/documents POST)과
// AI 생성(/api/generate)이 함께 쓴다. documents 삽입 RLS 는 created_by 만 보므로 여기서 막지 않으면
//   - parent_id: 볼 수 없는 남의 문서 밑에 버전을 붙여 그 묶음(버전 목록의 제목·작성자·반영 코멘트)에 끼어들고
//   - origin_document_id: 남의 문서를 원본으로 걸어 결재를 올리면 그 문서가 삭제 불가(잠금 참조)가 된다.
// DB 최종 관문은 063 트리거.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { VersionFields } from '@/lib/generation/context';

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_FOUND = '새 버전을 만들 원본 문서를 찾을 수 없습니다.';

export type VersionParentResult =
  | { ok: true; fields: VersionFields }
  | { ok: false; status: 400 | 404; error: string };

export interface VersionParentDeps {
  loadDocument: (id: string) => Promise<{ id: string; parent_id: string | null } | null>;
  loadMaxVersion: (rootId: string) => Promise<number | null>;
  canAccessRoot: (rootId: string) => Promise<boolean>;
}

export async function resolveVersionParentWith(deps: VersionParentDeps, parentId: unknown): Promise<VersionParentResult> {
  if (parentId === undefined || parentId === null || parentId === '') return { ok: true, fields: {} };
  if (typeof parentId !== 'string' || !UUID_RE.test(parentId)) {
    return { ok: false, status: 400, error: '원본 문서 값이 올바르지 않습니다.' };
  }
  const parent = await deps.loadDocument(parentId);
  if (!parent) return { ok: false, status: 404, error: NOT_FOUND };
  const rootId = parent.parent_id ?? parent.id;
  // 원본은 parent_id 가 없는 행이어야 한다(062 트리거와 같은 판정 — 깨진 체인을 앱은 통과시키고 DB 가 500 으로 거부하지 않게)
  if (parent.parent_id) {
    const root = await deps.loadDocument(rootId);
    if (!root || root.parent_id) return { ok: false, status: 404, error: NOT_FOUND };
  }
  // 권한이 없을 때도 404 — 문서가 있는지조차 알리지 않는다
  if (!(await deps.canAccessRoot(rootId))) return { ok: false, status: 404, error: NOT_FOUND };
  const maxVersion = await deps.loadMaxVersion(rootId);
  return { ok: true, fields: { parent_id: rootId, version_number: (maxVersion ?? 1) + 1 } };
}

// 조회는 서버 권한(admin) — 사용자 세션이면 RLS 로 다른 부서가 만든 버전이 안 보여 번호가 겹친다.
// 권한 판단은 canAccessRoot(앱 규칙: 관리자·작성자·공유)가 맡는다.
export function resolveVersionParent(
  admin: SupabaseClient,
  parentId: unknown,
  canAccessRoot: (rootId: string) => Promise<boolean>,
): Promise<VersionParentResult> {
  return resolveVersionParentWith({
    loadDocument: async (id) => {
      const { data, error } = await admin.from('documents').select('id, parent_id').eq('id', id).maybeSingle();
      if (error) throw new Error(`원본 문서 조회 실패: ${error.message}`);
      return data;
    },
    loadMaxVersion: async (rootId) => {
      const { data, error } = await admin
        .from('documents')
        .select('version_number')
        .or(`id.eq.${rootId},parent_id.eq.${rootId}`)
        .order('version_number', { ascending: false })
        .limit(1);
      if (error) throw new Error(`버전 번호 조회 실패: ${error.message}`);
      return data?.[0]?.version_number ?? null;
    },
    canAccessRoot,
  }, parentId);
}

export type OriginDocumentResult =
  | { ok: true; originDocumentId: string | null }
  | { ok: false; status: 400 | 404; error: string };

export interface OriginDocumentDeps {
  loadDocument: (id: string) => Promise<{ id: string } | null>;
  canAccess: (id: string) => Promise<boolean>;
}

// 원본은 사용자가 상세 화면으로 열 수 있는 문서여야 한다(검토·공유·회의 화면의 '새 문서 활용'이 모두 그 경우).
export async function resolveOriginDocumentWith(deps: OriginDocumentDeps, originId: unknown): Promise<OriginDocumentResult> {
  if (originId === undefined || originId === null || originId === '') return { ok: true, originDocumentId: null };
  if (typeof originId !== 'string' || !UUID_RE.test(originId)) {
    return { ok: false, status: 400, error: '기준 문서 값이 올바르지 않습니다.' };
  }
  const origin = await deps.loadDocument(originId);
  if (!origin || !(await deps.canAccess(origin.id))) {
    return { ok: false, status: 404, error: '기준 문서를 찾을 수 없습니다.' };
  }
  return { ok: true, originDocumentId: origin.id };
}

export function resolveOriginDocument(
  admin: SupabaseClient,
  originId: unknown,
  canAccess: (id: string) => Promise<boolean>,
): Promise<OriginDocumentResult> {
  return resolveOriginDocumentWith({
    loadDocument: async (id) => {
      const { data, error } = await admin.from('documents').select('id').eq('id', id).maybeSingle();
      if (error) throw new Error(`기준 문서 조회 실패: ${error.message}`);
      return data;
    },
    canAccess,
  }, originId);
}

// 출처 구분값(origin_context) — 화면이 보내는 식별자(meeting_followup 등)만. 표시는 origin-context.ts 라벨표가 맡는다.
const ORIGIN_CONTEXT_RE = /^[a-z][a-z0-9_]{0,63}$/;

export function parseOriginContext(value: unknown): { ok: true; originContext: string | null } | { ok: false; error: string } {
  if (value === undefined || value === null || value === '') return { ok: true, originContext: null };
  if (typeof value !== 'string' || !ORIGIN_CONTEXT_RE.test(value)) return { ok: false, error: '문서 출처 값이 올바르지 않습니다.' };
  return { ok: true, originContext: value };
}

export type DocumentLinksResult =
  | { ok: true; versionFields: VersionFields; originDocumentId: string | null; originContext: string | null }
  | { ok: false; status: 400 | 404; error: string };

/** 생성 요청의 연결 값(parentId·originDocumentId·originContext)을 한 번에 확인 — 두 생성 경로가 같은 규칙을 쓰게. */
export async function resolveDocumentLinks(
  admin: SupabaseClient,
  input: { parentId: unknown; originDocumentId: unknown; originContext: unknown },
  canAccess: (id: string) => Promise<boolean>,
): Promise<DocumentLinksResult> {
  const context = parseOriginContext(input.originContext);
  if (!context.ok) return { ok: false, status: 400, error: context.error };
  const version = await resolveVersionParent(admin, input.parentId, canAccess);
  if (!version.ok) return version;
  const origin = await resolveOriginDocument(admin, input.originDocumentId, canAccess);
  if (!origin.ok) return origin;
  return { ok: true, versionFields: version.fields, originDocumentId: origin.originDocumentId, originContext: context.originContext };
}
