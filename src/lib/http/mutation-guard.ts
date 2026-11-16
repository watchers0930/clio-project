import { NextResponse, type NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { withAuth, fail } from "@/lib/api-helper";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { csrfSessionId, verifyCsrfToken } from "@/lib/csrf";
import { errorResponse } from "./api-error";
import { allowedMutationOrigins, mutationOrigin } from "./mutation-origins";
import { CSRF_INVALID_CODE } from "./csrf-codes";
export async function withMutation(request: NextRequest) {
  const denied = (error: ReturnType<typeof fail>) => ({
    error,
    supabase: null,
    admin: null,
    userId: null,
  });
  try {
    const auth = await withAuth();
    if (auth.error) return denied(auth.error);
    const origin = mutationOrigin(request.headers);
    if (!origin) {
      return denied(fail("요청 출처를 확인할 수 없습니다.", 403));
    }
    if (!allowedMutationOrigins().has(origin))
      return denied(fail("허용되지 않은 요청 출처입니다.", 403));
    if (
      !verifyCsrfToken(request.headers.get("x-csrf-token") ?? "", {
        userId: auth.userId,
        sessionId: await csrfSessionId(auth.supabase),
      })
    )
      // code 로 '토큰 거절'임을 알려 클라이언트가 이 경우에만 토큰을 다시 받아 재시도하게 한다
      // (권한 거부 403 까지 재시도하면 업로드·AI 요청이 두 번 전송됨)
      return denied(
        NextResponse.json(
          { success: false, error: "보안 토큰이 만료되었거나 유효하지 않습니다.", code: CSRF_INVALID_CODE },
          { status: 403 },
        ),
      );
    const { data: user, error } = await auth.supabase
      .from("users")
      .select("is_active")
      .eq("id", auth.userId)
      .maybeSingle();
    if (error) return denied(fail("사용자 확인에 실패했습니다.", 503));
    if (!user?.is_active)
      return denied(fail("활성 사용자만 요청할 수 있습니다.", 403));
    return { ...auth, admin: createAdminSupabaseClient() };
  } catch (error) {
    return denied(errorResponse(error));
  }
}

/**
 * 출처만 확인하는 가드 — 로그아웃처럼 세션·CSRF 토큰이 없거나 만료돼도 반드시 동작해야 하는 변이용.
 * 토큰까지 요구하면 토큰 발급이 실패한 상태에서 로그아웃이 안 되는 역효과가 난다.
 * 다른 사이트가 사용자를 강제로 로그아웃시키는 요청(교차 출처)은 여기서 막는다.
 */
export async function withSameOrigin(request: NextRequest) {
  const origin = mutationOrigin(request.headers);
  if (!origin) return { error: fail("요청 출처를 확인할 수 없습니다.", 403) };
  if (!allowedMutationOrigins().has(origin)) return { error: fail("허용되지 않은 요청 출처입니다.", 403) };
  return { error: null };
}

/** 내부 비밀값 비교 — 길이 차이·내용 차이 모두 같은 시간으로 비교(타이밍 공격 방지) */
function internalSecretMatches(provided: string | null): boolean {
  const expected = (process.env.INTERNAL_API_SECRET ?? "").trim();
  const given = (provided ?? "").trim();
  if (!expected || !given) return false;
  const a = createHash("sha256").update(expected).digest();
  const b = createHash("sha256").update(given).digest();
  return timingSafeEqual(a, b);
}

/**
 * 서버 내부 호출(X-Internal-Secret)과 사용자 요청을 함께 받는 변이 라우트용 가드.
 * - 내부 비밀값이 맞으면 내부 호출로 통과(브라우저 쿠키를 쓰지 않으므로 CSRF 대상 아님)
 * - 아니면 사용자 요청으로 보고 withMutation(출처·CSRF 토큰·활성 사용자)을 거친다
 * 결과의 internal 로 분기하고, 사용자 요청이면 기존 권한 확인을 이어서 한다.
 */
export async function withMutationOrInternal(request: NextRequest) {
  if (internalSecretMatches(request.headers.get("x-internal-secret")))
    return { error: null, internal: true as const };
  const mutation = await withMutation(request);
  if (mutation.error) return { error: mutation.error, internal: false as const };
  return { error: null, internal: false as const };
}
