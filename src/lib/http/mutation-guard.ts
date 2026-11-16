import type { NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { withAuth, fail } from "@/lib/api-helper";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { csrfSessionId, verifyCsrfToken } from "@/lib/csrf";
import { errorResponse } from "./api-error";
import { allowedMutationOrigins, mutationOrigin } from "./mutation-origins";
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
      return denied(fail("보안 토큰이 만료되었거나 유효하지 않습니다.", 403));
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
