import { fail } from "@/lib/api-helper";
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function errorResponse(error: unknown) {
  return error instanceof ApiError
    ? fail(error.message, error.status)
    : fail("일시적인 오류입니다. 잠시 후 다시 시도해 주세요.", 503);
}
export function databaseError(
  error: { code?: string; message?: string } | null,
) {
  if (!error) return;
  // P0001(커스텀 RAISE)은 코드가 전부 동일하므로 message로 원인을 세분화한다.
  // (DB 함수 leave_assert/leave_write의 raise exception 문구와 연동 — 문구 변경 시 함께 갱신)
  if (error.code === "P0001") {
    const m = error.message ?? "";
    let msg = "요청이 현재 상태와 충돌합니다. 잔여량·겹침·연결 상태를 확인해 주세요.";
    if (m.includes("insufficient balance")) msg = "휴가 잔여일수가 부족합니다. 신청 기간을 줄여 주세요.";
    else if (m.includes("overlap")) msg = "이미 신청·승인된 휴가와 기간이 겹칩니다. 날짜를 확인해 주세요.";
    else if (m.includes("leave locked")) msg = "이미 상신되어 수정할 수 없는 휴가원입니다.";
    else if (m.includes("linked document locked")) msg = "연결된 문서가 있어 내용을 변경할 수 없습니다.";
    throw new ApiError(msg, 409);
  }
  const messages: Record<string, [string, number]> = {
    P0001: [
      "요청이 현재 상태와 충돌합니다. 잔여량·겹침·연결 상태를 확인해 주세요.",
      409,
    ],
    "23505": ["이미 처리되었거나 다른 요청과 충돌합니다.", 409],
    "23001": ["연결된 자료가 있어 변경할 수 없습니다.", 409],
    "23503": ["연결된 자료가 있어 변경할 수 없습니다.", 409],
    "23514": ["입력값 또는 휴가 잔여량을 확인해 주세요.", 409],
    "42501": ["요청 권한이 없습니다.", 403],
    P0002: ["요청한 자료를 찾을 수 없습니다.", 404],
    "22023": ["입력값을 확인해 주세요.", 400],
    "54000": ["요청 빈도를 초과했습니다.", 429],
  };
  const [message, status] = messages[error.code ?? ""] ?? [
    "데이터 처리에 실패했습니다. 다시 시도해 주세요.",
    503,
  ];
  throw new ApiError(message, status);
}
export async function readBody(
  request: Request,
): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new Error();
    return body;
  } catch {
    throw new ApiError("올바른 JSON 객체가 필요합니다.");
  }
}
