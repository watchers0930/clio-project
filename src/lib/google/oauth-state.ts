import { randomBytes, timingSafeEqual } from 'node:crypto';

// Google 연동 OAuth state — 시작할 때 만든 값을 httpOnly 쿠키와 Google 요청에 함께 싣고,
// 콜백에서 둘이 같을 때만 진행한다. 다른 브라우저에서 시작된 연동(공격자 계정 연결 유도)을 막는다.
export const OAUTH_STATE_COOKIE = 'google_oauth_state';

export function createOAuthState(): string {
  return randomBytes(32).toString('hex');
}

export function oauthStateMatches(cookieValue: string | null | undefined, returned: string | null | undefined): boolean {
  if (!cookieValue || !returned) return false;
  const a = Buffer.from(cookieValue);
  const b = Buffer.from(returned);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
