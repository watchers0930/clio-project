// 문서 공유(권한 부여) 요청 본문 검증 — 공유 라우트가 service role 로 쓰므로 입력은 여기서 엄격히 거른다
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PERMISSIONS = ['read', 'edit'] as const;

export type SharePermission = (typeof PERMISSIONS)[number];
export type ShareInput =
  | { ok: true; userId: string | null; departmentId: string | null; permission: SharePermission }
  | { ok: false; error: string };

const uuidOrNull = (v: unknown): string | null | undefined => {
  if (v === undefined || v === null || v === '') return null;
  return typeof v === 'string' && UUID_RE.test(v) ? v : undefined;
};

export function parseShareInput(body: unknown): ShareInput {
  if (!body || typeof body !== 'object') return { ok: false, error: '요청 형식이 올바르지 않습니다.' };
  const { userId, departmentId, permission } = body as Record<string, unknown>;

  const user = uuidOrNull(userId);
  const dept = uuidOrNull(departmentId);
  if (user === undefined || dept === undefined) return { ok: false, error: '공유 대상 형식이 올바르지 않습니다.' };
  if (!user === !dept) return { ok: false, error: '공유 대상(사용자 또는 부서) 하나를 지정해 주세요.' };

  const perm = permission === undefined ? 'read' : permission;
  if (!PERMISSIONS.includes(perm as SharePermission)) return { ok: false, error: '허용되지 않은 권한입니다.' };

  return { ok: true, userId: user, departmentId: dept, permission: perm as SharePermission };
}
