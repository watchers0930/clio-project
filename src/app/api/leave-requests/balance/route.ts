import { NextRequest } from "next/server";
import { handleAttendance } from "@/lib/http/attendance-handler";
import { balanceDate } from "@/lib/leave/leave-validation";
import { leaveBalance } from "@/lib/leave/leave-service";
export async function GET(request: NextRequest) {
  return handleAttendance(request, false, async ({ admin, userId }) =>
    leaveBalance(
      admin,
      userId,
      balanceDate(request.nextUrl.searchParams.get("asOf")),
    ),
  );
}
