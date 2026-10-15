# 근태·휴가 백엔드 적용 메모

## 적용 범위

- 설계서 §5의 신규 API 8개 경로(9개 메서드), 기존 문서 생성·수정·삭제 및 결재 변이 가드.
- DB 시계 기반 heartbeat, 보정+감사 원자 커밋, 휴가 멱등 생성, 문서 연결, 사용자 행 잠금, 결재 트랜잭션 및 상태 동기화.
- Electron·페이지·컴포넌트·hooks는 백엔드 변경 범위 밖.

## 배포 전제

1. 프론트의 기존 문서·결재 변이 호출에도 `X-CSRF-Token`과 쿠키를 포함해야 한다. 프론트 래퍼를 먼저 배포하고 이 서버 코드를 배포한다.
2. 서버 환경에 `CSRF_SECRET` 또는 `JWT_SECRET`, 기존 Supabase URL/anon/service-role 설정이 필요하다. 토큰은 로그인 세션에 결합되며 1시간 유효하다.
3. 승인 출처 기본값은 `https://clioai.vercel.app`, 개발에서는 localhost/127.0.0.1의 3000 포트다. `VERCEL_PROJECT_PRODUCTION_URL`도 허용하며, `VERCEL_ENV=preview/development`일 때만 `VERCEL_URL`을 추가한다(Next.js의 `NODE_ENV=production` 프리뷰 포함). 추가 커스텀 도메인은 `CSRF_ALLOWED_ORIGINS`에 완전한 Origin을 쉼표로 지정한다. 공백·마지막 `/`는 정규화하며 wildcard·경로·인증정보는 허용하지 않는다. 요청의 Host 헤더로 허용 범위를 넓히지 않는다. **배포 전 실제 운영·프리뷰·커스텀 도메인별 출처 허용과 CSRF 토큰 발급/변이 성공을 확인해야 한다.**
4. `045` → `046` → `047` → `048` → `049` 마이그레이션 순서를 지킨다. 기존 `040`과 `users.hire_date`가 선행되어야 한다. 기능 테이블/RLS, 정책 함수, 연결 트리거, 결재 명령을 각각 분리했다. 이미 045~048을 적용한 환경에도 049를 적용해야 heartbeat가 보정 버전을 변경하지 않는다.
5. 운영 적용과 기존 승인 사용분 이관은 별도 확인이 필요하다. 로컬 검증은 운영 반영을 의미하지 않는다.

## 근무일 캘린더

- 근무일은 월~금에서 `leave_calendar`에 등록된 공휴일·회사휴무를 제외한다.
- 인사 담당자가 해당 연도 휴일 데이터를 검증한 뒤 `leave_calendar_years(year, verified)`를 등록해야 한다.
- 미확인 연도가 계산 대상에 포함되면 API는 503을 반환한다. 임의의 평일 기준으로 신청을 확정하지 않는다.
- 기본 정책은 입사일 기준, 개근·출근율80% 충족 전제, 월차는 1년 미만 발생분의 명칭이다.
- 윤년·월말 기념일은 해당 월 말일로 보정한다. 미발생 부여분 선사용은 허용하지 않는다.
- 현재 유효 구간의 승인 차감과 pending 예약을 분리한다. 과거 부여 구간도 사용일 배분 검증에는 포함한다.
- 최초 배포 시 기존 승인 사용분·입사일 누락·캘린더 출처·정책의 인사 확인을 완료해야 한다.

## 로컬 검증

저장소의 패키지 명세는 변경하지 않고 외부 임시 디렉터리에 검증 도구를 설치할 수 있다.

```sh
npm install --prefix /tmp/clio-backend-check --no-package-lock --no-audit --no-fund tsx @electric-sql/pglite
node /tmp/clio-backend-check/node_modules/tsx/dist/cli.mjs --test src/lib/attendance/*.test.ts
PGLITE_MODULE_PATH=/tmp/clio-backend-check/node_modules/@electric-sql/pglite/dist/index.js node supabase/tests/attendance-leave.mjs
npx tsc --noEmit --incremental false
```

SQL 검증은 PGlite의 PostgreSQL 실행 엔진에서 격리된 선행 스키마를 만들고 실제 마이그레이션을 적용한다. 원격 DB나 실제 사용자 데이터를 변경하지 않는다. HTTP 검증은 실제 라우트·가드·검증 코드를 실행하고 Supabase 경계만 대체한다.

## 리뷰 수정 후 API 계약

- 기존 문서 부가기능 9개 경로는 세션·문서 권한 검사를 유지하고 CSRF 토큰을 요구하지 않는다. `embed-all`은 `x-internal-secret` 전용이며 쿠키·Origin·CSRF가 필요 없다.
- 연차 발생·차감·구간 배분의 유일한 구현은 SQL `leave_balance_internal`이다. TS 중복 정책을 제거했다. 문서 렌더러는 `serverLeaveInputs`의 RPC 집계 스냅샷(0·음수·계산 불가 포함)을 그대로 사용한다. 스냅샷 없는 동기 미리보기는 `서버 확인 필요`로 표시한다.
- `GET /api/leave-requests`는 기본/`scope=self`에서 본인만 조회한다. `scope=all`은 전체, `userId=<UUID>`는 지정 사용자 조회이며 활성 admin 역할을 서버에서 다시 확인한다(manager 포함 비admin은 403). `scope=all&userId=<UUID>`는 지정 사용자로 좁힌다. 중복·잘못된 scope/UUID 및 `scope=self&userId`는 400이다. 조회 상한은 기존과 같이 최신 500건이다. 확장 조회 행에는 소유자 `userId`를 포함한다.
- 휴가·연결 결재 상태 불일치나 결재 누락은 해당 행의 `inconsistent:true`로 반환한다. 정상 행은 `false`이며 목록 전체를 409로 차단하지 않는다. DB 조회 자체의 실패는 오류로 처리한다. 프론트 경고 표시는 별도 적용할 수 있다.
- heartbeat는 수동 보정 version을 증가시키지 않는다. 최초 미보정 행은 version=0이며 최초 수신과 보정도 같은 사용자·날짜 잠금으로 직렬화한다. 실제 보정 간 충돌은 계속 409다.
