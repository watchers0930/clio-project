import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, DbLeaveRequest } from "@/lib/supabase/types";
import { buildApprovalLine, type OrgMember } from "@/lib/approval/build-line";
import { ApiError, databaseError } from "@/lib/http/api-error";
import { leaveView } from "./leave-service";
import { createNotifications } from "@/lib/notifications/create-notification";
type Client = SupabaseClient<Database>;
export async function linkedLeave(admin: Client, documentId: string) {
  const { data, error } = await admin
    .from("leave_requests")
    .select("id")
    .eq("document_id", documentId)
    .maybeSingle();
  databaseError(error);
  return data;
}
export async function submitLeaveApproval(
  admin: Client,
  userId: string,
  documentId: string,
) {
  const doc = await admin
    .from("documents")
    .select("id,title,template_id,created_by")
    .eq("id", documentId)
    .eq("created_by", userId)
    .maybeSingle();
  databaseError(doc.error);
  if (!doc.data) throw new ApiError("본인의 문서를 찾을 수 없습니다.", 404);
  let depth = 3;
  if (doc.data.template_id) {
    const template = await admin
      .from("templates")
      .select("approval_depth")
      .eq("id", doc.data.template_id)
      .maybeSingle();
    databaseError(template.error);
    depth = Number(template.data?.approval_depth) || 3;
  }
  if (/휴가원/.test(doc.data.title ?? "")) depth = 3;
  const members = await admin
    .from("users")
    .select(
      "id,name,email,manager_user_id,rank_level,rank_title,signature_path",
    )
    .eq("is_active", true);
  databaseError(members.error);
  const line = buildApprovalLine(
    userId,
    new Map((members.data ?? []).map((m) => [m.id, m as OrgMember])),
    depth,
  );
  if (line.length < 2)
    throw new ApiError(
      "조직도에서 직속 상위자를 설정해 주세요. 상신되지 않아 기존 신청 상태를 유지합니다.",
      409,
    );
  const { data, error } = await admin.rpc("leave_submit", {
    p_user: userId,
    p_document: documentId,
    p_line: line.map((s) => ({ ...s })),
  });
  databaseError(error);
  if (!data)
    throw new ApiError(
      "상신에 실패했습니다. 기존 신청 상태를 유지합니다.",
      503,
    );
  await createNotifications(admin, {
    recipientIds: [line[1].approver_id],
    actorId: userId,
    type: "approval_requested",
    title: "결재 요청",
    body: "휴가원 결재를 요청했습니다.",
    link: `/documents/${documentId}`,
  }).catch(() => {});
  return {
    requestId: data.requestId,
    line,
    leave: leaveView(data.leave as DbLeaveRequest),
  };
}
export async function decideLeaveApproval(
  admin: Client,
  userId: string,
  requestId: string,
  action: string,
  comment: string,
) {
  const { data, error } = await admin.rpc("leave_decide", {
    p_actor: userId,
    p_request: requestId,
    p_action: action,
    p_comment: comment,
  });
  databaseError(error);
  if (!data) throw new ApiError("결재 처리에 실패했습니다.", 503);
  const req = await admin
    .from("approval_requests")
    .select("requester_id,document_id")
    .eq("id", requestId)
    .single();
  if (req.data) {
    if (data.result === "advanced") {
      const step = await admin
        .from("approval_steps")
        .select("approver_id")
        .eq("request_id", requestId)
        .eq("step_order", Number(data.nextStep))
        .single();
      if (step.data)
        await createNotifications(admin, {
          recipientIds: [step.data.approver_id],
          actorId: userId,
          type: "approval_requested",
          title: "결재 요청",
          body: "휴가원 결재 차례입니다.",
          link: `/documents/${req.data.document_id}`,
        }).catch(() => {});
    } else
      await createNotifications(admin, {
        recipientIds: [req.data.requester_id],
        actorId: userId,
        type:
          data.result === "rejected"
            ? "approval_rejected"
            : "approval_approved",
        title: "휴가원 결재 결과",
        body:
          data.result === "rejected"
            ? "휴가원 결재가 반려되었습니다."
            : "휴가원 결재가 완료되었습니다.",
        link: `/documents/${req.data.document_id}`,
      }).catch(() => {});
  }
  return data;
}
