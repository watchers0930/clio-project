// CSRF 응답 식별 코드 — 서버(lib/http/mutation-guard.ts)와 클라이언트(hooks/csrf-client.ts)가 함께 쓰는 단일 출처.
// 서버 전용 모듈을 클라이언트가 import 하지 않도록 값만 따로 둔다.

/** CSRF 토큰 거절(만료·불일치). 클라이언트는 이 코드일 때만 토큰을 다시 받아 1회 재시도한다. */
export const CSRF_INVALID_CODE = "csrf_invalid";
