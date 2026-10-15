import type { NextRequest } from "next/server";
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
