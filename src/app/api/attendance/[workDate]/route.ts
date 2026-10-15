import { NextRequest } from "next/server";
import { handleAttendance } from "@/lib/http/attendance-handler";
import { correctionBody } from "@/lib/attendance/attendance-validation";
import { correctAttendance } from "@/lib/attendance/attendance-service";
import { readBody } from "@/lib/http/api-error";
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ workDate: string }> },
) {
  return handleAttendance(request, true, async ({ admin, userId }) => {
    const { workDate } = await params;
    return correctAttendance(
      admin,
      userId,
      workDate,
      correctionBody(workDate, await readBody(request)),
    );
  });
}
