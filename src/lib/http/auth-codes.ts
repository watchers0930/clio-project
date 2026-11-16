// 인증 응답 code 단일 출처 — 서버(me 라우트)와 클라이언트(auth-store)가 같은 값으로 판정한다.
// 'not_registered' 는 "직원 명부(users)에 정말 없음"일 때만 붙는다. 조회 오류(500)·일시 장애와 구분해
// 클라이언트가 이 경우에만 세션을 끊게 한다(일시 오류로 실제 직원을 로그아웃시키지 않음).
export const NOT_REGISTERED_CODE = 'not_registered';
