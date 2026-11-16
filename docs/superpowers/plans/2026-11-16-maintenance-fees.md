# 관리비 메뉴 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `role='admin'` 전용 '관리비' 메뉴 — 항목·사용량·단가·금액을 손으로 입력하고 월별·연도별로 조회

**Architecture:** 전용 테이블 2개(사용자 세션 정책 0개, 서버 service role 전용) + `app/api/maintenance-fees/**`(requireAdmin, 변이는 withMutation) + 순수 계산/검증 모듈 `lib/maintenance-fees/` + hook 1개 + 화면 컴포넌트 5개

**Tech Stack:** Next.js 16 App Router, Supabase(Postgres), TypeScript, Tailwind, `node:test` + `tsx`

**Spec:** `docs/superpowers/specs/2026-11-16-maintenance-fees-design.md`

## Global Constraints
- 열람·수정: `users.role = 'admin'`만. 대표 직급(rank_level<=1)만으로는 불가 — API `requireAdmin`, 사이드바 `user?.role === 'admin'`
- DB: RLS on, 사용자 세션 정책 0개. 앱 DB 접근은 `createAdminSupabaseClient()`로만, 반드시 `requireAdmin` 통과 후
- 변이(POST/PATCH/DELETE)는 `withMutation(request)`(`lib/http/mutation-guard.ts`) 후 `requireAdmin(mutation.supabase, mutation.userId)`
- 응답은 `lib/api-helper.ts`의 `ok()`/`fail()`, 클라이언트는 `hooks/csrf-client.ts`의 `apiGet`/`apiMutate`
- 금액 = 반올림(사용량 × 단가) 원 단위, 직접 수정 시 `amount_overridden=true`이고 이후 덮어쓰지 않음, 음수 허용
- 월 형식 `'YYYY-MM'`, (item_id, month) 유일
- 간격은 gap/padding(margin 유틸 무효 — clio-tailwind 함정), 확인창은 `hooks/use-confirm-dialog.ts`, 금액 입력은 `monthly-expense-modal.tsx`의 쉼표 표시 방식
- 파일당 500줄 초과 시 prebuild 게이트가 빌드 차단 — 각 파일 300줄 미만 목표
- `.catch(() => {})` 금지 → `.then(() => {}, () => {})`
- 버전 v7.97.0, 커밋 메시지 한글

## Review Focus
1. 금액을 직접 고친 뒤 사용량·단가만 바꾸는 수정 → 금액 유지(덮어쓰기 금지) — Task 2 `resolveAmount` 테스트
2. 부동소수 곱 경계(예: 사용량 0.5 × 단가 5, 1.15 × 100, 음수 -2.5) → 기대 반올림값 — Task 2 `computeAmount` 테스트
3. 숫자 대신 `"1,234"`·`""`·`"abc"`·`Infinity`·`1e20`이 온 요청 → `"1,234"`는 1234, `""`는 null, 나머지는 400 — Task 2 검증 테스트
4. 1월 월별 화면의 전월 대비 → 전년 12월 값과 비교(같은 조회 응답에 포함) — Task 2 `buildMonthlyView` 테스트, Task 3 GET 범위
5. 숨긴 항목에 지난 기록이 있는 연도 → 연도별 표에 그대로 나옴, 새 입력 선택지에서는 빠짐, 서버도 거부 — Task 2 집계 테스트, Task 3 POST

---

### Task 1: 마이그레이션 056

**Files:**
- Create: `supabase/migrations/056_maintenance_fees.sql`

**Interfaces:**
- Produces: 테이블 `public.maintenance_fee_items`, `public.maintenance_fee_entries` (컬럼은 아래)

- [ ] **Step 1: SQL 작성** — 044 머리 주석 형식을 따른다.
  - `maintenance_fee_items`: id uuid pk default uuid_generate_v4(), name text not null check(char_length(btrim(name)) between 1 and 50), unit text null check(char_length(unit) <= 20), default_unit_price numeric(15,2) null, sort_order int not null default 0, is_active boolean not null default true, created_by uuid null references users(id) **on delete set null**, created_at/updated_at timestamptz default now()
  - 유일 인덱스 `uq_maintenance_fee_items_name` on (btrim(name))
  - `maintenance_fee_entries`: id, item_id uuid not null references maintenance_fee_items(id) **on delete restrict**, month text not null check(month ~ '^(20[0-9]{2})-(0[1-9]|1[0-2])$'), usage numeric(15,3) null, unit_price numeric(15,2) null, amount numeric(15,0) not null, amount_overridden boolean not null default false, memo text null check(char_length(memo) <= 200), created_by/updated_by uuid null references users(id) on delete set null, created_at/updated_at
  - unique(item_id, month), index(month)
  - 두 테이블 `handle_updated_at()` 트리거, `enable row level security`, **policy 생성 없음**(주석으로 "서버 service role 전용, 055 방식" 명시)
- [ ] **Step 2: 커밋** `git commit -m "feat(db): 관리비 테이블 056 마이그레이션"` — 운영 적용은 Task 6에서 대장이 실행

### Task 2: 순수 모듈 — 타입·계산·검증·변환

**Files:**
- Create: `src/lib/maintenance-fees/types.ts`, `calc.ts`, `validate.ts`, `map.ts`
- Test: `src/lib/maintenance-fees/calc.test.ts`, `src/lib/maintenance-fees/validate.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  - `FeeItem { id; name; unit: string|null; default_unit_price: number|null; sort_order: number; is_active: boolean }`
  - `FeeEntry { id; item_id; month: string; usage: number|null; unit_price: number|null; amount: number; amount_overridden: boolean; memo: string|null; updated_at: string }`
  - `FeeItemInput`, `FeeEntryCreateInput { item_id; month; usage; unit_price; amount: number|null; amount_overridden: boolean; memo }`, `FeeEntryUpdateInput`(item_id·month 제외)
  - `MonthlyRow { item: FeeItem; entry: FeeEntry; prevAmount: number|null; diff: number|null }`, `MonthlyView { rows: MonthlyRow[]; total: number; prevTotal: number|null }`
  - `YearlyRow { item: FeeItem; months: (number|null)[]; usageTotal: number|null; avgUnitPrice: number|null; amountTotal: number }`, `YearlyView { rows: YearlyRow[]; monthTotals: number[]; grandTotal: number }`
- Produces (`calc.ts`):
  - `computeAmount(usage: number|null, unitPrice: number|null): number|null`
  - `resolveAmount(i: { usage; unit_price; amount: number|null; amount_overridden: boolean }): { amount: number; amount_overridden: boolean } | { error: string }`
  - `prevMonth(month: string): string`
  - `buildMonthlyView(items: FeeItem[], entries: FeeEntry[], month: string): MonthlyView`
  - `buildYearlyView(items: FeeItem[], entries: FeeEntry[], year: number): YearlyView`
- Produces (`validate.ts`): `validateItemInput(body: unknown, mode: 'create'|'update')`, `validateEntryCreate(body: unknown)`, `validateEntryUpdate(body: unknown)`, `parseYear(v: string|null): number|null` — 반환 `{ ok: true; value } | { ok: false; error: string }`(bulk-transfer/validate.ts와 같은 Result 형)
- Produces (`map.ts`): `mapItem(row): FeeItem`, `mapEntry(row): FeeEntry` — numeric 문자열을 Number로

- [ ] **Step 1: 실패하는 테스트 작성** (`node:test`, `assert/strict`)

```ts
test('computeAmount 반올림·부동소수', () => {
  assert.equal(computeAmount(0.5, 5), 3);
  assert.equal(computeAmount(1.15, 100), 115);
  assert.equal(computeAmount(-2.5, 1), -3);
  assert.equal(computeAmount(null, 100), null);
  assert.equal(computeAmount(10, null), null);
});
test('resolveAmount — 자동/직접/사용량 없음', () => {
  assert.deepEqual(resolveAmount({ usage: 10, unit_price: 120.5, amount: null, amount_overridden: false }), { amount: 1205, amount_overridden: false });
  assert.deepEqual(resolveAmount({ usage: 10, unit_price: 120.5, amount: 1500, amount_overridden: true }), { amount: 1500, amount_overridden: true });
  assert.deepEqual(resolveAmount({ usage: null, unit_price: null, amount: 50000, amount_overridden: false }), { amount: 50000, amount_overridden: false });
  assert.ok('error' in resolveAmount({ usage: null, unit_price: null, amount: null, amount_overridden: false }));
  assert.ok('error' in resolveAmount({ usage: 1, unit_price: 1, amount: null, amount_overridden: true }));
});
test('prevMonth 연 경계', () => { assert.equal(prevMonth('2026-01'), '2025-12'); assert.equal(prevMonth('2026-11'), '2026-10'); });
test('buildMonthlyView 1월 전월=전년 12월, 합계', () => { /* 전기 2025-12=1000, 2026-01=1300 → rows[0].prevAmount 1000, diff 300, total 1300, prevTotal 1000 */ });
test('buildMonthlyView 전월 기록 없으면 prevAmount·diff null, prevTotal null', () => {});
test('buildYearlyView 숨긴 항목 기록 포함·빈 달 null·평균단가', () => {
  /* 전기(숨김) 1월 usage 100 amount 12000, 3월 usage 50 amount 6500, 일반관리비 1월 usage null amount 50000
     → 전기 months[0]=12000 months[1]=null usageTotal 150 avgUnitPrice 123.33(소수 둘째 반올림) amountTotal 18500
     → 일반관리비 usageTotal null avgUnitPrice null
     → monthTotals[0]=62000, grandTotal 68500 */
});
// validate.test.ts
test('숫자 필드: "1,234"→1234, ""→null, "abc"·Infinity·1e20 거부', () => {});
test('월 형식: "2026-13"·"2026-1"·"1999-01" 거부, "2026-01" 통과', () => {});
test('item_id UUID 아님 거부, memo 201자 거부, name 공백만 거부', () => {});
test('parseYear: "2026"→2026, "abc"·"1999"·null→null', () => {});
```

  `buildMonthlyView`의 rows는 해당 월 기록이 있는 항목만, 정렬 `sort_order` → `name`. `buildYearlyView`의 rows는 그 연도에 기록이 1건 이상인 항목만(숨김 여부 무관).
- [ ] **Step 2: 실행해 실패 확인** — `npm test` → 모듈 없음으로 FAIL
- [ ] **Step 3: 구현** — `computeAmount`는 부동소수 오차를 없앤 뒤 부호를 살려 반올림:

```ts
const raw = Number((usage * unitPrice).toFixed(6));
return Math.sign(raw) * Math.round(Math.abs(raw));
```

  `avgUnitPrice` = (사용량 있는 기록의 금액 합) ÷ (사용량 합), 사용량 합 0 또는 없으면 null, 소수 둘째 자리 반올림. 범위: usage 0 ≤ x ≤ 1e12, unit_price 0 ≤ x ≤ 1e10, amount 정수 |x| ≤ 1e13, default_unit_price 0 ≤ x ≤ 1e10, sort_order 정수 0~9999, 연도 2000~2100.
- [ ] **Step 4: 통과 확인** — `npm test` → PASS
- [ ] **Step 5: 커밋** `feat: 관리비 계산·검증 모듈`

### Task 3: API 라우트

**Files:**
- Create: `src/app/api/maintenance-fees/items/route.ts`(GET, POST), `items/[id]/route.ts`(PATCH, DELETE), `entries/route.ts`(GET, POST), `entries/[id]/route.ts`(PATCH, DELETE)

**Interfaces:**
- Consumes: Task 2 전부, `withAuth`, `withMutation`, `requireAdmin`, `createAdminSupabaseClient`, `ok`, `fail`
- Produces:
  - `GET /api/maintenance-fees/items` → `ok(FeeItem[])`(숨김 포함, 정렬 sort_order·name)
  - `GET /api/maintenance-fees/entries?year=YYYY` → `ok(FeeEntry[])`, 범위 `month >= '${year-1}-12' and month <= '${year}-12'`, year 없거나 잘못되면 400
  - POST/PATCH는 생성·수정된 객체, DELETE는 `ok({ id })`

- [ ] **Step 1: 공통 순서** — GET: `withAuth()` → `requireAdmin(supabase, userId)` → admin 클라이언트 조회. 변이: `withMutation(request)` → `requireAdmin(mutation.supabase, mutation.userId)` → JSON 파싱 실패 400 → validate 실패 400 → admin 클라이언트 쓰기. `[id]`는 UUID 아니면 400, 대상 없으면 404. DB 오류 메시지를 그대로 내보내지 않고 `fail('저장에 실패했습니다.', 500)` 등 고정 문구
- [ ] **Step 2: 항목 규칙** — 이름 중복(23505) → 409 '같은 이름의 항목이 있습니다.'; DELETE는 기록 수 `count` 조회 후 1건 이상이면 409 '기록이 있는 항목은 삭제할 수 없습니다. 숨기기를 사용해 주세요.'
- [ ] **Step 3: 기록 규칙** — POST: 항목 조회, 없거나 `is_active=false`면 400 '사용할 수 없는 항목입니다.'; `resolveAmount` error면 400; (item_id, month) 중복(23505) → 409 '이 달에 이미 입력된 항목입니다.'; created_by·updated_by = userId. PATCH: 기존 행과 입력을 합친 뒤 `resolveAmount` 재계산(직접 입력이면 금액 유지), updated_by = userId
- [ ] **Step 4: 확인** — `npx tsc --noEmit` 통과, `grep -L "requireAdmin" src/app/api/maintenance-fees -r` 출력 없음, `grep -L "withMutation"`로 변이 파일 4개 모두 포함 확인
- [ ] **Step 5: 커밋** `feat: 관리비 API(관리자 전용)`

### Task 4: hook

**Files:**
- Create: `src/hooks/use-maintenance-fees.ts`

**Interfaces:**
- Consumes: `apiGet`, `apiMutate`, Task 2 `buildMonthlyView`·`buildYearlyView`·타입
- Produces: `useMaintenanceFees(year: number)` → `{ items: FeeItem[]; entries: FeeEntry[]; loading: boolean; forbidden: boolean; error: string|null; reload(): Promise<void>; saveItem(input, id?): Promise<string|null>; deleteItem(id): Promise<string|null>; saveEntry(input, id?): Promise<string|null>; deleteEntry(id): Promise<string|null> }` — 반환 문자열은 오류 메시지(성공 null)

- [ ] **Step 1: 구현** — 연도 바뀌면 items·entries 각 1회 조회(중복 호출 금지, 언마운트 시 AbortController로 취소). 403이면 `forbidden=true`. 변이 성공 후 `reload()`. 응답 해제 방식은 `hooks/use-leave-requests.ts`와 같게
- [ ] **Step 2: 확인** `npx tsc --noEmit` 통과 후 커밋 `feat: 관리비 데이터 hook`

### Task 5: 화면·메뉴

**Files:**
- Create: `src/app/(app)/maintenance-fees/page.tsx`(bulk-transfer/page.tsx처럼 view만 렌더), `src/components/maintenance-fees/maintenance-fees-view.tsx`, `monthly-fee-table.tsx`, `yearly-fee-table.tsx`, `fee-entry-modal.tsx`, `fee-item-manager.tsx`
- Modify: `src/components/layout/sidebar.tsx`(ADMIN_ITEMS 아래), `package.json`(version 7.97.0)

**Interfaces:**
- Consumes: Task 4 `useMaintenanceFees`, Task 2 `buildMonthlyView`·`buildYearlyView`·`computeAmount`, `useConfirmDialog`

- [ ] **Step 1: view** — 탭 '월별'·'연도별', 상단 연·월 이동(◀ ▶). 월은 연도 상태에서 파생해 월을 넘겨 연도가 바뀌면 hook 연도도 바뀜. `forbidden`이면 '권한이 없습니다.' 안내만
- [ ] **Step 2: 월별 표** — 열: 항목 / 사용량(단위) / 단가 / 금액 / 전월 대비(+는 빨강·−는 파랑, 없으면 '—') / 메모. 직접 입력 금액엔 '직접 입력' 표시. 맨 아래 합계·전월 합계. 기록 없으면 '이 달에 입력된 관리비가 없습니다.' 줄 클릭 → 수정 모달. 숫자는 `toLocaleString('ko-KR')`
- [ ] **Step 3: 연도별 표** — 행: 항목, 열: 1~12월 금액 + 연간 사용량(단위) + 평균 단가 + 연 합계. 맨 아래 월별 총액·연 총액. 가로 스크롤 허용(`overflow-x-auto`), 숨긴 항목 이름 옆 '(숨김)'
- [ ] **Step 4: 입력 모달** — 항목 선택(활성 항목만) 시 단위 표시·단가에 기본 단가 채움. 사용량·단가 입력 시 금액 자동 계산, 사용자가 금액을 직접 바꾸면 `amount_overridden=true`와 계산값 차이 표시, '자동 계산으로 되돌리기' 버튼. 수정 모드는 항목·월 고정, 삭제 버튼(확인창). 서버 오류 문구 그대로 표시
- [ ] **Step 5: 항목 관리** — 모달 안 '항목 관리'에서 추가·수정(이름·단위·기본 단가·순서)·숨기기/보이기·삭제(409 문구 표시)
- [ ] **Step 6: 사이드바** — `MASTER_ADMIN_ITEMS = [{ key: 'maintenance-fees', label: '관리비', href: '/maintenance-fees', icon: Receipt, description: '관리비 월별 · 연도별' }]`, `{user?.role === 'admin' && MASTER_ADMIN_ITEMS.map(renderItem)}`를 관리자 메뉴 바로 아래에
- [ ] **Step 7: 확인** — `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`(줄 수 게이트 포함) 모두 통과, `wc -l` 신규 파일 전부 300줄 미만
- [ ] **Step 8: 커밋** `feat: 관리비 메뉴 — 월별·연도별 조회와 입력 (v7.97.0)`

### Task 6: 운영 적용·검증

- [ ] **Step 1: 독립 리뷰 에이전트 적대 검토**(백엔드·프론트 2개 병렬, "어떻게 깨지나" 관점) → 확인된 결함 수정·재검토
- [ ] **Step 2: 대장이 SQL Editor에서 056 실행** → service role로 `pg_policies`에 두 테이블 정책 0개 확인, 사용자 세션 토큰으로 REST 조회·삽입 거부(0행/401·403) 확인
- [ ] **Step 3: `deploy clio`**(클리오는 운영 직행이 표준 — 배포 전 대장 확인)
- [ ] **Step 4: 운영 실화면(admin 계정)** — 테스트 항목 추가 → 이번 달 입력(자동 계산) → 금액 직접 수정 → 사용량 바꿔도 금액 유지 → 연도별 표 반영 → 기록 삭제 → 항목 삭제. 테스트로 만든 것만 정리
- [ ] **Step 5: 차단 확인** — 관리자 아닌 계정(대장 확인 필요)에서 메뉴 없음, `/api/maintenance-fees/entries?year=2026` 403
