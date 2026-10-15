import { NextRequest } from "next/server";
import { handleAttendance } from "@/lib/http/attendance-handler";
import {
  dateRange,
  pageNumber,
  uuid,
} from "@/lib/attendance/attendance-validation";
import { adminAttendance } from "@/lib/attendance/attendance-service";
import { ApiError } from "@/lib/http/api-error";
export async function GET(request: NextRequest) {
  return handleAttendance(request, false, async ({ admin, userId }) => {
    const q = request.nextUrl.searchParams;
    const { from, to } = dateRange(q.get("from"), q.get("to"));
    const filter = q.get("userId") || undefined;
    if (filter && !uuid(filter)) throw new ApiError("직원 ID를 확인해 주세요.");
    return adminAttendance(
      admin,
      userId,
      from,
      to,
      pageNumber(q.get("page"), 1, 100000),
      pageNumber(q.get("pageSize"), 20, 100),
      filter,
    );
  });
}
