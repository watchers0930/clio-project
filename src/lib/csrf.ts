import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { ApiError } from "@/lib/http/api-error";
const TTL = 3600;
function secret() {
  const key = process.env.CSRF_SECRET || process.env.JWT_SECRET;
  if (!key) throw new ApiError("보안 설정이 필요합니다.", 503);
  return key;
}
function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}
export function issueCsrfToken(userId: string, sessionId: string) {
  const exp = Math.floor(Date.now() / 1000) + TTL;
  const payload = Buffer.from(
    JSON.stringify({
      userId,
      sessionId,
      exp,
      nonce: randomBytes(16).toString("hex"),
    }),
  ).toString("base64url");
  return {
    token: `${payload}.${sign(payload)}`,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}
export function verifyCsrfToken(
  token: string,
  ctx: { userId: string; sessionId: string },
): boolean {
  if (!token || token.length > 4096) return false;
  try {
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra) return false;
    const expected = Buffer.from(sign(payload));
    const actual = Buffer.from(signature);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
      return false;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return (
      data.userId === ctx.userId &&
      data.sessionId === ctx.sessionId &&
      Number.isInteger(data.exp) &&
      data.exp > Date.now() / 1000
    );
  } catch {
    return false;
  }
}
// getClaims verifies the access JWT; session_id survives refresh, changes on sign-in.
export async function csrfSessionId(supabase: SupabaseClient<Database>) {
  const { data, error } = await supabase.auth.getClaims();
  const id = data?.claims?.session_id;
  if (error || typeof id !== "string" || !id)
    throw new ApiError("세션을 다시 인증해 주세요.", 401);
  return id;
}
