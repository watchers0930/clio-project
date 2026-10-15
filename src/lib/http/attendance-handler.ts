import type { NextRequest } from "next/server";
import { withAuth, ok } from "@/lib/api-helper";
import { withMutation } from "./mutation-guard";
import { errorResponse, ApiError, databaseError } from "./api-error";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";
type Context = {
  supabase: SupabaseClient<Database>;
  admin: SupabaseClient<Database>;
  userId: string;
};
export async function handleAttendance(
  request: NextRequest,
  mutation: boolean,
  run: (ctx: Context) => Promise<unknown>,
  status = 200,
) {
  try {
    const auth = mutation ? await withMutation(request) : await withAuth();
    if (auth.error) {
      auth.error.headers.set("Cache-Control", "private, no-store");
      return auth.error;
    }
    if (!mutation) {
      const user = await auth.supabase
        .from("users")
        .select("is_active")
        .eq("id", auth.userId)
        .maybeSingle();
      databaseError(user.error);
      if (!user.data?.is_active)
        throw new ApiError("활성 사용자만 조회할 수 있습니다.", 403);
    }
    const response = ok(
      await run({
        supabase: auth.supabase,
        get admin() {
          return createAdminSupabaseClient();
        },
        userId: auth.userId,
      }),
      status,
    );
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    const response = errorResponse(error);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
}
