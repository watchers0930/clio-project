import { kstToday, validDate } from "./date";
export { kstToday, validDate, uuid } from "./date";
import { ApiError } from "@/lib/http/api-error";
export function dateRange(from: unknown, to: unknown, maxDays = 92) {
  if (
    !validDate(from) ||
    !validDate(to) ||
    from > to ||
    (Date.parse(to) - Date.parse(from)) / 86400000 >= maxDays
  )
    throw new ApiError(`올바른 날짜와 ${maxDays}일 이내 기간이 필요합니다.`);
  return { from, to };
}
export function correctionBody(date: string, body: Record<string, unknown>) {
  if (!validDate(date) || date > kstToday())
    throw new ApiError("미래 근무일은 보정할 수 없습니다.");
  if (body.mode !== "correct" && body.mode !== "restore")
    throw new ApiError("보정 모드를 확인해 주세요.");
  if (
    typeof body.reason !== "string" ||
    !body.reason.trim() ||
    [...body.reason.trim()].length > 500
  )
    throw new ApiError("사유는 1~500자여야 합니다.");
  if (!Number.isSafeInteger(body.version) || Number(body.version) < 0)
    throw new ApiError("버전을 확인해 주세요.");
  const result: Record<string, unknown> = {
    mode: body.mode,
    reason: body.reason.trim(),
    version: body.version,
  };
  for (const key of ["checkInAt", "checkOutAt"]) {
    const value = body[key];
    if (body.mode === "restore") {
      result[key] = null;
      continue;
    }
    if (
      value !== undefined &&
      value !== null &&
      (typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
          value,
        ) ||
        !Number.isFinite(Date.parse(value)) ||
        kstToday(new Date(value)) !== date)
    )
      throw new ApiError(
        "보정 시각은 근무일과 같은 KST 날짜의 ISO 시각이어야 합니다.",
      );
    if (value !== undefined) result[key] = value;
  }
  if (
    result.checkInAt &&
    result.checkOutAt &&
    Date.parse(String(result.checkInAt)) > Date.parse(String(result.checkOutAt))
  )
    throw new ApiError("출근은 퇴근보다 늦을 수 없습니다.");
  if (
    body.mode === "correct" &&
    !("checkInAt" in result) &&
    !("checkOutAt" in result)
  )
    throw new ApiError("보정 시각을 입력해 주세요.");
  return result;
}
export function pageNumber(raw: string | null, fallback: number, max: number) {
  if (raw === null) return fallback;
  if (
    !/^\d+$/.test(raw) ||
    !Number.isSafeInteger(Number(raw)) ||
    Number(raw) < 1 ||
    Number(raw) > max
  )
    throw new ApiError("페이지 범위를 확인해 주세요.");
  return Number(raw);
}
