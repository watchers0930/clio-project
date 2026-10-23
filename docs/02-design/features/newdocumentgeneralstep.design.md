# 빌트인 양식 문서 입력값 편집 — 설계서 (공용 계약서)

- 작성일: 2026-10-23
- 프로젝트: CLIO (v7.82.0, Next.js 16.2.1)
- 상태: 설계 / 구현 전
- 기획서: `docs/01-plan/features/newdocumentgeneralstep.plan.md`
- 대상 양식: 휴가원 · 주간업무 · 재직증명서 · 업무일지
- 역할 표기: **[BE]** 백엔드(Codex) 담당 / **[FE]** 프론트엔드(Claude) 담당 / **[공용]** 양쪽이 동일 계약을 참조

> 이 문서는 BE·FE가 **각자 구현하면서 서로를 신뢰할 수 있도록** 데이터 형태·함수 시그니처·API 스펙·책임 경계를 고정하는 계약서다. 여기 적힌 타입·시그니처·반환 형태는 합의 없이 변경하지 않는다. 변경이 필요하면 이 문서를 먼저 고치고 양쪽에 공유한다.

---

## 0. 설계 요지 (한 문단)

문서 본문 맨 앞의 `<!--DOCUMENT_INPUTS:{...}-->` 주석을 **판별 가능한 타입으로 파싱**하는 순수 유틸을 만들고(`parseEmbeddedInputs` / `buildContentWithInputs`), 생성 폼의 입력 영역을 **생성·편집 공용 컴포넌트**(`DocumentInputFields`)로 추출한다. 뷰어에는 기존 `레이아웃 보기 / 원문 편집` 토글 옆에 `입력값 편집` 모드를 추가하고, 편집 결과는 **본문은 그대로 둔 채 주석의 JSON만 교체**해 `editContent`에 반영한다. 저장은 기존 `PATCH /api/documents/[id]`에 **`{ content }`만** 보낸다. 서버는 저장된 content가 유효한 대상 양식 입력값을 가지면 **Storage의 구 `.html`보다 최신 content 렌더를 우선**하도록 inline 경로를 보완하고, 미리보기 훅은 저장 성공 후 자동 재조회 + 실패 재시도 `refetch`를 제공한다. **신규 API·DB 컬럼·AI 재생성·본문 재작성은 없다.**

---

## 1. 아키텍처 및 컴포넌트 구조

### 1.1 레이어 분리 (플랫폼 5대 원칙 §2·§5 준수)

```
lib/documents/embedded-inputs.ts        [BE] 순수 파싱·교체 유틸 (React/네트워크 의존 금지)
lib/documents/resolve-input-form.ts     [BE] 양식 식별 + 필드 정의 복원 (순수)   ← 신규
lib/templates/builtin.ts                [BE] 빌트인 resolver (업무일지 보강)
lib/templates/worklog.ts                [BE] WORKLOG_FIELDS / HTML (재사용)
app/api/documents/[id]/route.ts         [BE] PATCH content 단독 저장 (기존 유지)
app/api/documents/[id]/download/route.ts[BE] inline 렌더 우선순위 보완
lib/documents/inline-render.ts          [BE] download route에서 추출한 렌더 유틸 ← 신규(500줄 분해용)

components/documents/document-input-fields.tsx    [FE] 생성·편집 공용 입력폼         ← 신규
components/documents/document-input-editor.tsx    [FE] 뷰어↔공용폼 연결 + 복원/오류 ← 신규
components/documents/use-document-input-autofill.ts [FE] 편집 자동채움 정책           ← 신규
components/documents/document-viewer-modal.tsx    [FE] `입력값 편집` 모드 추가
components/documents/use-document-viewer-actions.ts [FE] content 단독 저장 액션
components/documents/use-server-rendered-preview.ts [FE] refetch + 업무일지 판별 보완
components/documents/TemplateFieldInput.tsx       [FE] 재사용(변경 없음)
components/documents/WeeklyWorkRowsEditor.tsx     [FE] 재사용 + 편집모드 표시
components/documents/LeaveEmployeePicker.tsx      [FE] 재사용(선택 시에만 반영)
components/documents/EmploymentCertAutofill.tsx   [FE] 편집모드(저장값 표시) 지원
components/documents/new-document-general-step.tsx[FE] 공용폼 + 생성전용 설정 조합으로 리팩터
```

### 1.2 컴포넌트 책임 경계 (단일 책임)

| 단위 | 담당 | 책임 | **금지(제외) 책임** |
| --- | --- | --- | --- |
| `embedded-inputs.ts` | BE | 주석 파싱·교체·직렬화 왕복 | React 상태, fetch, 양식 렌더 |
| `resolve-input-form.ts` | BE | `DocumentItem` → 양식종류·필드정의·UI플래그 또는 차단사유 | 값 변형, DOM |
| `DocumentInputFields` | FE | 필드 그룹·조건부 노출·양식별 특수 UI 조합, `mode: 'create' \| 'edit'` 분기 | PATCH, 뷰어 상태, 생성 실행, 출력 포맷 |
| `DocumentInputEditor` | FE | 복원 결과/오류 표시, 공용폼을 뷰어에 연결, `editContent` 반영 | 전체 뷰어·다운로드 UI, 파싱 로직 |
| `use-document-input-autofill` | FE | 생성 초기값 + **명시적** 프로필 재적용 정책 | 마운트만으로 편집값 변경 |
| `use-document-viewer-actions` | FE | content 저장 / 저장 성공 후 상태 동기화 | 필드별 UI, 파싱 |
| `use-server-rendered-preview` | FE | 저장본 기준 서버 렌더 조회 + refetch | 입력폼, 저장 |
| download route / `inline-render` | BE | content·번들 기반 양식 HTML 렌더 | 폼 UI |

### 1.3 뷰어 모드 상태 모델 (현행 → 변경)

현행 `document-viewer-modal.tsx`는 `proposalViewMode: 'preview' | 'edit'` 2상태다. **3상태로 확장**한다.

```ts
// [FE] document-viewer-modal.tsx 내부 상태 (또는 editor로 위임)
type ViewerMode = 'preview' | 'edit' | 'inputs';
//  preview = 레이아웃 보기(서버 렌더 iframe)  — 기존
//  edit    = 원문 편집(주석 숨긴 textarea)    — 기존 유지
//  inputs  = 입력값 편집(공용 폼)             — 신규
```

- `입력값 편집` 버튼은 **대상 양식 + 초안 + 복원 성공**일 때만 활성. 비대상/파싱오류/식별불가 시 버튼 비활성 + 사유 툴팁.
- 모드 전환은 `editContent`를 공유 상태로 유지하므로 **전환만으로 값이 사라지지 않는다**(US-05).
- 기존 `preview`/`edit`/`isMarkdownTemplate` 분기와 `isProposal`·`isServerTemplate` 판별은 **그대로 보존**한다. `inputs` 모드는 `isBuiltinForm`(또는 업무일지 보강 판별)일 때만 토글 목록에 추가한다.

---

## 2. 데이터 모델

### 2.1 저장 구조 (DB 변경 없음)

`documents.content`(text) 1개 컬럼만 사용한다. 대상 문서의 content 형태:

```
<!--DOCUMENT_INPUTS:{"employee_name":"홍길동","purpose":"은행 제출용",...}-->\n
# 마크다운 본문 ...
```

- 주석은 **본문 맨 앞 1줄**, JSON은 1줄 가정(기존 `EMBEDDED_INPUTS_RE`와 일치).
- `template_id`는 빌트인 양식의 경우 FK 제약으로 **null 저장**된다. 식별은 제목/번들 resolver에 의존한다(§4).
- `__template_name` 등 서버 메타 키가 주석 JSON 안에 있을 수 있다 → **폼에 노출 안 돼도 보존**한다.

### 2.2 입력값 JSON 값 타입 계약 [공용]

- 모든 필드 값은 **문자열**이다(`Record<string, string>`). 숫자·불리언·배열·null은 **파싱 오류**로 취급.
- 특수 키:
  - `work_rows` (주간업무): **JSON 문자열**이다. 값 자체가 `"[{\"date\":\"10/21\",\"content\":\"...\",\"progress\":\"50%\",\"note\":\"\"}]"` 형태의 **이중 직렬화 문자열**. 배열 객체로 저장하지 않는다.
  - `next_week_plan` (주간업무): 문자열(textarea).
  - `nda_agree`(근로계약서, 이번 4양식 범위 밖): `'동의' | ''`.
  - checkbox 타입 값: 콤마 구분 문자열(`"A,B"`), `TemplateFieldInput` 기존 규약.
- `-->` 포함 값은 저장 시 `-->`로 이스케이프(§3.2). 파싱 시 원복.

### 2.3 WorkRow 타입 (기존 `WeeklyWorkRowsEditor` 재사용) [공용]

```ts
// components/documents/WeeklyWorkRowsEditor.tsx — 기존 export
export interface WorkRow { date: string; content: string; progress: string; note: string; }
// work_rows = JSON.stringify(WorkRow[])  (빈 행 제거는 에디터가 commit 시 수행)
```

### 2.4 필드 정의 타입 (기존 공용 정의 — 복제 금지) [공용]

```ts
// lib/templates/template-schema.ts — 단일 출처. TemplateFieldInput/페이지 타입도 동일 shape.
export interface TemplateFieldDefinition {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'date' | 'checkbox' | 'select';
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  autoFill?: 'user' | 'source' | 'document';
  aiAssist?: boolean;
  options?: string[];
  showWhen?: { field: string; equals?: string; notEquals?: string };
  format?: 'currency' | 'phone';
}
```

- 신규 컴포넌트/유틸은 **이 타입을 import**한다. `TemplateFieldInput` 내부의 `TemplateField` 인터페이스는 동일 shape이므로 새 중복 정의를 늘리지 않는다.

---

## 3. 공용 파싱·교체 유틸 계약 — `lib/documents/embedded-inputs.ts` [BE]

> 기존 `stripEmbeddedInputs` / `getEmbeddedInputsPrefix`의 DOCUMENT/PROPOSAL 호환은 **그대로 유지**하고 아래 두 함수를 **추가**한다. 선두 주석만 대상으로 하며, `PROPOSAL_INPUTS`와 본문 중간 유사 주석은 입력값으로 오인하지 않는다.

### 3.1 `parseEmbeddedInputs`

```ts
export type ParseEmbeddedInputsResult =
  | { ok: true; inputs: Record<string, string>; prefix: string } // prefix = 매칭된 주석+LF 원문
  | { ok: false; reason: 'no-comment' }        // 선두 DOCUMENT_INPUTS 주석 없음
  | { ok: false; reason: 'proposal' }          // 선두가 PROPOSAL_INPUTS (이번 편집 비대상)
  | { ok: false; reason: 'invalid-json' }      // 주석은 있으나 JSON.parse 실패
  | { ok: false; reason: 'invalid-shape' };    // 객체 아님 / 값에 비문자열 포함

export function parseEmbeddedInputs(content: string): ParseEmbeddedInputsResult;
```

**계약**
- **선두** `<!--DOCUMENT_INPUTS:...-->`만 파싱. `PROPOSAL_INPUTS`면 `{ ok:false, reason:'proposal' }`. 주석 없으면 `'no-comment'`.
- `JSON.parse` 성공해도 결과가 **plain object가 아니면**(배열/원시값/null) `'invalid-shape'`.
- 객체의 **어떤 값이라도 string이 아니면** `'invalid-shape'`. (숫자·불리언·배열·null·객체 모두 거부)
- **정상 빈 객체 `{}`는 `{ ok:true, inputs:{} }`** — 파싱 실패와 구분한다.
- 문자열 안의 한글·줄바꿈 escape(`\n`)·따옴표·역슬래시는 **왕복 보존**(JSON 표준 복원).
- `work_rows`는 **문자열 그대로** `inputs`에 담는다(여기서 내부 배열을 파싱하지 않음). 내부 검증은 FE 에디터/§6 책임.
- `prefix`는 교체 시 재사용할 수 있도록 **매칭된 원문 그대로**(주석 + 뒤따르는 선택적 `\n`) 반환.
- 주석 없는 과거 문서·손상 주석을 **빈 폼으로 간주하지 않는다**(호출부가 `ok:false`로 진입 차단).

### 3.2 `buildContentWithInputs`

```ts
export type BuildContentResult =
  | { ok: true; content: string; changed: boolean }
  | { ok: false; reason: 'no-comment' | 'proposal' | 'invalid-json' | 'invalid-shape' };

export function buildContentWithInputs(
  content: string,
  patch: Record<string, string>,   // 폼에서 바뀐/전체 값 (화면에 없는 키는 호출부가 포함시키지 않아도 됨)
): BuildContentResult;
```

**계약**
- 먼저 `parseEmbeddedInputs(content)`로 기존 inputs·prefix·본문을 확정한다. `ok:false`면 동일 reason으로 그대로 반환(임의 접두부 추가·형식 변환 금지).
- **병합 규칙**: `merged = { ...기존inputs, ...patch }`.
  - 화면에 없는 키(`__template_name` 등)는 `patch`에 없으므로 **그대로 유지**.
  - `patch`의 **빈 문자열**은 "명시적으로 지움"으로 저장(키 삭제가 아니라 `""` 저장).
- **본문 보존**: 교체 대상은 **선두 주석 1건의 범위만**. 주석 이후의 LF/CRLF·공백·마크다운·본문 내부 주석은 **원문 문자열 그대로** 이어 붙인다. `trim()`·광역 정규식 금지.
  - 결과 = `"<!--DOCUMENT_INPUTS:" + serialize(merged) + "-->" + (기존 prefix의 뒤 LF/CRLF) + 본문원문`.
- **직렬화**: `JSON.stringify(merged)` 후 `-->` → `-->` 치환(HTML 주석 조기 종료 방지). 파싱 시 `JSON.parse`가 원 문자열로 복원.
- **무변경 감지**: `serialize(merged)`가 기존 주석 JSON과 의미상 같으면 `changed:false`로 반환하고 `content`는 **원문 그대로**. 키 순서만 달라져도 본문은 변하면 안 된다. → 무변경 진입·모드 전환만으로 `isEdited`가 켜지지 않게 한다.

### 3.3 왕복 불변식 (BE 테스트 필수)

```
content' = buildContentWithInputs(content, parseEmbeddedInputs(content).inputs).content
assert content' === content     // 값 변경 없으면 완전 동일 (LF/CRLF·빈 본문·선행공백·본문내부주석·주석뒤 빈줄 포함)
```

---

## 4. 양식 식별 및 필드 정의 — `lib/documents/resolve-input-form.ts` [BE] (신규, 순수)

생성 폼은 `selectedTemplateItem.name`으로 `templateFields`·UI 플래그를 파생한다(`new-document-modal.tsx:148-157`, `worklog.ts`). 편집은 저장된 `DocumentItem`에서 **같은 정의를 복원**해야 한다. 이 복원을 순수 함수로 고정한다.

```ts
export type InputFormKind = 'leave' | 'weekly' | 'employment-cert' | 'worklog';

export interface ResolvedInputForm {
  kind: InputFormKind;
  templateName: string;                 // builtin 이름 (서버 렌더 식별과 일치)
  fields: TemplateFieldDefinition[];     // 공용 폼이 그릴 필드 정의
  ui: {                                  // 특수 UI 노출 플래그 (생성 폼과 동일 의미)
    leavePicker: boolean;
    certAutofill: boolean;
    weeklyRows: boolean;                 // work_rows + next_week_plan 에디터
  };
}

export type ResolveInputFormResult =
  | { ok: true; form: ResolvedInputForm }
  | { ok: false; reason: 'not-target' | 'ambiguous' | 'no-inputs' | 'parse-error' };

export function resolveDocumentInputForm(input: {
  title: string;
  templateId?: string | null;
  templateName?: string | null;   // 주석 내 __template_name 또는 GET 조인 template_name (보조)
  content: string;
}): ResolveInputFormResult;
```

**식별 우선순위 (계약)**
1. **templateId 우선**: 지원되는 빌트인 ID면 해당 정의. (`resolveBuiltinTemplate*`과 일치)
2. **이름 resolver**: `isLeaveApplicationTemplateName` / `isWeeklyReportTemplateName` / `isEmploymentCertificateTemplateName` / `isWorklogTemplateName`을 사용. `__template_name`이 있으면 보조로 검토하되 **모든 문서에 존재한다고 가정하지 않는다**.
3. **제목 fallback**: `BUILTIN_FORM_TITLE_RE`(+ 업무일지 패턴) — **현재 저장 구조의 호환 수단**. 제목 변경으로 식별 실패 가능한 한계를 `ambiguous`로 노출.
4. `parseEmbeddedInputs`가 `ok:false`면 `no-inputs`/`parse-error`로 차단.
5. **충돌 차단**: 커스텀 양식인데 제목만 "휴가원"인 경우 등 정의가 충돌하면 `ambiguous`로 **편집 차단**. 단지 DOCUMENT_INPUTS가 있다는 이유로 모든 문서에 폼을 열지 않는다.

**필드 정의 소스 (복제 금지)**
- 휴가원/주간업무/재직증명서: 각 `create*TemplateBundle().fields` 또는 `selectedTemplateItem.templateFields` 경로와 **동일 정의** 재사용.
- 업무일지: `WORKLOG_FIELDS`(worklog.ts) + 서버 렌더는 `WORKLOG_TEMPLATE_HTML`. **업무일지를 builtin 이름 resolver·서버/클라 판별 양쪽에 일치**시킨다(현재 `BUILTIN_FORM_TITLE_RE`·builtin resolver에 업무일지 누락 → §7 보완).

> `report_title`은 **양식 내부 입력값**이며 DB `title`과 구분한다. 이번 content 전용 저장은 DB 제목을 자동 변경하지 않는다.

---

## 5. API 스펙

> **신규 엔드포인트 없음.** 아래는 이 기능이 사용하는 기존 3개 엔드포인트의 계약과, 이번에 보완할 서버 동작이다.

### 5.1 `PATCH /api/documents/[id]` — 입력값(content) 단독 저장 [BE 기존 / FE 호출]

- **인증**: 필수. 세션(`createServerSupabaseClient`) + `withMutation`(CSRF/변이 가드). 권한: `canManageDocument`.
- **Request body** (입력값 저장 시 **content만**):
  ```json
  { "content": "<!--DOCUMENT_INPUTS:{...}-->\n# 본문..." }
  ```
  - ⚠️ 입력값 저장에서는 `title` / `status` / `templateId` / 출력포맷을 **포함하지 않는다**. (제목은 기존 저장 흐름으로 별도 처리)
  - `updates`는 전달된 키만 반영(`route.ts:339-342`). content만 보내면 content만 갱신.
- **Response (성공)** `200`:
  ```json
  { "success": true, "data": { "id": "...", "content": "...", "title": "...", "status": "...", ... } }
  ```
  - `data`는 `documents` 전체 row(`.select().single()`). FE는 **응답의 `data.content`를 진실원본**으로 `viewDoc`·목록·편집기준을 동기화.
- **Response (실패)**:
  | 상태 | 조건 | body |
  | --- | --- | --- |
  | 401 | 미인증 | `{ success:false, error:'인증이 필요합니다.' }` |
  | 403 | 권한 없음 | `{ success:false, error:'문서 수정 권한이 없습니다.' }` |
  | 400 | 변경 키 0개 | `{ success:false, error:'수정할 내용이 없습니다.' }` |
  | 500 | DB 오류 | `{ success:false, error:'문서 수정에 실패했습니다.' }` |
  | 503 | DB 미설정 | `{ success:false, error:'DB 미설정' }` |
- **부수효과(기존 유지)**: `audit_logs`(`document.edit`) 기록, content 변경 시 `embedDocument` fire-and-forget 재임베딩. **Storage 파일 재생성·휴가 원장 동기화는 하지 않음**(범위 밖, 화면 안내로 명시).

### 5.2 `GET /api/documents/[id]/download` — 서버 양식 렌더(inline 미리보기) [BE 보완 / FE 호출]

- **인증**: 필수. 세션 + `canAccessDocument`(주간업무는 대표/관리자 전사 열람 허용 분기 유지, `route.ts:275`).
- **Query params**:
  | 파라미터 | 값 | 의미 |
  | --- | --- | --- |
  | `format` | `pdf` | inline 미리보기는 `pdf` 고정 사용 |
  | `inline` | `true` | 미리보기용 HTML 반환(서명/직인 제외, 이름은 포함) |
  | `font` | 폰트명 | 렌더 폰트 |
- 미리보기 호출 예: `/api/documents/[id]/download?format=pdf&inline=true&font=<폰트>`
- **Response (성공)** `200`: `Content-Type: text/html; charset=utf-8`, `Content-Disposition: inline`. 본문 = 서버 렌더된 양식 HTML(iframe에 주입).
- **Response (실패)**: `401/403` JSON, 또는 렌더 불가 시 안내 HTML(현행 유지). FE 훅은 `!res.ok`를 `error`로 처리.
- **⚠️ 이번 보완(계약 변경점)** — `inline === true`일 때:
  1. **최신 content 우선 렌더**: 대상 양식(§4로 식별)이고 선두 DOCUMENT_INPUTS가 **유효**하면, Storage의 기존 `.html`(`route.ts:436-447`)보다 **content 기반 서버 렌더를 우선**한다. 입력값 PATCH 후 미리보기가 즉시 최신값을 보이게 하기 위함.
     - 적용 범위는 **inline 레이아웃 미리보기 한정**. 원본 파일 다운로드(`inline=false`)·DOCX/HWPX 재생성은 **범위 밖**(후속 과제, 화면 안내).
     - 비대상/주석 무효 문서는 **현행 Storage HTML 경로를 그대로** 유지(회귀 금지).
  2. **업무일지 포함**: inline 판별·번들 복원에 업무일지(`WORKLOG_FIELDS`/`WORKLOG_TEMPLATE_HTML`)를 포함. 현재 `resolveBuiltinTemplateBundleByName`·`BUILTIN_FORM_TITLE_RE`에 업무일지 누락 → 추가.
  3. **결재 서명·로고·직인 주입 로직은 유지**(`applyApprovalSignatures` 등, `route.ts:488`).
- **500줄 분해**: download route가 707줄이므로, 위 inline 렌더 로직을 `lib/documents/inline-render.ts`로 **추출**해 route를 제한 내로 줄인다. 무관한 로직 정리는 범위 밖.

### 5.3 `GET /api/users/profile` — 명시적 프로필 재적용용 [BE 기존 / FE 호출]

- **인증**: 필수(세션). 로그인 사용자 본인 프로필 반환.
- **Response (성공)** `200`: `{ success:true, data: UserProfile }` (이름·소속·직급·입사일·연락처 등). `EmploymentCertAutofill`·`use-document-user-autofill`가 사용.
- **편집 모드 계약**: 이 조회는 **마운트만으로 편집값을 덮지 않는다**. 저장값 표시 + **사용자가 "현재 프로필 반영" 버튼을 누를 때만** 폼 값에 적용(§6, US-03/US-07).

---

## 6. 구현 순서 (백엔드 → UI)

> 기획서 §6 우선순위(P0 1~6)를 따른다. BE 산출물이 FE 계약의 선행조건이므로 BE 먼저, 단 공용 타입(§2~§5)은 본 문서로 이미 고정되어 병렬 착수 가능.

### Phase 1 — [BE] 파싱·교체 유틸 + 데이터 계약 확정 (P0-1)
1. `embedded-inputs.ts`에 `parseEmbeddedInputs` / `buildContentWithInputs` 추가(§3). 기존 2함수·정규식 호환 유지.
2. 왕복 불변식(§3.3)·손상 데이터 차단·미노출 키 보존·`-->` 이스케이프 BE 자체 검증.
- **완료 기준**: §3 계약 전부 충족, 왕복 테스트 통과(합성 아닌 **실제 저장 문서 content 샘플**로 손 검증).

### Phase 2 — [BE] 양식 식별·필드 정의 통일 (P0-3)
1. `resolve-input-form.ts` 작성(§4). 업무일지를 builtin resolver/이름·제목 판별에 추가.
2. `builtin.ts`·`worklog.ts` 보강(업무일지 번들/이름 fallback).
- **완료 기준**: 4양식 식별 성공, 비대상·충돌 문서 `ambiguous`로 차단.

### Phase 3 — [BE] 서버 최신 렌더 + 미리보기 경로 보완 (P0-5 서버측)
1. download route inline 로직을 `inline-render.ts`로 추출, **최신 content 우선** + **업무일지** 반영(§5.2).
2. route 500줄 이하 확인.
- **완료 기준(⚠️ 운영 검증 필수)**: **기존 `.html` Storage 저장 문서**(로컬엔 없을 수 있음)에서도 최신 입력값이 inline에 반영되는지 **운영/실데이터로 확인**. 로컬 통과만으로 완료 선언 금지(규칙 0-1).

### Phase 4 — [FE] 공용 입력폼 추출 + 자동채움 정책 분리 (P0-2)
1. `new-document-general-step.tsx`의 입력 영역(자동입력/수동필드/특수UI)을 `DocumentInputFields`로 추출. `mode: 'create' | 'edit'` prop 추가.
2. `useDocumentUserAutofill` 기반 `use-document-input-autofill` 분리:
   - **create**: 기존 동작 유지(빈 필드 프리필, 주간 보고기간 이번주, 재직증명서 자동입력).
   - **edit**: 마운트 자동 프리필 **금지**. 저장값 우선. 프로필 재적용은 **버튼 동작으로만**.
3. 특수 UI 계약 유지:
   - `TemplateFieldInput`: `onChange: (updater:(prev:Record<string,string>)=>Record<string,string>)=>void` — 함수형 갱신(변경 없음).
   - `WeeklyWorkRowsEditor`: `value:string(work_rows JSON)`, `onChange:(json:string)=>void`. **마지막 입력 행 유실 방지**(US-02).
   - `LeaveEmployeePicker`: `onSelect`시에만 관련 필드 반영(이름만으로 직원 ID 추론 금지).
   - `EmploymentCertAutofill`: `onLoaded`를 edit 모드에서 **자동 적용하지 않고** "현재 프로필 반영" 액션에만 연결.
- **완료 기준**: 생성/편집 동일 UI, **편집 진입이 저장값을 바꾸지 않음**, 기존 생성 회귀 없음(회의록·근로계약서 포함).

### Phase 5 — [FE] 뷰어 `입력값 편집` 모드 + content 단독 저장 (P0-4)
1. `document-viewer-modal.tsx`에 `inputs` 모드 토글 추가(§1.3). 대상·초안·복원성공 조건에서만 활성.
2. `DocumentInputEditor`: `resolveDocumentInputForm`(BE 유틸, 클라에서 import 가능한 순수함수) + `parseEmbeddedInputs`로 폼 값 복원. 필드 변경 → `buildContentWithInputs(editContent, patch)` → `onChangeContent(result.content)`.
3. `use-document-viewer-actions.ts`에 **content 전용 저장 액션** 추가(기존 `handleSave`는 유지):
   - body `{ content }`만. 제목은 포함 안 함(미저장 상태 유지).
   - 성공 응답 `data.content`로 `viewDoc`/`docs`/`editContent` 동기화.
   - **경합 방지**: 저장 중 입력 잠금 또는 요청 스냅샷 — 문서 A 응답이 B를 덮지 않도록(`viewDoc.id` 확인 후 반영).
- **완료 기준**: 기존 원문편집 유지, PATCH body `content`만, 실패 시 값 유지·재시도 가능.

### Phase 6 — [FE] 미리보기 재조회 + 검증·오류·안내·회귀 (P0-5 클라 / P0-6)
1. `use-server-rendered-preview.ts`:
   - 기존 `[enabled, docId, font, content]` 의존 재조회 유지(저장으로 `viewDoc.content` 변경 시 자동 GET).
   - **명시적 `refetch()` 추가**(미리보기 실패 재시도용). 자동 재조회와 **중복 호출 방지**.
   - 업무일지가 `enabled` 판별에 포함되도록 `BUILTIN_FORM_TITLE_RE`(또는 업무일지 전용 분기) 보완.
2. 검증/오류 UX:
   - 필수값·`showWhen` 검증을 생성/편집 공유. 검증 실패·저장 중엔 저장 버튼 비활성.
   - 저장 성공 / **미리보기만 실패** 구분: "입력값은 저장되었지만 미리보기를 불러오지 못했습니다" + `refetch` 버튼.
   - 손상 `work_rows`를 **빈 배열로 덮어쓰지 않음**.
3. 범위 안내(화면 고정 문구):
   - "입력값은 초안 저장 후 레이아웃에 반영됩니다"(레이아웃 보기 이동 시).
   - "문서 입력값만 변경됩니다. 연결된 휴가 신청은 휴가 관리에서 수정하세요".
   - "원본 파일 다운로드 최신화는 후속 범위"(해당 시).
4. 미저장 닫기 확인·모드전환 값 유지·다른 문서 전환 시 상태 초기화(US-05).
- **완료 기준**: 4양식 모두 **복원 → 변경 → content 단독 저장 → 최신 서버 레이아웃 확인 → 재열기 복원** 성립. 업무일지·Storage HTML 문서에서 실패 시 **P0 미완료**.

---

## 7. 절대규칙 준수 체크리스트 (구현 시 양쪽이 지킬 계약)

### 7.1 플랫폼 5대 원칙
| 원칙 | 계약 |
| --- | --- |
| **1. 500줄 제한** | 신규/수정 파일 모두 ≤500줄. download route는 `inline-render.ts` 추출로 제한 내 복귀. `DocumentInputFields`가 커지면 양식별 하위 컴포넌트로 분리. 작성 후 **줄 수 확인 필수**. |
| **2. 단일 책임** | §1.2 경계 준수. 파싱(util)·식별(util)·폼(UI)·자동채움(hook)·저장(hook)·렌더(route/util) 분리. UI에 파싱/네트워크 혼재 금지. |
| **3. 서버 검증·보안** | PATCH는 기존 인증·`withMutation`·`canManageDocument` 유지. 입력값은 **클라 검증 + 서버는 content를 그대로 저장하되** JSON은 본문 임베드 메타이므로 XSS 경로 점검(렌더 시 HTML 주석/이스케이프). 비밀키·토큰 코드/로그 금지. |
| **4. 성능** | 미리보기 **타이핑 중 호출 금지**(저장 성공 시에만). 자동 재조회·`refetch` 중복 방지. 기존 `AbortController` 유지. work_rows 등 반복 파싱 최소화. |
| **5. 폴더 분리** | util→`lib/documents`, 양식정의→`lib/templates`, UI→`components/documents`, hook→`components/documents/use-*`, API→`app/api`. §1.1 배치 준수. |

### 7.2 규칙 0-5 견고성 4문 (구현 전 자문 + 구현 후 적대적 리뷰)
1. **규모**: work_rows 다량 행·장문 content에서 파싱/직렬화/미리보기 반복 비용. 미리보기 디바운스/저장시점 한정으로 상한.
2. **수명주기**: 이번 기능은 생성 삭제 경로 없음. 단 **Storage 구 `.html`과 content 불일치**(고아 양식)가 inline 우선 렌더로 가려질 수 있음 → 원본 다운로드는 최신화 안 됨을 **명시 안내**(은폐 금지).
3. **비정상 경로**: 손상 주석·PROPOSAL 주석·비대상 문서 **진입 차단**. 저장 경합(문서 A→B 덮어쓰기) 방지. 미리보기 실패 vs 저장 실패 구분. 제목 변경으로 식별 실패하는 기존 한계 노출(`ambiguous`).
4. **적대적 자문**: 보안·데이터 보존이 걸린 `embedded-inputs.ts`와 download route 변경은 **병렬 코드리뷰 필수**(`/code-review`). 특히 §3.3 왕복 불변식과 §5.2 Storage 우선순위 회귀.

### 7.3 Next.js 16 경계
- 순수 유틸(`embedded-inputs.ts`, `resolve-input-form.ts`, `inline-render.ts`)에 `'use client'`·클라이언트 의존 금지. 클라이언트 경계는 `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md` 기준.

---

## 8. 미결·후속 (P2, 이번 범위 밖)
- 원본 파일(DOCX/HWPX 등) Storage 재생성으로 입력값 최신화.
- 연결 휴가 원장·잔여일수 동기화.
- 상세 페이지(`document-viewer-page-sections.tsx`) 입력값 편집 확장(공유 훅 회귀만 확인).
- 품의서·근로계약서·제안서 등 양식 확장, 영속적 양식 식별 계약(제목 의존 탈피).
</content>
</invoke>
