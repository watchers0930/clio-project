import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  DbLeaveRequest,
  LeaveStatus,
} from "@/lib/supabase/types";
import type { LeaveBalanceView, LeaveRequestView } from "@/types/attendance";
import { ApiError, databaseError } from "@/lib/http/api-error";
import { kstToday } from "@/lib/attendance/attendance-validation";
type Client = SupabaseClient<Database>;
export function leaveView(r: DbLeaveRequest): LeaveRequestView {
  return {
    id: r.id,
    leaveType: r.leave_type,
    startDate: r.start_date,
    endDate: r.end_date,
    halfDaySlot: r.half_day_slot,
    requestedDays: Number(r.requested_days),
    deductDays: Number(r.deduct_days),
    status: r.status,
    reason: r.reason,
    documentId: r.document_id,
    approvalRequestId: r.approval_request_id,
    createdAt: r.created_at,
  };
}
export async function leaveBalance(
  admin: Client,
  userId: string,
  asOf = kstToday(),
): Promise<LeaveBalanceView> {
  const { data, error } = await admin.rpc("leave_balance", {
    p_user: userId,
    p_asof: asOf,
  });
  if (error?.code === "55000")
    throw new ApiError("공휴일·회사휴무 캘린더 확인이 필요합니다.", 503);
  databaseError(error);
  if (!data) throw new ApiError("연차 집계에 실패했습니다.", 503);
  return data as unknown as LeaveBalanceView;
}
export async function writeLeave(
  admin: Client,
  userId: string,
  id: string | null,
  body: Record<string, unknown>,
) {
  const { data, error } = await admin.rpc("leave_write", {
    p_user: userId,
    p_id: id,
    p_body: body,
  });
  if (error?.code === "55000")
    throw new ApiError("공휴일·회사휴무 캘린더 확인이 필요합니다.", 503);
  databaseError(error);
  if (!data) throw new ApiError("휴가 저장에 실패했습니다.", 503);
  return leaveView(data);
}
export async function listLeaves(
  client: Client,
  userId: string,
  filters: {
    status: string | null; from: string | null; to: string | null;
    scope?: string | null; userId?: string | null;
  },
) {
  const expanded = filters.scope === "all" || filters.userId != null;
  if (expanded) {
    const { data: me, error } = await client.from("users")
      .select("role,is_active").eq("id", userId).maybeSingle();
    databaseError(error);
    if (me?.role !== "admin" || !me.is_active)
      throw new ApiError("관리자 권한이 필요합니다.", 403);
  }
  let query = client
    .from("leave_requests")
    .select(
      "id,user_id,document_id,approval_request_id,leave_type,start_date,end_date,half_day_slot,requested_days,deduct_days,status,reason,policy_version,calculation_snapshot,idempotency_key,created_at,updated_at",
    );
  if (!expanded || filters.userId)
    query = query.eq("user_id", filters.userId || userId);
  if (filters.status) query = query.eq("status", filters.status as LeaveStatus);
  if (filters.from) query = query.gte("end_date", filters.from);
  if (filters.to) query = query.lte("start_date", filters.to);
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(500);
  databaseError(error);
  // 불일치는 행 단위로 전달한다. 정상 휴가까지 목록에서 숨기지 않는다.
  const ids = [...new Set((data ?? []).flatMap((r) =>
    r.approval_request_id ? [r.approval_request_id] : [],
  ))];
  const status = new Map<string, string>();
  if (ids.length) {
    const approvals = await client
      .from("approval_requests")
      .select("id,status")
      .in("id", ids);
    databaseError(approvals.error);
    for (const row of approvals.data ?? []) status.set(row.id, row.status);
  }
  return (data ?? []).map((row) => ({
    ...leaveView(row),
    ...(expanded ? { userId: row.user_id } : {}),
    inconsistent: row.approval_request_id
      ? status.get(row.approval_request_id) !== row.status
      : row.status !== "draft",
  }));
}
