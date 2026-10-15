import { NextRequest } from "next/server";
import { handleAttendance } from "@/lib/http/attendance-handler";
import { heartbeat } from "@/lib/attendance/attendance-service";
export async function POST(request: NextRequest) {
  return handleAttendance(request, true, async ({ admin, userId }) =>
    heartbeat(admin, userId),
  );
}
