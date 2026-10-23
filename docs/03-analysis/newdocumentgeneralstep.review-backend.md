# 백엔드 교차검수 — 빌트인 양식 입력값 편집 (Codex 구현분)

- 검수일: 2026-10-23
- 검수자: 크로미(Claude) — Codex 백엔드 구현분 교차검수
- 대상 설계서: `docs/02-design/features/newdocumentgeneralstep.design.md`
- 검토 범위(백엔드): `app/api/`, `lib/`, `schemas/` 의 미커밋 변경분
- 검토 관점: 보안(인증·CSRF·입력검증·SQLi/XSS)·버그·성능(N+1·중복호출)·설계 스펙 일치

## 검토한 파일

| 파일 | 상태 | 비고 |
| --- | --- | --- |
| `src/lib/documents/embedded-inputs.ts` | 수정 | `parseEmbeddedInputs`/`buildContentWithInputs` 추가 |
| `src/lib/documents/resolve-input-form.ts` | 신규 | 양식 식별 순수함수 |
| `src/lib/documents/inline-render.ts` | 신규 | download route에서 추출 + 최신 content 렌더 |
| `src/schemas/document-update.ts` | 신규 | PATCH 입력 검증 |
| `src/app/api/documents/[id]/route.ts` | 수정 | PATCH 검증·503 매핑 |
| `src/app/api/documents/[id]/download/route.ts` | 수정 | inline 최신 렌더 우선 + 500줄 분해 |
| `src/lib/renderers/pdf-renderer.ts` | 수정 | escapeHtml 강화·htmlKeys 화이트리스트 |
| `src/lib/renderers/template-render-data.ts` | 수정 | work_rows 행 shape 필터·값 반영 규칙 |
| `src/lib/templates/builtin.ts` / `worklog.ts` | 수정 | 업무일지 빌트인 번들/ID 추가 |
| `src/lib/documents/*.test.ts` (3종) | 신규 | 계약/왕복/렌더 테스트 |

---

## 총평

전반적으로 **설계서 계약에 충실하고 품질이 높은** 구현이다. 특히 보안 측면에서 긍정적:
- `escapeHtml`에 `"`/`'` 추가(속성 인젝션 방지), `work_rows` 행 shape 필터링 + 셀 이스케이프, `_src` 값은 data-URL 화이트리스트 외 차단(javascript: 등 XSS 차단).
- HTML 주석 조기 종료(`-->`) 이스케이프 + `JSON.parse` 왕복 복원, prototype 오염 가드(`isStringRecord`).
- PATCH의 기존 인증(`withMutation`·`canManageDocument`)·CSRF 가드 **보존**, mass-assignment 방지(content/title/status만 반영).
- download inline 경로의 접근권한(`canAccessDocument`/결재자/전사 주간업무 열람자) 게이팅 **유지**.
- 왕복 불변식(§3.3)을 여러 suffix 케이스(`\n`/`\r\n`/본문내부주석/선행공백)로 수기 추적 → 바이트 동일성 성립 확인.

치명(HIGH) 결함은 발견하지 못했다. 다만 **커스텀 템플릿 이름 충돌 회귀(MED)** 1건과 운영 검증 필수 항목, 검증 인프라 한계가 있다.

---

## 지적 사항

### [MED] 빌트인과 동일 이름의 커스텀 템플릿이 inline 미리보기에서 빌트인 레이아웃으로 덮어써짐
- 위치: `src/app/api/documents/[id]/download/route.ts:170, 208-214` + `src/lib/documents/resolve-input-form.ts:44-54`
- 문제: download route는 **커스텀(DB) 템플릿**일 때만 `storedTemplateName = templateData.name`을 채우고(:170), 이를 `renderLatestInputForm({ templateName: storedTemplateName })`로 전달한다(:210). `resolveDocumentInputForm`은 `templateName`이 주어지면 `resolveBuiltinTemplateBundleByName(templateName)`으로 후보를 만든다(:44). 그런데 커스텀 템플릿 회귀 차단 가드(:49 `if (!byId && input.templateId && !input.templateName)`)는 **`templateName`이 없을 때만** 동작하므로, "이름이 `주간업무`/`휴가원` 등 빌트인 이름 regex에 걸리는 커스텀 템플릿"이고 그 문서가 선두 `DOCUMENT_INPUTS`(문자열 값)를 가지면 → `ok: weekly` 등으로 판정되어 **커스텀 템플릿 고유 레이아웃 대신 빌트인 레이아웃으로 렌더**된다.
- 영향: 설계 §5.2.1 "비대상/주석 무효 문서는 현행 Storage HTML 경로를 그대로 유지(**회귀 금지**)" 위반. 비대상(커스텀 양식) 문서인데 inline 미리보기가 다른 양식으로 보일 수 있음. (실제 발생 조건: 이름 충돌 + 유효 `DOCUMENT_INPUTS` 동시 성립 → 발생 빈도는 낮으나 발생 시 조용히 잘못 렌더)
- 수정 제안(택1):
  1. download route에서 **빌트인이 아닌 실제 DB 템플릿(`doc.template_id` 존재 && `resolveBuiltinTemplateBundle(doc.template_id) === null`)** 이면 `renderLatestInputForm` 자체를 건너뛴다(커스텀 템플릿은 이번 기능 비대상이므로 기존 Storage 경로 유지).
  2. 또는 `resolveDocumentInputForm`에 "실제 커스텀 template_id 존재" 신호를 넘겨, `templateName` 유무와 무관하게 커스텀 template_id면 `not-target`/`ambiguous`로 차단.
- 확인 요청: `isWeeklyReportTemplateName` 등 이름 resolver가 부분일치(예: "주간"만 포함해도 매치)인지 확인 필요 — regex가 느슨할수록 이 충돌 확률이 올라간다.

### [LOW] PATCH 503 재매핑에서 비-JSON 본문 시 미처리 예외 가능
- 위치: `src/app/api/documents/[id]/route.ts:313-318`
- 문제: `mutation.error`가 503일 때 `await mutation.error.clone().json()`을 호출하는데, 이 블록은 **메인 `try` 바깥**이다. `withMutation`의 503 응답 본문이 JSON이 아닐 경우 `.json()`이 throw → Next 기본 500으로 샘(설계상 503 기대값과 불일치).
- 현재 위험도: `withMutation`이 항상 JSON 503을 반환한다면 실무 영향 없음(테스트도 JSON 가정). 방어적 처리만 권장.
- 수정 제안: `try/catch`로 감싸 파싱 실패 시 원본 `mutation.error`를 그대로 반환.

### [LOW] `validateDocumentUpdate`의 status 화이트리스트 하드코딩 — 현재는 안전, 유지보수 리스크
- 위치: `src/schemas/document-update.ts:19`
- 검증 결과: 화이트리스트 `['draft','completed','in_approval','approved','rejected']`는 실제 documents 테이블이 갖는 값(코드 전수 grep)과 일치. 이 PATCH로 클라가 보내는 값은 `use-document-viewer-actions.ts`의 `completed`/`draft`뿐이고, `in_approval`/`approved`/`rejected`는 결재 라우트가 **admin으로 직접** 전이(이 엔드포인트 미경유)하므로 **현재 회귀 없음**.
- 리스크: 추후 문서 상태값이 추가/변경되면 이 하드코딩이 조용히 400을 유발할 수 있음. DB enum/공용 상수와 단일 출처로 묶기를 권장.

### [LOW] 신규 테스트가 빌드/CI에 연결되어 있지 않고 로컬에서 실행 불가 — 초록불 검증 불가
- 위치: `src/lib/documents/api-contract.test.ts`, `embedded-inputs.test.ts`, `inline-render.test.ts`
- 문제: `package.json`에 `test` 스크립트가 없고 `vitest`/`jest`/`tsx`/`ts-node` 의존성이 없음. `node --test`도 TS/`@/` alias/`next/server` 해석 불가로 실행 실패 확인(tsx 미설치). 즉 이 테스트들은 `build`/CI에서 **실행되지 않으며**, 본 검수 환경에서도 **green을 재현 검증할 수 없었다.**
- 보강: 기존 `src/lib/attendance/*.test.ts`도 동일 패턴(미연결)이라 신규 결함은 아님. 다만 "검증기 자체도 검증" 원칙상 테스트가 실제로 도는 러너(tsx+node:test 또는 vitest) 연결을 권장. (테스트 품질 자체는 매우 양호 — 왕복/손상데이터/XSS/권한/Storage 우선순위를 폭넓게 커버)
- 참고(수기 검증): 실행 불가 대신 핵심 케이스를 손으로 추적함 — 왕복 불변식, `{\n}` → invalid-json, `-->` 이스케이프 왕복, prototype 가드, prefix 경계 slice 동일성 모두 정상.

### [LOW] 운영 검증 필수(규칙 0-1) — 로컬/합성 통과로 완료 선언 금지
- 설계 §5.2 Phase 3 완료기준도 "운영/실데이터 확인 필수"로 명시.
- 확인 요청 항목(운영 실화면):
  1. **기존 Storage `.html` 저장 문서**(로컬엔 없을 수 있음)에서 입력값 PATCH 후 inline 미리보기가 **최신값**을 즉시 반영하는가.
  2. **서술형 추가 섹션이 있는 주간업무/휴가원**이 content 기반 렌더로 전환될 때 기존 Storage `.html` 대비 **누락되는 본문이 없는가**(target 양식은 템플릿 렌더라 원칙상 무손실이나 실화면 확인 권장).
  3. 과거(입력값 임베드 이전) 생성 문서는 `no-comment`로 기존 경로 유지되는지(수기 분석상 안전하나 실문서로 확인).

---

## 설계 스펙 일치 여부 (`newdocumentgeneralstep.design.md`)

| 설계 조항 | 구현 | 일치 |
| --- | --- | --- |
| §3.1 `parseEmbeddedInputs` 판별 reason·빈객체 구분·work_rows 문자열 보존 | 구현 일치(선두 PROPOSAL/DOCUMENT 판별, invalid-shape 비문자열 거부, `{}`→ok) | ✅ |
| §3.2 `buildContentWithInputs` 병합·본문보존·`-->`이스케이프·무변경 감지 | 구현 일치(의미기반 무변경 → changed:false, byte 동일) | ✅ |
| §3.3 왕복 불변식 | 수기 다중 케이스 추적 통과 | ✅ |
| §4 `resolveDocumentInputForm` 식별 우선순위·충돌 차단 | 대체로 일치하나 **커스텀 template_id + 이름충돌 가드 우회**(위 MED) | ⚠️ |
| §5.1 PATCH content 단독 저장·에러 코드(400/401/403/500/503·DB 미설정) | 구현 일치(validator·503 매핑) | ✅ |
| §5.2 inline 최신 content 우선·업무일지 포함·서명/직인 제외·결재서명 유지·500줄 분해 | 구현 일치(inline-render 추출, 업무일지 번들/resolver 추가, 서명 inline 제외) | ✅ |
| §7.1 500줄/단일책임/폴더 분리 | download route 분해로 복귀, util은 lib/documents | ✅ |

---

## 성능 점검
- N+1/중복 쿼리: inline 경로가 추가한 DB 호출은 `applyApprovalSignatures`(기존 유지)뿐이며 `renderLatestInputForm`은 **순수**(번들 복원·파싱, DB 無). inline에서는 서명/직인 blob 다운로드를 **생략**해 오히려 I/O 감소. 신규 N+1 없음. ✅
- `loadCompanyLogoContext`는 inline/비대상 무관하게 항상 호출(기존 동일) — 경미, 범위 밖.

---

## 플랫폼 개발 원칙 점검

```
─────────────────────────────────────────────────
📋 플랫폼 개발 원칙 점검 (백엔드 변경분 기준)
─────────────────────────────────────────────────
1. 페이지 500줄 제한   : ✅ download route 분해(inline-render.ts 추출), 신규 util 모두 ≤500줄
2. 단일 책임           : ✅ 파싱(embedded-inputs)·식별(resolve-input-form)·렌더(inline-render)·검증(schemas) 분리
3. 서버 검증·보안      : ✅ PATCH 입력검증 추가, XSS 이스케이프 강화, 인증·CSRF·권한 보존 / ⚠️ 커스텀 이름충돌 식별(MED)
4. 성능 (중복·N+1)     : ✅ 신규 N+1 없음, inline은 I/O 감소
5. 폴더 구조           : ✅ lib/documents·lib/renderers·schemas·app/api 역할 일치
─────────────────────────────────────────────────
위반 항목: MED 1건(식별 회귀) + LOW 4건(503 예외·status 상수·테스트 미연결·운영검증). 코드 자체 구조위반 없음.
─────────────────────────────────────────────────
```

## 권고 (우선순위)
1. **[MED] 커스텀 템플릿 이름 충돌 회귀 차단** — download route에서 실제 커스텀 template_id면 `renderLatestInputForm` 스킵(가장 안전) + 이름 resolver 느슨함 점검.
2. **[운영] 규칙 0-1 운영 검증** — 기존 Storage `.html` 문서·서술형 섹션 포함 문서로 실화면 확인 후에만 완료 선언.
3. **[LOW] 503 파싱 예외 방어**, **status 상수 단일출처화**, **테스트 러너 연결**.

> 본 검수는 코드 수정 없이 리뷰만 수행했다. 테스트는 환경 제약으로 실행 재현을 하지 못해 핵심 로직을 수기 추적으로 검증했음을 밝힌다(초록불 미신뢰 원칙).
