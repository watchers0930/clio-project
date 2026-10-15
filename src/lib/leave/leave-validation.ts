import { ApiError } from "@/lib/http/api-error";
import {
  dateRange,
  uuid,
  validDate,
  kstToday,
} from "@/lib/attendance/attendance-validation";
export function leaveInput(body: Record<string, unknown>, partial = false) {
  const allowed = [
    "leaveType",
    "startDate",
    "endDate",
    "halfDaySlot",
    "reason",
    "idempotencyKey",
    "documentId",
    "action",
  ];
  const result: Record<string, unknown> = Object.fromEntries(
    Object.entries(body).filter(([key]) => allowed.includes(key)),
  );
  if (!partial || "leaveType" in body) {
    if (
      !["annual", "monthly", "half_day", "menstrual"].includes(
        String(body.leaveType),
      )
    )
      throw new ApiError("휴가 종류를 확인해 주세요.");
  }
  for (const key of ["startDate", "endDate"])
    if ((!partial || key in body) && !validDate(body[key]))
      throw new ApiError("올바른 휴가 날짜가 필요합니다.");
  if (body.startDate && body.endDate)
    dateRange(body.startDate, body.endDate, 366);
  if (
    body.halfDaySlot !== undefined &&
    body.halfDaySlot !== null &&
    !["am", "pm"].includes(String(body.halfDaySlot))
  )
    throw new ApiError("반차 슬롯을 확인해 주세요.");
  if (
    body.reason !== undefined &&
    (typeof body.reason !== "string" || [...body.reason].length > 1000)
  )
    throw new ApiError("사유는 1000자 이내여야 합니다.");
  if (body.documentId !== undefined && !uuid(body.documentId))
    throw new ApiError("문서 ID를 확인해 주세요.");
  if (
    !partial &&
    (typeof body.idempotencyKey !== "string" ||
      !body.idempotencyKey.trim() ||
      body.idempotencyKey.length > 128)
  )
    throw new ApiError("재시도 키는 1~128자여야 합니다.");
  return result;
}
export function balanceDate(value: string | null) {
  const date = value ?? kstToday();
  if (!validDate(date) || date < "1900-01-01" || date > kstToday())
    throw new ApiError("기준일은 오늘까지의 유효한 날짜여야 합니다.");
  return date;
}
export function leaveFilters(params: URLSearchParams) {
  const status = params.get("status"),
    from = params.get("from"),
    to = params.get("to");
  if (status && !["draft", "pending", "approved", "rejected"].includes(status))
    throw new ApiError("휴가 상태를 확인해 주세요.");
  if (
    (from && !validDate(from)) ||
    (to && !validDate(to)) ||
    (from && to && from > to)
  )
    throw new ApiError("조회 기간을 확인해 주세요.");
  for (const key of ["status", "from", "to", "scope", "userId"])
    if (params.getAll(key).length > 1)
      throw new ApiError("중복 조회 조건은 허용되지 않습니다.");
  const scope = params.get("scope");
  const userId = params.get("userId");
  if (scope !== null && scope !== "self" && scope !== "all")
    throw new ApiError("조회 범위를 확인해 주세요.");
  if (userId !== null && !uuid(userId))
    throw new ApiError("사용자 ID를 확인해 주세요.");
  if (scope === "self" && userId !== null)
    throw new ApiError("본인 조회에 사용자 ID를 함께 지정할 수 없습니다.");
  return { status, from, to, scope, userId };
}
