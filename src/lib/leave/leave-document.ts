import type { LeaveType } from "@/lib/supabase/types";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { ApiError, databaseError } from "@/lib/http/api-error";
import { leaveInput } from "./leave-validation";
import { leaveBalance, writeLeave } from "./leave-service";
import { isLeaveApplicationTemplateName } from "@/lib/templates/leave-application";
export class LeaveDocumentLinkError extends ApiError {
  constructor(
    public documentId: string,
    error: unknown,
  ) {
    super(
      error instanceof ApiError
        ? error.message
        : "휴가 연결에 실패했습니다. 다시 연결해 주세요.",
      error instanceof ApiError ? error.status : 503,
    );
  }
}
export function embedLeaveInputs(
  content: string,
  inputs: Record<string, string>,
) {
  const safe = Object.fromEntries(
    Object.entries(inputs).filter(
      ([key]) => !key.includes("signature") && !key.includes("logo"),
    ),
  );
  return `<!--DOCUMENT_INPUTS:${JSON.stringify(safe).replace(/-->/g, "\\u002d\\u002d>")}-->\n${content.replace(/<!--DOCUMENT_INPUTS:[\s\S]*?-->\s*/g, "")}`;
}
export async function serverLeaveInputs(
  userId: string,
  templateName: string,
  raw: unknown,
): Promise<Record<string, string>> {
  if (!isLeaveApplicationTemplateName(templateName)) return {};
  const admin = createAdminSupabaseClient();
  const user = await admin
    .from("users")
    .select("hire_date")
    .eq("id", userId)
    .single();
  databaseError(user.error);
  const balance = await leaveBalance(admin, userId);
  const input =
    raw && typeof raw === "object" ? (raw as Record<string, string>) : {};
  const validated = leaveInput({
    leaveType: input.leave_type || "annual",
    startDate: input.leave_start_date,
    endDate: input.leave_end_date,
    halfDaySlot: input.half_day_slot,
    reason: input.leave_reason,
    idempotencyKey: "document-validation",
  });
  return {
    __template_name: "휴가원",
    hire_date: String(user.data?.hire_date ?? ""),
    used_leave_days: String(balance.totalDeducted),
    remaining_leave_days: balance.computable
      ? String(balance.remainingDays)
      : "계산 불가",
    leave_type: String(validated.leaveType),
  };
}
export async function linkGeneratedLeave(
  userId: string,
  documentId: string,
  templateName: string,
  inputs: Record<string, string>,
) {
  if (!isLeaveApplicationTemplateName(templateName)) return;
  const admin = createAdminSupabaseClient();
  const existing = await admin
    .from("leave_requests")
    .select("id")
    .eq("user_id", userId)
    .eq("document_id", documentId)
    .maybeSingle();
  databaseError(existing.error);
  if (existing.data) return;
  const candidates = await admin
    .from("leave_requests")
    .select("id,half_day_slot,reason")
    .eq("user_id", userId)
    .eq("status", "draft")
    .is("document_id", null)
    .eq("leave_type", (inputs.leave_type || "annual") as LeaveType)
    .eq("start_date", inputs.leave_start_date)
    .eq("end_date", inputs.leave_end_date)
    .order("created_at")
    .limit(20);
  databaseError(candidates.error);
  const candidate = candidates.data?.find(
    (r) =>
      r.half_day_slot === (inputs.half_day_slot || null) &&
      (r.reason ?? "") === (inputs.leave_reason ?? ""),
  );
  if (candidate) {
    await writeLeave(admin, userId, candidate.id, {
      action: "link_document",
      documentId,
    });
    return;
  }
  const body = leaveInput({
    leaveType: inputs.leave_type || "annual",
    startDate: inputs.leave_start_date,
    endDate: inputs.leave_end_date,
    halfDaySlot: inputs.half_day_slot,
    reason: inputs.leave_reason,
    idempotencyKey: `document:${documentId}`,
    documentId,
  });
  await writeLeave(admin, userId, null, body);
}
export function leaveLinkFailure(error: unknown, documentId: string) {
  // The document exists and can be relinked through PATCH link_document; expose its ID.
  return {
    success: false,
    error:
      error instanceof ApiError
        ? error.message
        : "휴가 연결에 실패했습니다. 문서 연결을 다시 시도해 주세요.",
    documentId,
  };
}
