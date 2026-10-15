import { NextRequest } from "next/server";
import { handleAttendance } from "@/lib/http/attendance-handler";
import { leaveInput, leaveFilters } from "@/lib/leave/leave-validation";
import { listLeaves, writeLeave } from "@/lib/leave/leave-service";
import { readBody } from "@/lib/http/api-error";
export async function GET(request: NextRequest) {
  return handleAttendance(request, false, async ({ admin, userId }) => ({
    requests: await listLeaves(
      admin,
      userId,
      leaveFilters(request.nextUrl.searchParams),
    ),
  }));
}
export async function POST(request: NextRequest) {
  return handleAttendance(
    request,
    true,
    async ({ admin, userId }) =>
      writeLeave(admin, userId, null, leaveInput(await readBody(request))),
    201,
  );
}
