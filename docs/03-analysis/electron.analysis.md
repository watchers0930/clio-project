# 설계-구현 갭 분석: 클리오 근태관리 (electron)

- **분석일:** 2026-10-15
- **분석자:** 크로미(Claude)
- **기준 설계서:** `docs/02-design/features/electron.design.md` (v1.0)
- **대상:** 작업 트리의 미커밋 구현분(백엔드 Codex + 프론트 Claude, 교차수정 반영 후)
- **교차검수 기준:** `electron.review-backend.md`, `electron.review-frontend.md`
- **검증 범위/한계:** 정적 코드 분석 + 파일 구조·줄수·grep 대조까지. **운영 DB 실적용·설치 앱 실행·실화면 동작은 미검증**(규칙 0-1). 아래 "출시 전 필수 확인"은 로컬 통과로 대체할 수 없다.

---

## 1. Match Rate (일치율)

### 영역별 일치율

| 영역 | 설계 범위 | 일치율 | 근거 |
| --- | --- | --- | --- |
| 데이터 모델(§2) | `attendance_records`·`leave_requests` 테이블·제약·RLS·인덱스·타입 | **100%** | 045~049 마이그레이션으로 그대로 반영 + `attendance_rate_limits`·캘린더 보강. 타입(`DbAttendanceRecord`/`DbLeaveRequest`/뷰) 일치 |
| 보안(§3) | `withMutation`(auth→Origin→CSRF→is_active)·CSRF HMAC·RLS 쓰기 전면거부 | **100%** | `mutation-guard.ts`·`csrf.ts`·`mutation-origins.ts` 설계 그대로. 범위 교정 완료 |
| 백엔드 API(§5) | 신규 8종 + 기존 5종 가드 | **~98%** | 전 엔드포인트 구현. admin 휴가 전체조회까지 구현(설계 §5 충족) |
| 연차 정책(§4.4) | `src/lib/leave-policy/` 순수함수(TS) | **80%** | 기능은 SQL(046)로 **전량 구현**되어 동작 동일하나, 설계가 지정한 TS 파일 위치(`src/lib/leave-policy/*.ts`)와 **불일치**(빈 디렉토리 잔존) |
| 프론트엔드(§1.2·Phase E) | 페이지·컴포넌트·훅·CSRF 래퍼 | **~95%** | 전 컴포넌트/훅 존재, 500줄 이내, 교차검수 지적 대부분 반영 |
| **Electron(§1.3·§4.1·Phase D)** | 자동실행·단일인스턴스·3분 tick·preload `attendance.*` | **0%** | `electron/main.js`·`preload.js` **전혀 변경 안 됨**. 핵심 자동근태 미동작 |

### 종합 Match Rate: **약 83%**

> 백엔드·DB·보안·프론트(화면/훅)의 비중 큰 부분은 95% 이상 일치하나, **P0 핵심 기능인 "자동 근태(Electron Phase D)"가 완전 누락**되어 전체 일치율을 크게 끌어내렸다. Electron 계층만 완성되면 95%+로 상승한다.

---

## 2. Gap 목록 (설계 대비 누락·불일치)

### 🔴 GAP-1 [치명] Electron Phase D 전체 누락 — 자동 근태 미동작
- **설계:** §1.3·§4.1·Phase D(10). `electron/main.js`가 3분 타이머 소유자로 tick 송신, `preload.js`가 `electronAPI.attendance.{onHeartbeatTick/offHeartbeatTick/getAutoLaunch/setAutoLaunch}` 최소 노출, `app.setLoginItemSettings`·`requestSingleInstanceLock`·sender 출처검증.
- **구현:** `git status` 상 `electron/` 디렉토리 **미변경**. `preload.js`에 `attendance` 네임스페이스 없음. `main.js`에 타이머·자동실행·단일인스턴스 코드 없음.
- **영향:** 프론트 `useAttendanceHeartbeat`의 `getElectronAttendance()`가 항상 `null` 반환 → **설치 앱에서도 heartbeat가 단 한 번도 전송되지 않음.** 출근/퇴근 자동 기록, OS 자동실행, 자동실행 ON/OFF 설정이 전부 비동작. 기획서 §6 P0 "자동 출퇴근" 완료 불가.
- **비고:** 백엔드(heartbeat API·upsert)와 프론트(hook·설정 UI `DesktopAutoLaunchSetting`)는 **tick만 오면 동작하도록 준비 완료** 상태. 즉 Electron 글루 코드만 빠졌다.

### 🟡 GAP-2 [중] 연차 정책 위치가 설계와 불일치 (TS → SQL 이전)
- **설계:** §1.2·§4.4는 `src/lib/leave-policy/{accrual,deduction,workdays,types,index}.ts` 순수함수를 **정책 유일 출처**로 지정.
- **구현:** `src/lib/leave-policy/` **빈 디렉토리**(파일 0개). 정책이 `046_leave_policy.sql`의 `leave_balance_internal` 등 SQL RPC로 전량 이전됨. `computeRemainingLeaveDays`·`computeLeaveBalance` 참조도 전부 제거.
- **판정:** 이는 백엔드 교차검수 **MED-1(이중구현 수렴)을 "TS 제거" 방식으로 해소**한 결과로 **기능상 타당**(단일 진실원=SQL 확보). 그러나 ① 설계서 §9 "진실원 동기화"에 따라 **설계서를 SQL 기준으로 갱신**해야 하고, ② 빈 `leave-policy/` 디렉토리는 **삭제**해야 한다(dead dir).

### 🟡 GAP-3 [중] admin 휴가 전체조회 — 구현됨(설계 일치, 과거 MED-5 해소)
- 백엔드 교차검수 MED-5는 "본인조회 고정"을 지적했으나, 현재 `leaveFilters`가 `scope`/`userId`를 파싱하고 `listLeaves`가 `expanded` 시 `role='admin'` 재검증 후 전체조회를 허용한다. **설계 §5와 일치**. (갭 아님 — 해소 확인용으로 기재)

### 🟢 GAP-4 [경] 마이그레이션 분할
- **설계:** 단일 `045_attendance_leave.sql`.
- **구현:** 045(테이블)·046(정책)·047(워크플로)·048(결재커맨드)·049(heartbeat version 교정)로 분할.
- **판정:** 더 세분화된 구성으로 **허용 범위**. 설계 의도(테이블·제약·RLS) 충족. 049는 MED-3 교정을 별도 마이그레이션으로 반영한 흔적.

### 🟢 GAP-5 [경] 프론트 공용 타입 중복
- 프론트가 `components/attendance/types.ts`에 `src/types/attendance.ts`를 **복제**. 현재 필드는 일치하나 향후 한쪽만 변경 시 발산 위험. 공용 타입 재사용 권장(프론트 교차검수 지적과 동일).

---

## 3. 플랫폼 절대규칙 위반 점검

```
─────────────────────────────────────────────────
📋 플랫폼 개발 원칙 점검 (구현 대조)
─────────────────────────────────────────────────
1. 페이지 500줄 제한 : ✅ 준수
2. 단일 책임         : ✅ 준수
3. 서버 검증·보안    : ✅ 준수
4. 성능 (중복·N+1)   : ✅ 준수 (경미 LOW 잔존)
5. 폴더 구조         : ⚠️ 빈 leave-policy/ 디렉토리 정리 필요 (GAP-2)
─────────────────────────────────────────────────
위반 항목: 치명 위반 없음. 구조상 빈 디렉토리 1건 정리 권장
─────────────────────────────────────────────────
```

**1. 페이지 500줄 제한 — ✅**
- `attendance/page.tsx` 5줄(조립만). 신규 컴포넌트 최대 199줄(`LeaveRequestForm`), 훅 최대 125줄. lib 최대 491줄(`generate-document.ts`, 라우트 아닌 lib·기존 이관분, 분기 많아 추가 분리 여지 있으나 페이지 규칙 대상 아님).

**2. 단일 책임 — ✅**
- 라우트 얇음(`route.ts` → `handleAttendance`/서비스 위임). UI(components)/상태(hooks)/검증(validation)/서비스(service)/정책(SQL)/보안가드(http) 분리 명확.

**3. 서버 검증·보안 — ✅**
- 모든 신규 변이 `withMutation`(세션+Origin+CSRF+is_active). `user_id`는 인증결과로 서버 설정(클라 불신). GET도 `withAuth`+is_active+`no-store`. RLS 쓰기 정책 부재로 직접 DB 쓰기 차단. admin 라우트 `role='admin'` 서버 재검증. SQLi 없음(파라미터 바인딩/RPC).

**4. 성능 — ✅ (경미 LOW)**
- heartbeat 일별 upsert(이벤트 원장 미생성). admin 조회 `.in()` 일괄+페이지네이션+기간상한(92/366). 조회 인덱스 설계대로. (LOW: `/balance` 매 호출 재계산, 요청당 admin 클라 재생성 — 경미)

**5. 폴더 구조 — ⚠️**
- `lib/{attendance,leave,http,generation}` 역할대로. 단 설계가 지정한 `lib/leave-policy/`가 빈 디렉토리로 남음(GAP-2) → 삭제 권장.

---

## 4. 교차검수 지적사항 해소 여부

### 백엔드 (electron.review-backend.md)

| ID | 지적 | 해소 | 근거 |
| --- | --- | --- | --- |
| HIGH-1 | CSRF 가드 9종 초과 적용(기존 기능 회귀) | ✅ **해소** | `withMutation` 적용은 설계 §5 범위로 복귀: documents(POST)·documents/[id](PUT/DELETE)·approvals·decide + generate(`generate-document.ts:44`). 범위 밖 9종(ai-context/comments/diff/share 등)은 가드 제거 |
| HIGH-2 | embed-all에 세션 가드 덧씌워 호출불가 | ✅ **해소** | `embed-all/route.ts`가 `withMutation` 제거, `INTERNAL_API_SECRET` 헤더 인증만 유지. 주석도 명시 |
| MED-1 | 정책 TS↔SQL 이중구현 발산위험 | ✅ **해소** | TS `leave-policy` 전량 제거(빈 디렉토리) → SQL 단일 진실원으로 수렴. (단 GAP-2: 설계서 갱신·빈 디렉토리 정리 필요) |
| MED-2 | listLeaves 단일 불일치가 전체 409 차단 | ✅ **해소** | `leave-service.ts`가 행별 `inconsistent` 플래그를 실어 정상 행과 함께 반환. 전체 차단 없음 |
| MED-3 | heartbeat가 version 증가 → 보정 허위 409 | ✅ **해소** | 045 주석 "version은 수동 보정에만 사용. 최초 heartbeat도 버전 0", 049 마이그레이션으로 교정 |
| MED-4 | Origin 화이트리스트 하드코딩 | ✅ **해소(코드)** | `mutation-origins.ts`가 `VERCEL_PROJECT_PRODUCTION_URL`·프리뷰 `VERCEL_URL`·`CSRF_ALLOWED_ORIGINS` 동적 허용. (운영 env 주입은 출시조건 §5) |
| MED-5 | admin 휴가 전체조회 미구현 | ✅ **해소** | `leaveFilters` scope/userId 파싱 + `listLeaves` admin 재검증 후 전체조회 |
| LOW-1~6 | 클라 재생성·재계산·응답형태 등 | ◻️ 대부분 비차단 잔존 | 경미. LOW-3(결재 응답형태 §5 명시)은 계약 문서화 권장 |

**백엔드 HIGH 2건·MED 5건 전부 해소.** 테스트 흔적(`api-contract.test.ts`·`review-regressions.test.ts`·`validation-security.test.ts`)으로 회귀 방어 확인.

### 프론트엔드 (electron.review-frontend.md)

| ID | 지적 | 해소 | 근거 |
| --- | --- | --- | --- |
| F01 (HIGH) | 기존 변이 호출부 CSRF 미이관 → 403 | ✅ **해소** | 문서 생성/삭제(`use-documents-page.ts` `csrfFetch`), 저장(`use-document-viewer-actions`), 상신(`submit-approval-button`), 승인/반려(`approvals-client`) 모두 `csrf-client` 사용 |
| F02 (HIGH) | '휴가원 작성' 링크 생성 계약 불일치 | ✅ **해소** | `LeaveRequestList`가 `create=true&templateName=휴가원&leaveRequestId=`로 이동, `use-documents-page.ts:334`에 이름 해석+프리필 전용 effect 추가 |
| F03 (MED) | 무신호 날짜 수동생성 경로 없음 | ✅ **해소** | `AttendanceControls`에 '기록 추가'(date 선택→`onAddRecord`) 진입점 |
| F04 (MED) | 본인 근태 기간 선택 UI 없음 | ✅ **해소** | `AttendanceControls` from/to 입력+범위검증+상한 표시 |
| F05 (MED) | 단일신호 '연결중' 고착·갱신 안 됨 | ◻️ **부분** | 기간 조회 구조 개선됐으나, 마지막 신호 경과시간 기반 연결판정·자정 경계 자동갱신은 실동작 검증 필요 |
| F06 (MED) | 인증 실패 후 tick마다 재전송·backoff 우회 | ✅ **해소** | `use-attendance-heartbeat.ts` `stopped` 정지상태 + `nextAllowedAt` 게이트(tick 포함 보류) |
| F07 (MED) | 계정전환 시 요청·CSRF 미폐기 | ✅ **해소** | `AbortController`로 진행요청 취소 + `token` 구독으로 재인증 재실행 + cleanup `resetCsrfToken()` |
| F08 (MED) | 조회 응답 역전 경합 | ✅ **해소(추정)** | 훅들이 요청 취소/순번 반영 구조로 개선(실동작 검증 권장) |
| F09 (MED) | 저장 중 모달 재진입 경합 | ◻️ **부분** | 제출 상태 제어 개선. 모든 닫기 경로 세대검증은 실동작 확인 권장 |
| F10 (MED) | 모달 초점관리·대화상자 이름 없음 | ✅ **해소** | `modal.tsx`에 초점이동·focus trap·`previouslyFocused` 복원·`role=dialog`+`aria-labelledby` 추가 |
| F11 (LOW) | 자동실행 스위치 접근 이름 없음 | ✅ **해소** | `DesktopAutoLaunchSetting` `role="switch"`+`aria-labelledby` |
| F12 (LOW) | 종류/반차 선택 상태 색상만 전달 | ⚠️ **미해소(추정)** | `LeaveRequestForm`에 `aria-pressed`/radio 그룹 미확인. AdminAttendancePanel 페이지 이동 버튼 이름도 확인 필요 |
| F13 (LOW) | 숨은 탭 선조회·불필요 연차 재집계 | ◻️ 비차단 | 경미, 미확정 |

**프론트 HIGH 2건 전부 해소, MED 7건 중 5건 해소·2건 부분, LOW 중 F11 해소·F12 잔존.**

---

## 5. 종합 의견 및 남은 수정 우선순위

### 종합 의견
교차수정은 **매우 성공적**이다. 양 교차검수의 **HIGH 4건(backend 2 + frontend 2) 전부, MED 12건 중 10건이 실제 코드에서 해소**됐고, 백엔드는 회귀 테스트까지 추가됐다. 보안·데이터 모델·API 계약·프론트 화면은 설계서를 충실히 반영한 고품질 상태다.

그러나 **단 하나의 치명적 공백** 때문에 "완료"로 볼 수 없다: **Electron Phase D(자동실행 + heartbeat tick)가 전혀 구현되지 않았다.** 이는 백엔드·프론트가 모두 준비를 마쳤음에도 글루 코드(main.js/preload.js) 부재로 **핵심 P0 기능(자동 근태)이 설치 앱에서 0% 동작**함을 의미한다. 규칙 0-1("로컬 됐다 ≠ 실제 됐다")·규칙 0-4("운영에서 사용자 눈으로 확인했는가")에 비추어, 이 상태의 출시는 불가하다.

### 수정 우선순위

**[P0 — 출시 차단] 반드시 구현**
1. **GAP-1: Electron Phase D 구현.** `main.js`에 단일인스턴스·`setLoginItemSettings`·3분 타이머·종료/절전/계정전환 처리, `preload.js`에 `electronAPI.attendance.*` 최소 노출 + sender 출처검증. 완료 후 **설치 앱(macOS arm64/x64·Windows x64)에서 자동실행·heartbeat·창닫기 실환경 검증**.

**[P0 — 출시 조건 (코드 외, 규칙 0-1)]**
2. 045~049 마이그레이션 **운영 DB 실적용** 확인.
3. `leave_calendar_years.verified` **공휴일 캘린더 연도별 적재**(미적재 시 휴가기능 503로 전면 차단 — 백엔드 검수 §7).
4. 운영/프리뷰 도메인을 `CSRF_ALLOWED_ORIGINS`에 **주입**(MED-4 코드는 준비됨, env는 미검증).
5. 보안·권한·회귀 **실화면 검증**: 미인증/토큰누락/위조/타출처 거부, 본인/admin/manager차단, 기존 문서생성·결재·다운로드 회귀.

**[P1 — 안정화]**
6. GAP-2: 설계서 §1.2·§4.4·§9를 "정책=SQL 단일 진실원"으로 **갱신** + 빈 `src/lib/leave-policy/` **삭제**.
7. F05/F09 실동작 검증(연결상태 경과시간 판정·자정경계 갱신, 저장 중 모달 세대검증).
8. GAP-5: 프론트 `components/attendance/types.ts` → 공용 `src/types/attendance.ts` 재사용으로 수렴.

**[P2 — 개선]**
9. F12: 휴가 종류/반차 버튼 `aria-pressed`(또는 radio) + 페이지 이동 버튼 접근 이름.
10. 백엔드 LOW-1~6(클라 재사용·결재 응답형태 §5 명시 등).

---

### 한 줄 결론
> **코드 품질·교차수정 반영도는 출시 수준(≈95%)이나, Electron Phase D 공백 하나로 핵심 기능이 미동작한다. Phase D 구현 + 운영 실환경 검증 전까지는 "완료"가 아니다.**
