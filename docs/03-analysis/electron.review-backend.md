# 백엔드 교차검수 리포트 — 근태관리/휴가(electron)

**검수일:** 2026-10-15
**검수자:** 크로미(Claude) — Codex 백엔드 구현분 교차검수
**대상 범위:** `app/api/`, `lib/`, `types/`, `supabase/` (커밋 안 된 변경분)
**기준 설계서:** `docs/02-design/features/electron.design.md`
**검증 보조:** `npx tsc --noEmit` → **에러 0건** (통합 컴파일 정상)

> ⚠️ 본 리뷰는 **정적 검토 + 타입체크**까지만 수행했다. 운영 DB 마이그레이션 실적용·실화면 동작은 미검증(규칙 0-1). 아래 HIGH 항목은 배포 전 반드시 실환경에서 재확인해야 한다.

---

## 0. 총평

전반적으로 **설계서를 충실히 반영한 고품질 구현**이다. 특히:
- 모든 쓰기 로직을 SQL 함수(`attendance_heartbeat`/`attendance_correct`/`leave_write`/`leave_submit`/`leave_decide`)로 원자화하고 `pg_advisory_xact_lock`+`FOR UPDATE`로 경합을 막은 설계는 §4.4 "사용자 단위 잠금" 요구를 정확히 충족.
- RLS는 SELECT(본인/admin)만 열고 쓰기 정책을 전혀 만들지 않아 service_role 경유만 허용 — §2.2 계약 준수.
- 감사 이력을 보정/상신/결재 트랜잭션 **내부**에 넣어 실패 시 롤백 — §4.2 "await + 실패 시 커밋 거부" 충족.
- 멱등키·`document_id` partial unique·FK `on delete restrict`·버전 낙관락 등 비정상 경로 방어가 설계대로.

그러나 **CSRF 가드를 설계 범위 밖 엔드포인트까지 확대**하면서 기존 기능에 회귀를 유발하는 HIGH 결함이 있다. 배포 전 차단 필요.

---

## 1. HIGH — 배포 차단

### [HIGH-1] CSRF 가드가 설계 범위를 초과 적용되어 기존 기능 회귀
**파일:** `src/app/api/documents/[id]/ai-context/route.ts:+`, `apply-comments/route.ts:+`, `comments/route.ts:+`, `comments/[commentId]/route.ts:+`, `design-prompt/route.ts:+`, `diff/route.ts:+`, `diff/analyze/route.ts:+`, `reflect/route.ts:+`, `share/route.ts:+` (모두 `withMutation` 신규 적용)

**문제:**
설계 §3.4·§5는 CSRF/Origin 가드(`withMutation`) 적용 대상을 **`/api/generate`, `/api/documents`(POST/PUT/DELETE), `/api/approvals`, `/api/approvals/[id]/decide` 4종으로 한정**했다. Codex는 이를 넘어 문서 부가기능 API 9종에 `withMutation`을 추가했다.

이들 엔드포인트의 **기존 프론트 호출부는 raw `fetch`를 쓰며 `X-CSRF-Token`을 싣지 않는다**. 실증:
- `src/components/documents/use-document-viewer-actions.ts:188` → `fetch('/api/documents/${docId}/ai-context', …)` (토큰 없음)
- `src/components/documents/CommentReflectModal.tsx:62` → `fetch('.../apply-comments', …)`
- `src/components/document-diff/DiffAnalysisPanel.tsx:49` → `fetch('.../diff/analyze', …)`

`csrf-client` 래퍼를 쓰는 파일은 전체에서 6개뿐. 따라서 **AI 컨텍스트 생성·댓글 반영·반영(reflect)·디자인 프롬프트·diff·diff 분석·공유·댓글 작성이 전부 403으로 깨진다.**

설계 §3.4는 명시적으로 "프론트 래퍼 적용 → 서버 가드 활성화" 순서를 못박았는데, 범위 밖 엔드포인트는 래퍼 적용이 전제되지 않았다.

**수정 제안:**
1. 범위 밖 9종 엔드포인트의 `withMutation`을 **일단 제거**하여 설계 §5 목록(generate/documents/approvals/decide)으로 복귀. 또는
2. 확대 적용을 유지하려면, **해당 엔드포인트의 모든 프론트 호출부를 `csrf-client` 래퍼로 먼저 전환**한 뒤 서버 가드를 켠다(설계 §3.4 순서). 전환 완료를 출시 조건으로 명시.
3. 어느 쪽이든 "변경 파일 외 전체 `app/api/` + 호출부"를 교차 점검(대장 CLAUDE.md API 체크리스트).

---

### [HIGH-2] `embed-all` — 내부 시크릿 인증 엔드포인트에 사용자 세션 가드를 덧씌워 호출 불가
**파일:** `src/app/api/documents/embed-all/route.ts:8-9`

```ts
export async function POST(request: NextRequest) {
  const mutation = await withMutation(request);   // ← 추가됨
  if (mutation.error) return mutation.error;
  const secret = request.headers.get('x-internal-secret');
  if (!secret || secret !== process.env.INTERNAL_API_SECRET) { … 401 }
```

**문제:**
이 엔드포인트는 주석대로 **`INTERNAL_API_SECRET` 헤더 기반 서버-투-서버/관리용**이다. `withMutation`은 ①브라우저 쿠키 세션(`withAuth`), ②`Origin` 화이트리스트, ③`X-CSRF-Token`을 요구한다. 서버/크론 호출자는 Origin·쿠키·CSRF가 없으므로 **secret 검사에 도달하기 전에 403/401로 차단**된다. 즉 내부 인증 모델과 모순되어 엔드포인트가 사실상 호출 불가가 된다. 설계 §5 가드 대상 목록에도 없다.

(현재 `src/` 내 활성 호출부는 없어 즉시 장애는 아닐 수 있으나, 인증 계약이 깨진 dead-path가 된다.)

**수정 제안:** `embed-all`의 `withMutation`을 제거하고 기존 `INTERNAL_API_SECRET` 검사만 유지. CSRF가 필요 없는 내부 엔드포인트임을 주석에 명시.

---

## 2. MED — 배포 전 수정 권장

### [MED-1] 정책 로직 이중 구현(TS `leave-policy` ↔ SQL `leave_balance_internal`) — 발산 위험
**파일:** `src/lib/leave-policy/*` ↔ `supabase/migrations/046_leave_policy.sql:19-85`, 사용처 `src/lib/templates/leave-application.ts:29`

**문제:**
연차 정책(기념일 발생·근속가산·구간 배분)이 **TS와 SQL에 각각 전량 구현**됐다. 실제 서버 집계(`/balance`, 쓰기 검증)는 전부 SQL RPC가 권위이며, TS `computeLeaveBalance`는 `leave-application.ts`의 동기 렌더용 1곳에서만 `calendar:{holidays:[]}, requests:[]`(공휴일·신청 무시)로 호출된다. 설계 §4.4는 `src/lib/leave-policy/`를 **정책의 유일 출처**로 의도했으나, 실제로는 near-dead 코드가 됐다.
- 한쪽만 수정 시 조용히 발산(예: 발생량 공식 `(i-1)/2` vs `Math.floor((year-1)/2)`는 현재 동일하나 향후 어긋날 수 있음).
- TS 미리보기는 공휴일/기사용을 무시해 **화면 '잔여'가 서버 집계와 다르게 표시**될 수 있다.

**수정 제안:** (a) TS 정책을 제거하고 `leave-application.ts` 미리보기를 `/api/leave-requests/balance` 응답으로 대체하거나, (b) TS는 "표시 전용 근사치"임을 주석·함수명에 명시하고 서버값 우선 원칙을 코드로 강제. 어느 쪽이든 "단일 진실원"을 한 곳으로 수렴.

### [MED-2] `listLeaves` — 단일 행 불일치가 전체 목록을 409로 차단
**파일:** `src/lib/leave/leave-service.ts:88-95`

```ts
if ((data ?? []).some(r => … status.get(r.approval_request_id) !== r.status))
  throw new ApiError("휴가·결재 상태 확인이 필요합니다.", 409);
```

**문제:** 레거시/엣지 1건이라도 `leave_requests.status` ↔ `approval_requests.status`가 어긋나면 **사용자가 자기 휴가 목록을 아예 못 본다**(전체 409). 탐지가 전면 차단으로 이어져 회복 불가(규칙 0-5 비정상 경로). 트리거로 동기화하는 설계상 정상 흐름에선 안 생겨야 하지만, 과거 데이터·수동 개입 시 사용자 체감 장애.

**수정 제안:** 불일치 행에 `inconsistent: true` 플래그를 실어 정상 행과 함께 반환하고, UI에서 해당 건만 경고 표시. 혹은 불일치를 로깅/감사만 하고 목록은 내려준다.

### [MED-3] `attendance_heartbeat`가 `version`을 증가시켜 보정 시 허위 409 유발
**파일:** `supabase/migrations/045_attendance_leave.sql:142` (`version=attendance_records.version+1`)

**문제:** `version`은 보정(correction) 낙관락용인데, 3분마다의 heartbeat마다 +1 된다. 사용자가 **오늘** 보정 모달을 열어(version=N) 입력하는 사이 heartbeat가 들어오면(version=N+1), 제출 시 `attendance_correct`의 버전 검사에 걸려 **실제 동시수정이 아닌데도 409**가 난다. 3분 주기라 충분히 자주 발생.

**수정 제안:** heartbeat upsert에서 `version` 증가를 제거(보정 경로에서만 `version+1`). heartbeat는 `first/last/count`만 갱신하면 §2.5 "heartbeat는 first/last만 갱신" 의도와도 일치.

### [MED-4] Origin 화이트리스트 하드코딩 — 프리뷰/커스텀 도메인에서 전 변이 403
**파일:** `src/lib/http/mutation-guard.ts:24-33`

**문제:** 허용 출처가 `https://clioai.vercel.app` + `CSRF_ALLOWED_ORIGINS`(env) + (비프로덕션 한정 localhost)로 고정. Vercel **프리뷰 배포 URL**이나 추후 **커스텀 도메인**에서 접속하면 모든 POST/PATCH/DELETE가 403. 운영에서만 드러나는 전형적 로컬≠운영 함정(규칙 0-1).

**수정 제안:** 배포 환경의 실제 도메인(프로덕션+필요 프리뷰)을 `CSRF_ALLOWED_ORIGINS`에 반드시 주입하는 것을 **출시 조건**으로 문서화. 가능하면 `VERCEL_URL` 기반 동적 허용(프리뷰)을 비프로덕션에 한해 추가.

### [MED-5] admin 휴가 목록 조회 미구현 — 설계 §5 축소
**파일:** `src/lib/leave/leave-validation.ts:75-77`

**문제:** `leaveFilters`가 `userId`/`scope` 파라미터를 무조건 403 처리. 설계 §5는 "admin 전체조회는 명시 파라미터 + 서버 범위검증 시 허용"으로 열어뒀으나 구현은 **본인 조회로만 고정**(주석: v1 미지정). RLS는 admin SELECT를 허용하지만 라우트가 막는다. 기능 축소가 의도적이면 수용 가능하나 설계와 불일치.

**수정 제안:** v1 범위를 "본인만"으로 확정한다면 설계 §5를 그에 맞게 수정해 계약을 일치시킨다(진실원 동기화, §9).

---

## 3. LOW — 개선 권장(비차단)

- **[LOW-1] 중복 admin 클라이언트 생성.** `serverLeaveInputs`(`leave-document.ts:37`)와 `handleAttendance`의 `get admin()`(`attendance-handler.ts:38`)이 `createAdminSupabaseClient()`를 매 호출/접근마다 새로 만든다. `withMutation`이 이미 만든 `mutation.admin`을 재사용하면 요청당 클라이언트 생성을 줄일 수 있다. 성능 영향은 경미.
- **[LOW-2] balance 매 호출 전량 재계산.** `/balance` GET·쓰기 검증마다 `leave_balance_internal`이 부여·배분을 전부 재계산. 단일 사용자 범위라 비용은 작지만, 설계 §4.4의 `calculation_snapshot` 캐시 활용 여지 있음. 대규모(장기근속·다수 신청) 대비 모니터링 권장.
- **[LOW-3] 결재 응답 형태 불일치.** 휴가 분기 `decide`는 `{success,result,nextStep}`(leave-approval), 일반 분기는 다른 형태를 반환. `POST /api/approvals`(휴가)도 `{success,requestId,line}`로 `leave` 미포함. 프론트 계약을 §5에 명시해 양측 합의 필요.
- **[LOW-4] decide 라우트 매 요청 leave 연결 조회.** `decide/route.ts`가 모든 결재(비휴가 포함)에서 `leave_requests` 조회 1회 추가. 경미한 오버헤드.
- **[LOW-5] `submitLeaveApproval` depth 하드코딩.** 제목에 '휴가원' 포함 시 `depth=3` 강제(`leave-approval.ts:40`). 조직 구조 변경 시 조정 필요 가능.
- **[LOW-6] TS `correctionBody`가 SQL보다 엄격.** correct 모드에서 checkIn/Out 최소 1개 요구(TS)하나 SQL은 미요구. 방어적 중복이라 무해하나 계약 문서화 권장.

---

## 4. 설계 스펙(§2·§5) 일치 여부

| 항목 | 설계 | 구현 | 판정 |
| --- | --- | --- | --- |
| `045` 테이블/제약/RLS/인덱스 | §2.1·§2.2 | 그대로 반영(+`attendance_rate_limits` 추가) | ✅ |
| 쓰기 전면 service_role 경유 | §2.2 | RLS 쓰기 정책 없음, RPC는 service_role grant | ✅ |
| `withMutation` 처리순서(auth→Origin→CSRF) | §3.1 | 일치(+is_active 확인) | ✅ |
| CSRF 발급/검증(HMAC·만료·세션결합) | §3.2 | `csrf.ts` HMAC+exp+session_id | ✅ |
| 가드 적용 대상 | §3.4 (4종) | **9종 초과 적용** | ❌ HIGH-1 |
| heartbeat 수신시각/KST/클라불신/원자 upsert | §4.1 | SQL `clock_timestamp()`·KST·coalesce/greatest | ✅ |
| heartbeat 빈도제한(429) | §3.5·§5 | SQL 분당 30 → `54000`→429 | ✅ |
| 보정 미래금지·날짜일치·사유·버전409·감사 | §4.2 | TS+SQL 이중검증, 감사 트랜잭션 내부 | ✅ |
| 차감(annual/monthly/half/menstrual) | §4.3 표 | `leave_assert`/`leave_balance_internal` 일치 | ✅ |
| 겹침 409(반차 슬롯 예외) | §4.3 | `leave_assert:16-20` 반영 | ✅ |
| 상신=approvals 재사용, step1 자동승인 | §4.3 | `leave_submit` current_step=2 | ✅ |
| 최종 승인만 차감·반복 누적 금지 | §4.3 | status별 배분, 고유 신청 재집계 | ✅ |
| 상태 동기화(트리거)·불일치 탐지 | §4.3 | `leave_approval_sync` 트리거 + `listLeaves` 탐지 | ⚠️ MED-2 |
| 연차 발생공식 `min(25,15+floor((Y-1)/2))` | §4.4 | SQL·TS 동일 | ✅ (MED-1 발산주의) |
| 입사일 누락/미래 → computable:false | §4.4 | 반영 | ✅ |
| 재상신 이력 보존 | §4.3 | `leave_approval_history` on delete restrict | ✅ |
| 연결 문서/결재 삭제 보호 | §4.3 | FK restrict + 문서 삭제 가드 + `leave_document_lock` | ✅ |
| 입사일 변경 감사 | §4.4 | `leave_hire_audit` 트리거 | ✅ |
| 타입(`DbAttendanceRecord`/`DbLeaveRequest`/뷰) | §2.3·§2.4 | 일치, `Database`는 `supabase-database.ts`로 분리 재노출(회귀 아님) | ✅ |
| API 응답 형태/상태코드 | §5 | `ok/fail`+`databaseError` 매핑 일치 | ✅ |
| admin 휴가 전체조회 | §5 | 미구현(본인만) | ⚠️ MED-5 |

---

## 5. 보안 점검 요약

- **인증:** 신규 변이 전부 `withMutation`(세션+CSRF+Origin+is_active). GET는 `withAuth`+is_active. ✅
- **IDOR:** `user_id`는 인증결과로 서버 설정, RPC가 `user_id=p_user`·`created_by` 재검증. admin 라우트는 `role='admin'` 서버 재확인 → 비admin 403. ✅
- **입력검증:** UUID/날짜/기간상한(92·366)/슬롯/사유길이/페이지 범위 — TS+SQL 이중. ✅
- **SQLi:** 전부 파라미터 바인딩·RPC. 문자열 보간 쿼리 없음. ✅
- **감사:** 보정·상신·결재·입사일변경 트랜잭션 내 기록. ✅
- **직접 DB 쓰기 위조:** RLS 쓰기 정책 부재로 차단. ✅
- **CSRF 범위 초과 → 가용성 회귀:** HIGH-1/HIGH-2. ❌

---

## 6. 플랫폼 5대 원칙 점검(백엔드 변경분)

```
─────────────────────────────────────────────────
📋 플랫폼 개발 원칙 점검 (백엔드 교차검수)
─────────────────────────────────────────────────
1. 페이지 500줄 제한 : ✅ 라우트 얇음. generate-document.ts 491줄(라우트 아닌 lib, 기존 route.ts에서 이관) — 분기 많아 추가 분리 여지(권장)
2. 단일 책임         : ✅ route(얇게)/validation/service/policy(SQL)/http 가드 분리 명확
3. 서버 검증·보안    : ⚠️ 검증·인증 설계 충실하나 CSRF 범위 초과로 회귀(HIGH-1/2)
4. 성능(중복·N+1)    : ✅ admin 조회 .in() 일괄·페이지네이션·기간상한. (LOW-1/2 경미)
5. 폴더 구조         : ✅ lib/{attendance,leave,leave-policy,http,generation} 역할대로
─────────────────────────────────────────────────
위반 항목: HIGH-1(CSRF 범위), HIGH-2(embed-all) → 수정 후 배포
─────────────────────────────────────────────────
```

---

## 7. 배포 전 필수 조치(요약)

1. **HIGH-1**: 범위 밖 9종 엔드포인트 `withMutation` 제거(설계 §5 복귀) **또는** 해당 프론트 호출부를 `csrf-client`로 전환 후 가드 활성화.
2. **HIGH-2**: `embed-all`의 `withMutation` 제거, 내부 시크릿 인증만 유지.
3. **MED-3**: heartbeat의 `version` 증가 제거(보정 허위 409 방지).
4. **MED-4**: 운영/프리뷰 도메인을 `CSRF_ALLOWED_ORIGINS`에 주입(출시 조건).
5. **MED-1/2/5**: 정책 이중구현 수렴·목록 부분실패 완화·admin 조회 계약 정리.
6. 공통: 045~048 마이그레이션 **운영 DB 실적용 + 실화면 동작**을 로컬 통과와 별개로 확인(규칙 0-1). `leave_calendar_years.verified` 데이터가 없으면 `55000`→503로 전 휴가기능이 막히므로 **공휴일 캘린더 연도별 verified 적재**를 출시 조건으로.
```
