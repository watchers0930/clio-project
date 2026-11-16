// 변이 응답 확인 공용 함수 — 실패(HTTP 오류·success:false)를 '조용한 성공'으로 넘기지 않는다.
// 서버가 준 사유({ error: '문자열' } 또는 { error: { message } })를 오류 메시지로 던지므로
// 호출부는 catch 에서 그대로 안내하면 된다. 입력창은 실패하면 닫지 않아 작성 내용을 지킨다.

type ErrorBody = { success?: boolean; error?: unknown };

function messageOf(body: ErrorBody, fallback: string): string {
  const e = body.error;
  if (typeof e === "string" && e.trim()) return e;
  if (e && typeof e === "object" && typeof (e as { message?: unknown }).message === "string") {
    return (e as { message: string }).message;
  }
  return fallback;
}

export async function readJsonOk<T = unknown>(res: Response, fallback: string): Promise<T> {
  let body: ErrorBody = {};
  try {
    body = (await res.json()) as ErrorBody;
  } catch {
    // 본문이 JSON 이 아니면 기본 문구로 처리
  }
  if (!res.ok || body.success === false) throw new Error(messageOf(body, fallback));
  return body as T;
}

// 요청 보내기부터 응답 확인까지 — 네트워크 끊김처럼 응답 자체가 없을 때도 안내 가능한 오류로 바꾼다
export async function requestJsonOk<T = unknown>(send: () => Promise<Response>, fallback: string): Promise<T> {
  let res: Response;
  try {
    res = await send();
  } catch {
    throw new Error(`${fallback} (네트워크 연결을 확인해 주세요.)`);
  }
  return readJsonOk<T>(res, fallback);
}
