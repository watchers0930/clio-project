import { NextRequest } from "next/server";
import { handleAttendance } from "@/lib/http/attendance-handler";
import { dateRange } from "@/lib/attendance/attendance-validation";
import { attendanceDays, attendanceHolidays } from "@/lib/attendance/attendance-service";
export async function GET(request: NextRequest) {
  return handleAttendance(request, false, async ({ supabase, userId }) => {
    const q = request.nextUrl.searchParams;
    const { from, to } = dateRange(q.get("from"), q.get("to"));
    // 공휴일은 휴가 표시 보조 정보 — 조회 실패가 근태 기록까지 막지 않도록 분리하고 null로 알린다.
    const [days, holidays] = await Promise.all([
      attendanceDays(supabase, userId, from, to),
      attendanceHolidays(supabase, from, to).then(
        (v) => v,
        (e) => {
          console.error("[attendance] holidays query failed", e instanceof Error ? e.message : e);
          return null;
        },
      ),
    ]);
    return { days, holidays };
  });
}
