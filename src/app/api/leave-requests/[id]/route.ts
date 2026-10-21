import { NextRequest } from "next/server";
import { handleAttendance } from "@/lib/http/attendance-handler";
import { leaveInput } from "@/lib/leave/leave-validation";
import { writeLeave } from "@/lib/leave/leave-service";
import { readBody, ApiError, databaseError } from "@/lib/http/api-error";
import { uuid } from "@/lib/attendance/attendance-validation";
import { submitLeaveApproval } from "@/lib/leave/leave-approval";
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleAttendance(request, true, async ({ admin, userId }) => {
    const { id } = await params;
    if (!uuid(id)) throw new ApiError("휴가 ID를 확인해 주세요.");
    const body = await readBody(request);
    if (!["update", "link_document", "submit"].includes(String(body.action)))
      throw new ApiError("동작을 확인해 주세요.");
    if (body.action === "submit") {
      const result = await admin
        .from("leave_requests")
        .select("document_id")
        .eq("id", id)
        .eq("user_id", userId)
        .maybeSingle();
      databaseError(result.error);
      if (!result.data)
        throw new ApiError("휴가 신청을 찾을 수 없습니다.", 404);
      if (!result.data.document_id)
        throw new ApiError("휴가원 연결 후 상신해 주세요.", 409);
      const approval = await submitLeaveApproval(
        admin,
        userId,
        result.data.document_id,
      );
      return approval.leave;
    }
    if (body.action === "link_document" && !uuid(body.documentId))
      throw new ApiError("문서 ID가 필요합니다.");
    const input =
      body.action === "link_document"
        ? { action: body.action, documentId: body.documentId }
        : leaveInput(body, true);
    return writeLeave(admin, userId, id, input);
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleAttendance(request, true, async ({ admin, userId }) => {
    const { id } = await params;
    if (!uuid(id)) throw new ApiError("휴가 ID를 확인해 주세요.");
    // 본인 소유 + 상신 전(초안) 상태만 삭제 허용. pending/approved/rejected는
    // 결재 진행/이력이 있어 삭제 대신 취소·반려 절차를 따른다(승인자료 보호).
    const found = await admin
      .from("leave_requests")
      .select("id,status")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();
    databaseError(found.error);
    if (!found.data) throw new ApiError("휴가 신청을 찾을 수 없습니다.", 404);
    if (found.data.status !== "draft")
      throw new ApiError("상신 전(초안) 휴가만 삭제할 수 있습니다.", 409);
    const del = await admin
      .from("leave_requests")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    databaseError(del.error);
    return { id, deleted: true };
  });
}
