import { NextRequest } from "next/server";
import { handleAttendance } from "@/lib/http/attendance-handler";
import { issueCsrfToken, csrfSessionId } from "@/lib/csrf";
export async function GET(request: NextRequest) {
  return handleAttendance(request, false, async ({ supabase, userId }) =>
    issueCsrfToken(userId, await csrfSessionId(supabase)),
  );
}
