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
