// 본인 비밀번호 변경 입력 규칙 — 화면(입력창 안내)과 서버(요청 검증)가 함께 쓴다
export const PASSWORD_MIN = 6; // Supabase Auth 기본 최소 길이와 같게 — 더 길게 바꾸면 기존 화면 안내도 함께 바꿀 것
export const PASSWORD_MAX = 72; // bcrypt 가 72바이트까지만 쓰므로 그 이상은 의미 없이 잘린다

export type PasswordChangeInput =
  | { ok: true; currentPassword: string; newPassword: string }
  | { ok: false; error: string };

export function parsePasswordChange(body: unknown): PasswordChangeInput {
  if (!body || typeof body !== 'object') return { ok: false, error: '요청 형식이 올바르지 않습니다.' };
  const { currentPassword, newPassword } = body as Record<string, unknown>;
  if (typeof currentPassword !== 'string' || !currentPassword) return { ok: false, error: '현재 비밀번호를 입력해 주세요.' };
  if (typeof newPassword !== 'string' || newPassword.length < PASSWORD_MIN) {
    return { ok: false, error: `새 비밀번호는 ${PASSWORD_MIN}자 이상이어야 합니다.` };
  }
  if (new TextEncoder().encode(newPassword).length > PASSWORD_MAX) return { ok: false, error: '새 비밀번호가 너무 깁니다.' };
  if (newPassword === currentPassword) return { ok: false, error: '새 비밀번호가 현재 비밀번호와 같습니다.' };
  return { ok: true, currentPassword, newPassword };
}
