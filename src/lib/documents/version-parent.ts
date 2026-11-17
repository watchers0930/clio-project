// 새 버전의 부모 문서 확인 — 문서 생성(/api/documents POST)과 AI 생성(/api/generate)이 함께 쓴다.
// documents 삽입 RLS 는 created_by 만 보고 parent_id 는 검사하지 않으므로, 여기서 막지 않으면
// 볼 수 없는 남의 문서 밑에 버전을 붙여 그 묶음(버전 목록의 제목·작성자·반영 코멘트)에 끼어들 수 있다.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { VersionFields } from '@/lib/generation/context';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
