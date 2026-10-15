import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, DbAttendanceRecord } from "@/lib/supabase/types";
import type { AttendanceDayView } from "@/types/attendance";
import { databaseError, ApiError } from "@/lib/http/api-error";
import { kstToday } from "./attendance-validation";
type Client = SupabaseClient<Database>;
const COLUMNS =
  "id,user_id,work_date,first_heartbeat_at,last_heartbeat_at,heartbeat_count,manual_check_in_at,manual_check_out_at,correction_reason,corrected_at,corrected_by,version,created_at,updated_at";
export function attendanceView(row: DbAttendanceRecord): AttendanceDayView {
  const mi = row.manual_check_in_at,
    mo = row.manual_check_out_at;
  return {
    workDate: row.work_date,
    effectiveCheckIn: mi ?? row.first_heartbeat_at,
    effectiveCheckOut: mo ?? row.last_heartbeat_at,
    source:
      mi && mo
        ? "manual"
        : mi || mo
          ? "mixed"
          : row.first_heartbeat_at
            ? "auto"
            : "none",
    firstHeartbeatAt: row.first_heartbeat_at,
    lastHeartbeatAt: row.last_heartbeat_at,
    heartbeatCount: row.heartbeat_count,
    isCorrected: Boolean(mi || mo),
    correctionReason: row.correction_reason,
    isSingleSignal: row.heartbeat_count === 1,
    isToday: row.work_date === kstToday(),
    version: row.version,
  };
}
export async function attendanceDays(
  client: Client,
  userId: string,
  from: string,
  to: string,
) {
  const { data, error } = await client
    .from("attendance_records")
    .select(COLUMNS)
    .eq("user_id", userId)
    .gte("work_date", from)
    .lte("work_date", to)
    .order("work_date");
  databaseError(error);
  return (data ?? []).map(attendanceView);
}
export async function heartbeat(admin: Client, userId: string) {
  const { data, error } = await admin.rpc("attendance_heartbeat", {
    p_user: userId,
  });
  databaseError(error);
  if (!data) throw new ApiError("근태 저장에 실패했습니다.", 503);
  return {
    workDate: data.work_date,
    firstHeartbeatAt: data.first_heartbeat_at,
    lastHeartbeatAt: data.last_heartbeat_at,
    heartbeatCount: data.heartbeat_count,
  };
}
export async function correctAttendance(
  admin: Client,
  userId: string,
  date: string,
  body: Record<string, unknown>,
) {
  const { data, error } = await admin.rpc("attendance_correct", {
    p_user: userId,
    p_date: date,
    p_body: body,
  });
  databaseError(error);
  if (!data) throw new ApiError("근태 보정에 실패했습니다.", 503);
  return attendanceView(data);
}
export async function adminAttendance(
  client: Client,
  userId: string,
  from: string,
  to: string,
  page: number,
  pageSize: number,
  filter?: string,
) {
  const { data: me, error: roleError } = await client
    .from("users")
    .select("role,is_active")
    .eq("id", userId)
    .maybeSingle();
  databaseError(roleError);
  if (me?.role !== "admin" || !me.is_active)
    throw new ApiError("관리자 권한이 필요합니다.", 403);
  let query = client
    .from("users")
    .select("id,name,department_id", { count: "exact" })
    .order("name")
    .order("id");
  if (filter) query = query.eq("id", filter);
  const {
    data: users,
    count,
    error,
  } = await query.range((page - 1) * pageSize, page * pageSize - 1);
  databaseError(error);
  if (!users?.length) return { rows: [], total: count ?? 0, page, pageSize };
  // Supabase caps each response at 1000 rows; fetch bounded pages for the whole employee page.
  const recordRows: DbAttendanceRecord[] = [];
  for (let offset = 0; offset < users.length * 92; offset += 1000) {
    const records = await client
      .from("attendance_records")
      .select(COLUMNS)
      .in(
        "user_id",
        users.map((u) => u.id),
      )
      .gte("work_date", from)
      .lte("work_date", to)
      .order("work_date")
      .order("user_id")
      .range(offset, offset + 999);
    databaseError(records.error);
    recordRows.push(...(records.data ?? []));
    if ((records.data?.length ?? 0) < 1000) break;
  }
  const departmentIds = users.flatMap((u) =>
    u.department_id ? [u.department_id] : [],
  );
  const departments = departmentIds.length
    ? await client.from("departments").select("id,name").in("id", departmentIds)
    : { data: [], error: null };
  databaseError(departments.error);
  const names = new Map((departments.data ?? []).map((d) => [d.id, d.name]));
  const byUser = new Map<string, AttendanceDayView[]>();
  for (const row of recordRows) {
    const days = byUser.get(row.user_id) ?? [];
    days.push(attendanceView(row));
    byUser.set(row.user_id, days);
  }
  return {
    rows: users.map((u) => ({
      userId: u.id,
      userName: u.name,
      department: names.get(u.department_id ?? "") ?? null,
      days: byUser.get(u.id) ?? [],
    })),
    total: count ?? 0,
    page,
    pageSize,
  };
}
