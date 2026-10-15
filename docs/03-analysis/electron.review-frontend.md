# Electron 프론트엔드 교차검수

- 검토일: 2026-10-15
- 대상: 작업 트리의 미커밋 프론트엔드 변경분. `git status --short`, `git diff`, `git diff --stat`와 미추적 파일을 함께 확인했다.
- 기준: `docs/02-design/features/electron.design.md` 및 사용자 제공 Platform Development Standard와 참조 요약/프롬프트.
- 범위: `src/components/layout/{app-layout,sidebar}.tsx`, `src/components/attendance/*`, `src/app/(app)/attendance/page.tsx`, 신규 `src/hooks/{csrf-client,use-attendance*,use-leave*}.ts`. 기존 문서·결재 UI, 인증 store, API·서비스·Electron preload는 연결 계약과 회귀 확인 목적으로 읽었다.
- 판정: **수정 후 재검수 필요 — HIGH 2건 / MED 9건 / LOW 2건.** 아래 내용은 코드 경로 분석 결과이며, 별도로 표시한 모의 실행 외 실제 사용자 세션·DB·설치 앱 검증은 수행하지 않았다. 애플리케이션 코드는 수정하지 않았다.

## 지적 사항 — 우선순위 순

### F01. [심각도 HIGH] src/hooks/csrf-client.ts:89 — 기존 변이 호출부가 CSRF 래퍼로 이관되지 않아 문서·결재 기능이 실패한다

- **문제:** 신규 근태 훅만 `apiMutate`를 사용한다. 동일 변경 묶음에서 기존 문서·결재 API는 이미 `withMutation`을 적용했지만, 기존 UI는 토큰 없는 `fetch`를 유지한다. 예: `src/components/documents/use-documents-page.ts:529`의 문서 생성, `:579`의 삭제, `use-document-viewer-actions.ts:61`의 저장, `src/components/approvals/submit-approval-button.tsx:50`의 상신, `approvals-client.tsx:66`의 승인/반려. 인증된 정상 사용자의 요청도 토큰 검증에서 403이 된다. `src/lib/api-client.ts:29`의 기존 공통 클라이언트 역시 토큰을 첨부하지 않는다.
- **설계 근거:** §3.4, §5, Phase E-11은 기존 변이까지 래퍼를 적용한 뒤 서버 가드를 활성화하도록 명시한다. 새 휴가 흐름도 기존 문서 생성 UI를 이용하므로 직접 영향받는다.
- **수정 제안:** 가드가 추가된 엔드포인트의 모든 프론트 호출부를 목록화하고 공통 CSRF 처리로 이관한다. 기존 생성/결재 응답 형식은 유지하고, 생성·저장·삭제·댓글·공유·상신·승인·반려를 실제 세션으로 회귀 검증한다.

### F02. [심각도 HIGH] src/components/attendance/LeaveRequestList.tsx:100 — ‘휴가원 작성’ 링크가 기존 생성 진입 계약과 맞지 않는다

- **문제:** `/documents?template=leave-application&leaveRequestId=...`로 이동하지만 문서 화면은 `create=true`일 때만 생성 모달을 연다(`src/components/documents/use-documents-page.ts:276–307`). `template`은 템플릿 ID로 사용되며 고정 문자열 `leave-application`을 실제 템플릿으로 해석하는 코드가 없다. `leaveRequestId`를 읽어 신청 내용을 프리필하거나 연결하는 코드도 없다. 따라서 신청자가 초안을 만든 뒤 버튼을 눌러도 작성 모달과 신청 정보 연결이 이어지지 않는다. 서버의 자동 연결은 종류·기간·반차 슬롯·사유가 일치하는 초안을 찾으므로, 값 전달 누락은 다른 초안 생성/연결 누락으로도 이어질 수 있다(`src/lib/leave/leave-document.ts:81`).
- **설계 근거:** §4.3은 근태 폼 → 본인정보 프리필 휴가원 생성 → 동일 신청 연결 및 부분 실패 재시도를 요구한다.
- **수정 제안:** 실제 휴가원 템플릿 ID와 생성 모달 진입 계약을 사용한다. 신청 ID로 데이터를 읽어 프리필하고, 생성 성공 후 동일 초안에 연결되도록 한다. 연결 실패 시 생성된 문서 ID를 보존해 `link_document`만 재시도할 UI도 제공한다.

### F03. [심각도 MED] src/components/attendance/AttendanceMonthlyList.tsx:41 — 자동 신호 없는 날짜의 수동 생성 경로가 없다

- **문제:** 보정 모달은 기존 `days.map` 안의 보정 버튼으로만 열린다. 실제 GET은 저장된 행만 반환하며 빈 날짜를 생성하지 않는다(`src/lib/attendance/attendance-service.ts:34`). 기록 없는 날은 목록에 나오지 않고, 전체 빈 데이터에서도 안내만 표시된다. 웹 사용자나 앱 실행을 놓친 사용자는 누락 날짜를 보정할 수 없다.
- **설계 근거:** §4.2와 PATCH 계약은 신호 없는 날도 `version:0`으로 수동 생성할 수 있어야 한다.
- **수정 제안:** 날짜 선택형 ‘기록 추가’ 진입점을 제공하거나 조회 구간의 빈 날짜 행을 만들어 보정 모달에 넘긴다. 빈 데이터와 일부 날짜 누락 양쪽에서 `version:0` 제출을 검증한다.

### F04. [심각도 MED] src/components/attendance/AttendanceView.tsx:95 — 본인 근태의 기간 선택 UI가 빠져 과거 기록에 접근할 수 없다

- **문제:** 훅은 `range`, `setRange`를 제공하지만 화면은 이를 사용하지 않는다. 기본 최근 30일 전부터 오늘까지의 범위만 조회하므로 그 이전 월의 조회·보정이 불가능하다. ‘기간별 기록’에 실제 기간도 표시되지 않는다.
- **설계 근거:** §1.2의 월별 목록·조회 필터와 §5의 from/to 조회 계약.
- **수정 제안:** 월 이동 또는 시작일/종료일 필터와 현재 조회 구간 표시를 추가한다. 날짜 역전·빈 날짜·서버 기간 상한을 처리하고 구간 변경 시 현재 보정 모달의 대상도 정리한다.

### F05. [심각도 MED] src/components/attendance/AttendanceSummaryCard.tsx:17 — 하루 한 번 신호만 있어도 계속 연결 중으로 표시되며 화면 데이터도 갱신되지 않는다

- **문제:** 연결 여부는 마지막 신호 시각이 아니라 `heartbeatCount > 0`만 본다. 훅은 마운트/기간 변경 시에만 GET하고 heartbeat 성공을 화면 조회 상태에 반영하지 않는다. 화면을 켜 둔 채 신호가 계속 들어와도 출퇴근·마지막 신호가 오래된 값으로 남고, 6분 넘게 연결이 끊겨도 ‘자동 기록 연결됨’으로 표시된다. 자정을 지나도 기본 조회 범위와 서버가 내려준 `isToday`가 갱신되지 않는다.
- **설계 근거:** §4.1의 6분 생존 누락 안내와 Phase E-16의 연결 실패 상태.
- **수정 제안:** heartbeat 결과/실패 상태를 구독 가능한 상태로 제공하고 관련 근태 조회를 갱신한다. 마지막 성공 시각의 경과 시간으로 연결 상태를 계산하고, KST 날짜 변경 시 조회 구간을 갱신한다. 중복 폴링이 생기지 않게 갱신 주체를 하나로 둔다.

### F06. [심각도 MED] src/hooks/use-attendance-heartbeat.ts:65 — 인증 실패 후에도 tick마다 재전송하며 tick이 backoff를 우회한다

- **문제:** 401/403에서 타임아웃만 지우고 구독을 유지하므로 다음 IPC tick은 다시 `send()`를 실행한다. 재인증을 기다리는 정지 상태가 없다. 네트워크 오류로 backoff가 3분보다 길어진 경우에도 tick은 지연 기한을 확인하지 않고 전송한다. 동일 사용자 재인증은 `userId`가 바뀌지 않을 수 있어, 주석의 ‘재인증 시 effect 재실행’도 보장되지 않는다.
- **확인:** 원본 TS를 메모리에서 변환한 모의 실행에서 초기 401 이후 tick 2회에 총 **3회** 요청이 발생했다. 인증 실패 중단 기준은 1회다.
- **수정 제안:** 인증 오류 시 전송 정지 상태를 두고 인증 세션 변화에 따라 재개한다. tick과 retry 모두 동일한 `nextAllowedAt`/전송 스케줄을 따르게 한다.

### F07. [심각도 MED] src/hooks/use-attendance-heartbeat.ts:81 — 계정 전환 시 진행 중인 요청과 CSRF 발급이 폐기되지 않는다

- **문제:** cleanup의 `cancelled`는 `apiMutate` 완료 후 결과 처리를 막을 뿐 HTTP 전송은 막지 못한다. 예를 들어 이전 계정에서 `/api/csrf`를 기다리는 동안 로그아웃/계정 전환해도, 발급 완료 후 `apiMutate`는 계속 POST하고 403이면 새 토큰으로 다시 POST한다. 쿠키가 전환된 경우 이전 effect의 작업이 새 계정 세션으로 이어질 수 있다. `resetCsrfToken`은 선언만 있고 호출자가 없으며, 함수 자체도 진행 중인 발급 응답의 캐시 재기록을 막지 못한다.
- **확인:** CSRF 발급 응답을 지연한 모의 실행에서 `resetCsrfToken()` 후 이전 응답을 완료하자 다음 조회가 기존 세션 토큰을 반환했다(재발급 요청 없음).
- **설계 근거:** §4.1은 계정 전환 시 이전 타이머와 요청을 폐기하도록 요구한다.
- **수정 제안:** GET/변이 래퍼에 AbortSignal과 세션 세대 검증을 전달해 cleanup 시 취소한다. 토큰 대기 후와 재시도 전에도 세션을 확인하고, 인증 변경 시 캐시 및 이전 발급 결과를 무효화한다. 이미 서버에 도착한 요청의 취소 한계는 별도로 고려한다.

### F08. [심각도 MED] src/hooks/use-attendance-admin.ts:40 — 조회 응답 순서가 뒤집히면 이전 필터 결과가 현재 필터를 덮어쓴다

- **문제:** 직원/날짜/페이지 변경마다 GET을 시작하지만 취소나 요청 ID 검증 없이 모두 `setResult`와 `setLoading(false)`를 실행한다. 직원 A 요청이 느린 상태에서 B를 선택하면 B 결과 뒤에 A 결과가 표시될 수 있고, 이전 요청 완료가 최신 요청의 로딩을 해제할 수도 있다. 본인 근태 훅의 `load`도 같은 구조다.
- **수정 제안:** effect cleanup에 AbortController를 연결하거나 요청 순번을 비교해 최신 쿼리 응답만 반영한다. 느린 A → 빠른 B 응답 순서와 오류 응답 역전도 검증한다.

### F09. [심각도 MED] src/components/attendance/LeaveRequestForm.tsx:96 — 저장 중 모달을 닫고 다시 열면 이전 요청 완료가 새 폼을 닫을 수 있다

- **문제:** 취소 버튼만 비활성화하고 Modal의 `onClose`는 그대로 전달한다. 공통 Modal은 Escape·배경·우측 닫기 버튼으로 언제든 닫힌다. 요청 중 닫고 다시 열면 폼은 새 멱등키로 초기화되지만, 이전 요청이 성공할 때 `run()`의 `onClose()`가 새 폼까지 닫는다. 이전 실패 메시지도 새 폼에 나타날 수 있다. 보정 모달도 동일한 생명주기 문제가 있다(`AttendanceCorrectionModal.tsx:93`).
- **수정 제안:** 제출 중 모든 닫기 경로를 일관되게 제어하거나, 폼 열림 세대/요청 식별자로 완료 처리를 한정한다. 닫기 허용 시 처리 중 작업 상태와 재시도용 식별자를 보존한다.

### F10. [심각도 MED] src/components/attendance/AttendanceCorrectionModal.tsx:93 — 신규 모달에 초점 관리와 접근 가능한 대화상자 이름이 없다

- **문제:** 신규 보정·휴가 모달이 사용하는 기존 `src/components/ui/modal.tsx`는 열 때 초점을 이동하지 않고, Tab 초점 가두기·닫은 후 초점 복원도 없다. `role="dialog"`, `aria-modal`만 있으며 제목을 `aria-labelledby`로 연결하지 않는다. 키보드 사용자가 모달을 열어도 뒤쪽 UI에서 작업하거나 배경으로 빠질 수 있다. 공통 컴포넌트의 기존 문제지만 신규 핵심 입력 흐름에서 그대로 노출된다.
- **수정 제안:** 공통 Modal에 제목 ID/대화상자 이름, 초기 초점, 초점 가두기, 닫은 뒤 트리거 복원을 구현한다. 신규 두 모달을 키보드만으로 열기·입력·오류 수정·닫기까지 검증한다.

### F11. [심각도 MED] src/components/attendance/DesktopAutoLaunchSetting.tsx:90 — 자동실행 스위치에 접근 가능한 이름이 없다

- **문제:** 스위치 내부는 빈 장식 span뿐이고 주변 ‘OS 로그인 시 자동실행’ 문구와 연결돼 있지 않다. 스크린 리더가 상태는 읽어도 무엇을 변경하는지 식별할 수 없다.
- **수정 제안:** 설명 제목에 ID를 두고 `aria-labelledby`로 연결하거나 `aria-label`을 제공한다. 오류 안내도 스위치와 연결한다.

### F12. [심각도 LOW] src/components/attendance/LeaveRequestForm.tsx:102 — 휴가 종류와 반차 슬롯의 선택 상태가 색상으로만 전달된다

- **문제:** 선택 버튼들은 CSS만 바뀌며 `aria-pressed`, radio의 `checked`, 그룹 이름 등이 없다. 보조기술에서는 현재 종류와 오전/오후 선택을 구분할 수 없다. 관리자 페이지 이동의 화살표 버튼도 이름이 없다(`AdminAttendancePanel.tsx:175`).
- **수정 제안:** 종류/슬롯은 이름 있는 fieldset과 radio로 구현하거나 적절한 선택 상태·키보드 동작을 제공한다. 페이지 이동 버튼에는 ‘이전 페이지’/‘다음 페이지’ 이름을 넣는다.

### F13. [심각도 LOW] src/components/attendance/AttendanceView.tsx:35 — 숨겨진 휴가 탭을 먼저 조회하고 무관한 보정 후 연차를 재조회한다

- **문제:** 기본 ‘내 근태’에서도 휴가 목록과 잔여 훅이 즉시 마운트되어 관련 GET 2건이 추가된다. 근태 보정 성공 후에도 연차 집계 API를 다시 호출한다(`:57`). 실제 연차 계산 입력은 입사일·정책·승인 휴가이며 근태 보정은 이 값을 바꾸지 않는다. 관리자 탭은 다시 방문할 때마다 직원 전체 목록을 읽는다.
- **수정 제안:** 휴가 탭 최초 방문 시 조회하거나 enabled 옵션으로 제어하고, 실제 휴가 변경에만 잔여를 무효화한다. 직원 선택 목록은 적절한 범위에서 재사용한다. 렌더 횟수 병목은 측정하지 않았으므로 별도 확정 지적으로 추가하지 않았다.

## API 계약·구조 확인

- 신규 근태/휴가 GET·PATCH·POST의 URL, camelCase 요청 필드와 `{success,data,error}` 해석은 설계 및 현재 서버 구현과 대체로 일치한다. 보정은 version을 보내고, half_day는 단일 날짜와 슬롯을 보낸다. 신청·차감 일수는 서버에 맡긴다. `PATCH action:'submit'`도 §5에 정의된 경로다.
- 신규 페이지는 5줄로 조립만 수행하고 신규 파일은 최대 193줄이다. 500줄 제한 위반은 없다. 전용 UI 위치는 설계 §1.2의 `components/attendance` 계획과 일치한다.
- 프론트 타입은 `components/attendance/types.ts`에 서버 공용 `src/types/attendance.ts`와 별도로 복제돼 있다. 현재 뷰 필드는 일치하지만 이후 계약 변경이 한쪽에만 반영될 위험이 있다. 공용 타입을 재사용하고 화면 라벨만 UI 모듈에 두는 정리가 권장된다.
- admin 탭 노출은 `role === 'admin'`으로 제한하며, 서버도 admin을 재검증한다. manager 전체 조회를 허용하는 신규 프론트 경로는 확인하지 못했다. 실제 admin/user/manager 세션 동작은 미검증이다.
- `computable:false`, 음수 잔여, 단일 신호, 일반 로딩/오류/빈 데이터 안내는 존재한다. 다만 오류 후 즉시 재시도 버튼과 초안 수정 UI는 연결되지 않았다. 월별 목록은 주석/설계와 달리 원본 heartbeat·보정 사유를 표시하지 않아 보정값과 원본 비교가 어렵다.

## 검증 결과 — 누락·위험·우선순위

| 분류 | 결과 | 우선순위 |
| --- | --- | --- |
| 누락 | 기존 변이 호출부 CSRF 이관, 휴가원 생성·프리필·연결 복구 | P0: F01–F02 |
| 누락 | 무신호 날짜 생성, 본인 기간 선택, heartbeat 기반 표시 갱신 | P1: F03–F05 |
| 위험 | 인증 실패 반복 전송, 계정 전환 중 요청 지속, 조회 응답 경합, 저장 중 모달 재진입 | P1: F06–F09 |
| 누락 | 대화상자 초점/이름, 자동실행 스위치 이름, 선택 상태 전달 | P1/P2: F10–F12 |
| 위험 | 숨겨진 탭 선조회와 불필요 연차 재집계 | P2: F13 |

실행한 확인:

- `npx tsc --noEmit --incremental false`: 통과.
- 대상 신규 프론트 파일 및 변경된 레이아웃/사이드바에 대한 `npx eslint`: 오류 0, 경고 1. sidebar 72행의 `enabledOptional` 의존성 경고는 기존 코드이며 이번 diff로 추가된 문제가 아니므로 신규 지적에서 제외했다.
- F06/F07: 원본 TS를 TypeScript로 메모리 변환하여 Node VM에서 React effect/IPC/fetch를 모의 실행. 실제 Electron/React 렌더링 통합 테스트는 아니다. 테스트 파일은 저장하지 않았다.
- Next.js 로컬 문서 `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`의 서버/클라이언트 구분을 확인했다.

남은 검증 한계와 출시 위험:

- 현재 `electron/preload.js`에는 `electronAPI.attendance`가 없고 main/preload 변경도 작업 트리에 없다. 현재 저장소의 설치 앱에서는 heartbeat 구독·자동실행 제어가 활성화되지 않는다. 이는 프론트 단독 결함으로 집계하지 않았지만 Phase D 연동 전에는 핵심 자동 기록 기능을 완료로 볼 수 없다.
- 실제 DB 저장·보정·복원·동시수정 409, 문서 생성/연결 부분 실패 복구, 최종 승인 후 예약/차감 갱신, 권한별 401/403을 실제 세션으로 검증해야 한다. 이번 검토의 타입/lint 통과는 이러한 완료 기준을 대신하지 않는다.
- 설치 앱에서 자동실행·절전·복귀·창 닫기, 계정 전환 중 지연 요청, 오프라인 후 복구와 KST 자정 경계를 확인해야 한다. 스크린 리더와 실제 키보드 초점 이동도 미검증이다.
