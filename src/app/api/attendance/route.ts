import { NextRequest } from "next/server";
import { handleAttendance } from "@/lib/http/attendance-handler";
import { dateRange } from "@/lib/attendance/attendance-validation";
import { attendanceDays } from "@/lib/attendance/attendance-service";
export async function GET(request: NextRequest) {
  return handleAttendance(request, false, async ({ supabase, userId }) => {
    const q = request.nextUrl.searchParams;
    const { from, to } = dateRange(q.get("from"), q.get("to"));
    return { days: await attendanceDays(supabase, userId, from, to) };
  });
}
