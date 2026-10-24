import crypto from 'crypto';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * 계정관리(account-credentials) 진입 비밀번호의 "잠금 해제 상태"를 서버에서 강제한다.
 * - /verify 성공 시 서명된 짧은 수명(10분) httpOnly 쿠키를 발급한다.
 * - 평문 조회·변이 라우트는 requireAccountUnlock 로 쿠키 유효성을 검사한다.
 * - 진입 비밀번호(account_lock_hash)를 설정하지 않은 사용자는 잠금이 없으므로 통과한다.
 * 역할 가드(requireAdminOrCeo)와 별개의 2차 인증 레이어.
 */

const COOKIE_NAME = 'ac_unlock';
const TTL_SECONDS = 10 * 60;

function secret(): string {
  return process.env.CSRF_SECRET ?? '';
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

/** 잠금 해제 토큰 발급(userId + 만료시각 + HMAC 서명). nowMs는 호출부에서 주입. */
export function buildUnlockToken(userId: string, nowMs: number): string {
  const exp = nowMs + TTL_SECONDS * 1000;
  const payload = `${userId}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

/** 응답에 잠금 해제 쿠키를 심는다(httpOnly·secure·strict). */
export function setUnlockCookie(res: NextResponse, userId: string, nowMs: number): void {
  res.cookies.set(COOKIE_NAME, buildUnlockToken(userId, nowMs), {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: TTL_SECONDS,
  });
}

/** 쿠키 토큰이 해당 사용자에 대해 유효·미만료·서명일치인지 확인. */
export function hasValidUnlock(token: string | undefined, userId: string, nowMs: number): boolean {
  if (!token || !secret()) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [uid, expStr, sig] = parts;
  if (uid !== userId) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < nowMs) return false;
  const expected = sign(`${uid}.${exp}`);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** 423 Locked 응답. */
export function accountLockedResponse(): NextResponse {
  return NextResponse.json(
    { success: false, error: '계정관리 잠금을 해제해 주세요.', locked: true },
    { status: 423 },
  );
}

/**
 * 잠금이 설정된 사용자면 잠금 해제 쿠키를 요구한다.
 * 통과(또는 잠금 미설정)면 null, 막히면 423 NextResponse 반환.
 */
export async function requireAccountUnlock(
  supabase: SupabaseClient,
  request: NextRequest,
  userId: string,
): Promise<NextResponse | null> {
  const { data } = await supabase
    .from('users')
    .select('account_lock_hash')
    .eq('id', userId)
    .single();
  const lockHash = (data as { account_lock_hash?: string | null } | null)?.account_lock_hash;
  if (!lockHash) return null; // 진입 비밀번호 미설정 → 잠금 없음
  const token = request.cookies.get(COOKIE_NAME)?.value;
  return hasValidUnlock(token, userId, Date.now()) ? null : accountLockedResponse();
}
