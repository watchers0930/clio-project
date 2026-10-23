# 빌트인 양식 입력값 편집 — 설계·구현 갭 분석 (교차수정 반영 후)

- 분석일: 2026-10-23
- 분석자: 크로미(Claude)
- 기준 설계서: `docs/02-design/features/newdocumentgeneralstep.design.md`
- 교차검수 문서: `newdocumentgeneralstep.review-backend.md`(Codex분 검수) / `newdocumentgeneralstep.review-frontend.md`(프론트 검수)
- 대상: 미커밋 작업 트리의 백엔드·프론트 구현분(교차수정 반영 후)
- 분석 방법: 설계서 계약 → 실제 코드 직접 대조(반증 관점). 줄 수 `wc -l` 실측, 리뷰 지적별 해소 여부를 코드 라인으로 손 추적. **런타임/운영 실화면 검증은 수행하지 않음**(정적 분석 한계 — §5 참조).

---

## 0. 요약

- **Match Rate: 약 95%** — 설계서 §3~§7 계약을 사실상 전부 구현했고, 일부는 설계보다 개선(검증 스키마·프로필 공용 캐시·footer 분리 신설).
- **교차검수 지적: HIGH 2건 전부 해소, MED 5건 중 4건 해소·1건 부분 해소, 백엔드 MED 1건 해소.** LOW 4~5건은 대부분 미해소(경미).
- **남은 핵심 리스크 1건(규칙 0-1):** 운영 실화면 검증(기존 Storage `.html` 문서·서술형 섹션·과거 no-comment 문서) 미수행 → 설계 Phase 3/6 완료기준상 **아직 "완료" 선언 불가**.
- **검증 인프라 공백:** 신규 테스트 3종이 존재하나 러너(vitest/jest/tsx)·`test` 스크립트가 없어 **빌드/CI에서 실행되지 않음**(초록불 검증 불가 — 검증기 자체 신뢰 불가).

---

## 1. Match Rate (일치율): 약 95%

### 1.1 설계 산출물(§1.1 파일 배치) 이행

| 설계 파일 | 구현 | 상태 |
| --- | --- | --- |
| `lib/documents/embedded-inputs.ts` (parse/build 추가) | 65줄, §3 계약 전부 구현 | ✅ |
| `lib/documents/resolve-input-form.ts` (신규) | 73줄, §4 식별 우선순위 + 충돌 차단 | ✅ |
| `lib/documents/inline-render.ts` (신규, 추출) | 275줄, 최신 content 우선 렌더 | ✅ |
| `lib/templates/builtin.ts` / `worklog.ts` (업무일지 보강) | 업무일지 번들/ID/이름 resolver 추가 | ✅ |
| `app/api/documents/[id]/route.ts` (PATCH content) | content 단독 저장 + 검증 스키마 | ✅(개선) |
| `app/api/documents/[id]/download/route.ts` (inline 우선) | 494줄(707→분해), inline 최신 렌더 우선 | ✅ |
| `components/documents/document-input-fields.tsx` (신규) | 245줄, create/edit 공용 폼 | ✅ |
| `components/documents/document-input-editor.tsx` (신규) | 186줄, 복원/오류/검증 | ✅ |
| `components/documents/use-document-input-autofill.ts` (신규) | 90줄, create/edit 정책 분리 | ✅ |
| `document-viewer-modal.tsx` (inputs 모드) | 397줄, 3상태 토글 | ✅ |
| `use-document-viewer-actions.ts` (content 저장) | 309줄, handleSaveInputs | ✅ |
| `use-server-rendered-preview.ts` (refetch + 업무일지) | 101줄, refetch + resolver 판별 | ✅ |
| `new-document-general-step.tsx` (공용폼 리팩터) | 380→136줄, DocumentInputFields 위임 | ✅ |

### 1.2 설계에 없던 추가 산출물 (일탈이 아니라 개선)

| 신규 파일 | 목적 | 평가 |
| --- | --- | --- |
| `schemas/document-update.ts` (24줄) | PATCH 입력 서버 검증(타입·status 화이트리스트·503 매핑) | 설계 §7.1 서버검증 요구를 코드로 구체화 — 긍정 |
| `components/documents/use-self-profile.ts` (74줄) | 모듈캐시+inflight 공유 프로필 조회 | 프론트 MED#5(중복조회) 해소 수단 — 긍정 |
| `components/documents/document-viewer-footer.tsx` (112줄) | 뷰어 하단 액션바 추출 | modal 500줄 준수·단일책임 — 긍정 |

### 1.3 계약 조항별 일치

| 설계 조항 | 일치 | 근거 |
| --- | --- | --- |
| §3.1 parseEmbeddedInputs (reason 판별·빈객체 구분·work_rows 문자열 보존·prototype 가드) | ✅ | `embedded-inputs.ts:29-45` — PROPOSAL/DOCUMENT 선두 판별, `isStringRecord`가 배열·비문자열·오염 프로토타입 거부 |
| §3.2 buildContentWithInputs (병합·미노출키 보존·`-->`이스케이프·무변경 감지) | ✅ | `:51-65` — 의미기반 무변경 시 원문 반환(changed:false), `-->`→`-->`, `commentEnd` slice로 접미 원문 보존 |
| §3.3 왕복 불변식 | ✅ | slice(commentEnd) 기반이라 접미 바이트 동일. (단 테스트 미실행 — §4) |
| §4 식별 우선순위·충돌 차단 | ✅ | `resolve-input-form.ts:50` 커스텀 template_id 차단(교차수정으로 강화) |
| §5.1 PATCH content 단독·에러코드(400/401/403/500/503) | ✅ | `route.ts:313-349`, `document-update.ts` |
| §5.2 inline 최신 우선·업무일지·서명 제외·결재서명 유지·500줄 분해 | ✅ | `download/route.ts:206-225` + `inline-render.ts:196-225` |
| §5.3 프로필 명시적 재적용(마운트로 안 덮음) | ✅ | `use-document-input-autofill.ts:74-87` applyUserProfile, `EmploymentCertAutofill.tsx:50-54` edit 모드 자동적용 금지 |
| §6 Phase 1~6 전 항목 | ✅(§6 부분) | 아래 §2 Gap 참조 |
| §7.1 5대 원칙 | ✅ | §3 참조 |

**감점 요인(약 5%):** MED#6 부분 해소(저장성공/미리보기실패 확정 문구 미흡), a11y LOW 미해소, 테스트 러너 미연결, 이름 resolver 부분일치 잔존, 운영 검증 미수행.

---

## 2. Gap 목록 (설계 대비 누락/불일치)

### [잔존-1] (설계 §6 Phase 5·6) 저장 성공 ↔ 미리보기 실패의 **확정적** 구분 미흡 — 부분
- 현상: `handleSaveInputs`는 성공 시 `true` 반환하나 `document-input-editor.tsx:175`에서 반환값을 소비하지 않음(성공 토스트 없음). 저장 실패만 `toast.error`로 명확.
- 미리보기 실패 문구가 `document-viewer-modal.tsx:276` "입력값은 저장되었을 수 있습니다"로 **여전히 추정형**. 설계 §6은 "입력값은 저장되었지만 미리보기를 불러오지 못했습니다"의 **확정 구분**을 요구.
- 해소된 부분: 실패 재시도 `refetch` 버튼 존재(`:279`), 저장 실패 시 명확한 에러 토스트, 자동 GET과 중복 호출 없음.
- 영향: 경미(UX). 저장 자체 성공/실패는 구분되나, "저장은 됐고 미리보기만 실패" 케이스 안내가 모호.

### [잔존-2] (리뷰 프론트 LOW#7) 접근성 — 미해소(경미)
- `document-viewer-modal.tsx:219-252` 모드 토글 버튼에 `aria-pressed` 없음(선택 상태 CSS 색상으로만 표현). `aria-pressed` grep 결과 0건.
- 비활성 "입력값 편집" 버튼은 `aria-disabled`+`title`만 제공(`:232-233`) — 키보드/스크린리더 사용자에게 사유 전달 부족.
- `TemplateFieldInput`의 label htmlFor/id 연결 부재는 기존 공용 컴포넌트에서 이어진 문제.

### [잔존-3] (리뷰 백엔드 LOW) PATCH 503 재매핑 비-JSON 예외 — 미해소(경미 엣지)
- `route.ts:316` `await mutation.error.clone().json()`이 **메인 try 바깥**(:313-322). `withMutation`의 503 본문이 비-JSON이면 throw → Next 기본 500으로 샘(설계 503 기대와 불일치).
- 현재 `withMutation`이 항상 JSON 503을 반환한다면 실무 영향 없음. 방어적 try/catch 권장.

### [잔존-4] (리뷰 백엔드 LOW) status 화이트리스트 하드코딩 — 미해소(현재 안전)
- `document-update.ts:19` `['draft','completed','in_approval','approved','rejected']` 하드코딩. 현재 DB 값과 일치하므로 회귀 없음. 상태값 추가 시 조용히 400 유발 가능 → DB enum/공용 상수 단일출처화 권장.

### [잔존-5] 이름 resolver 부분일치(substring) 잔존 — 저위험 엣지
- `isWeeklyReportTemplateName`=`/주간\s*업무/.test()`, 재직증명서=`/재직\s*증명서/`, 휴가원=`/휴가원/` 모두 **앵커 없는 부분일치**.
- 커스텀 template_id 충돌은 `resolve-input-form.ts:50` 가드로 차단됨(해소). 그러나 **template_id가 없는 커스텀 마크다운 문서**가 제목에 "주간업무" 등을 포함 + 유효 선두 DOCUMENT_INPUTS를 가지면 빌트인 양식으로 오판 가능. 발생확률 낮음.

### [검증 공백-6] 신규 테스트 러너 미연결 — 검증기 자체 신뢰 불가
- `api-contract.test.ts`/`embedded-inputs.test.ts`/`inline-render.test.ts` 3종 존재하나 `package.json`에 `test` 스크립트 없음, vitest/jest/tsx/ts-node 전부 미설치(실측). **빌드/CI에서 실행 안 됨.**
- "초록불" 자체가 없는 상태 — 테스트 품질과 무관하게 **자동 회귀 방어망이 작동하지 않음**. 기존 `attendance/*.test.ts`도 동일 패턴이라 신규 결함은 아니나, 이 기능은 왕복 불변식·손상차단이 핵심이라 러너 연결 가치가 큼.

### [운영 검증 공백-7] 규칙 0-1 — 운영 실화면 미검증 (최우선 잔여)
- 설계 §5.2 Phase 3·§6 Phase 6 완료기준: **기존 Storage `.html` 문서·서술형 섹션 포함 문서·과거 no-comment 문서**를 운영/실데이터로 확인해야 완료.
- 양 교차검수 모두 정적 분석만 수행(브라우저 E2E·실 PATCH·운영 Storage 미확인).
- **현재 코드상 "완료" 선언 불가** — 로컬·정적 통과 ≠ 운영 동작(규칙 0-1).

---

## 3. 플랫폼 절대규칙 위반 점검

```
─────────────────────────────────────────────────
📋 플랫폼 개발 원칙 점검 (설계·구현 대조 기준)
─────────────────────────────────────────────────
1. 페이지 500줄 제한   : ✅ 준수 — 변경·신규 전 파일 ≤500줄
                          (최대 download/route.ts 494줄, inline-render 275,
                           modal 397, use-document-viewer-actions 309)
2. 단일 책임           : ✅ 준수 — 파싱(embedded-inputs)·식별(resolve-input-form)·
                          렌더(inline-render)·검증(schemas)·폼(input-fields)·
                          자동채움(autofill/use-self-profile)·저장(viewer-actions)·
                          액션바(footer) 분리. UI에 네트워크 혼재 제거(프로필→훅)
3. 서버 검증·보안      : ✅ 준수 — PATCH 인증·withMutation·canManageDocument 보존,
                          validateDocumentUpdate 추가, escapeHtml("'포함)·
                          work_rows shape 필터·_src data-URL 화이트리스트, `-->` 이스케이프,
                          mass-assignment 방지(content/title/status만)
                          / △ 503 비-JSON 예외 엣지(잔존-3)
4. 성능 (중복·N+1)     : ✅ 준수 — 프로필 중복조회 제거(모듈캐시),
                          미리보기 저장시점 한정+AbortController, inline은 서명 blob 생략으로 I/O 감소,
                          신규 N+1 없음
5. 폴더 구조           : ✅ 준수 — lib/documents·lib/templates·lib/renderers·
                          schemas·app/api·components/documents(use-*) 역할 일치
─────────────────────────────────────────────────
위반 항목: 구조적 위반 없음.
          경미 잔존 = 503 예외 엣지(3) · a11y(2) · status 상수(4) · 이름 resolver 부분일치(5)
          검증 공백 = 테스트 러너 미연결(6) · 운영 검증 미수행(7, 최우선)
─────────────────────────────────────────────────
```

> 참고: 프론트 배치가 사용자 전역 원칙의 `hooks/` 분리가 아닌 `components/documents/use-*`를 따름. 설계 §1.1이 이를 명시적으로 채택했으므로 이 기능 범위에선 위반 아님. 다만 전역 배치 기준 통일은 후속 과제.

---

## 4. 교차검수 지적 해소 여부

### 프론트엔드 리뷰 (HIGH 2 / MED 4 / LOW 1)

| # | 심각도 | 지적 | 해소 | 근거 |
| --- | --- | --- | --- | --- |
| 1 | HIGH | 손상 work_rows가 편집 중단/유실 | ✅ 해소 | `WeeklyWorkRowsEditor.tsx:24-51` `parseWorkRows` 구조검증(배열·객체·4필드 문자열), `:70-91` 손상 시 표 차단+복구 버튼. `document-input-editor.tsx:140` 저장도 차단 |
| 2 | HIGH | 저장 응답이 이후 편집을 덮음 | ✅ 해소 | `use-document-viewer-actions.ts:97-122` snapshotContent+editSessionRef 캡처, `setEditContent(prev => prev===snapshot ? saved : prev)`, 세션·docId 동시 비교 |
| 3 | MED | 다른 저장 경로가 검증·content단독 계약 우회 | ✅ 해소 | footer가 inputs 모드에서 "초안저장" 숨김(`document-viewer-footer.tsx:79`), onComplete/onSave에 `inputValid` 공유(`:65,:82`), 공유 검증 `getInputValidationState`(`document-input-editor.tsx:64-84`) |
| 4 | MED | 제목 게이팅이 resolver 복원가능 문서 차단 | ✅ 해소 | `document-viewer-modal.tsx:112-117` `inputFormRecoverable`(resolver.ok) 추가, `:131` 버튼 노출에 반영. 미리보기 훅도 resolver 병행(`use-server-rendered-preview.ts:51-60`) |
| 5 | MED | 프로필 중복조회 + UI 네트워크 혼재 | ✅ 해소 | 신규 `use-self-profile.ts` 모듈캐시+inflight 공유. autofill 훅·EmploymentCertAutofill 모두 위임(중복 fetch 제거, UI에서 fetch 제거) |
| 6 | MED | 저장성공 vs 미리보기실패 구분 불가 | △ 부분 | refetch 버튼·저장실패 토스트 추가(기능 해소). 단 "저장됐지만 미리보기 실패" 확정 문구 미흡(잔존-1) |
| 7 | LOW | 모드버튼 선택/비활성 사유 접근성 | ❌ 미해소 | aria-pressed 0건, 비활성 사유 title만(잔존-2) |

### 백엔드 리뷰 (MED 1 / LOW 4)

| 항목 | 심각도 | 지적 | 해소 | 근거 |
| --- | --- | --- | --- | --- |
| 커스텀 이름충돌 inline 오판 | MED | 빌트인 동일이름 커스텀 템플릿이 빌트인 레이아웃으로 덮임 | ✅ 해소 | `resolve-input-form.ts:50` `if(!byId && input.templateId) return ambiguous/not-target` — templateName 유무 무관하게 커스텀 template_id 차단 → `renderLatestInputForm` null → 레거시 경로 유지 |
| 503 비-JSON 예외 | LOW | `.clone().json()` try 바깥 throw 가능 | ❌ 미해소 | `route.ts:316` 여전히 try 바깥(잔존-3) |
| status 하드코딩 | LOW | 상수 단일출처 권장 | ❌ 미해소 | `document-update.ts:19` 하드코딩(현재 안전, 잔존-4) |
| 테스트 러너 미연결 | LOW | 초록불 검증 불가 | ❌ 미해소 | `package.json` test 스크립트·러너 없음(잔존-6) |
| 운영 검증 필수 | LOW/운영 | 규칙 0-1 실화면 확인 | ❌ 미수행 | 정적 분석만(잔존-7) |

**집계: HIGH 2/2 해소, MED 5/6 해소(+1 부분), 백엔드 MED 1/1 해소. LOW/운영 5건 중 0건 해소(전부 경미 또는 검증공백).**

---

## 5. 종합 의견 및 남은 수정 우선순위

### 종합
교차수정이 **가장 위험한 HIGH 2건(데이터 유실·저장 경합)과 MED 핵심 4건(검증 우회·제목 게이팅·중복조회·커스텀 충돌)을 실제로 코드에서 해소**했다. 설계 계약(§3 왕복 불변식, §4 식별, §5 API, §7 5대 원칙)은 사실상 완전 이행됐고, 검증 스키마·프로필 공용 캐시·footer 분리 등 설계보다 견고해진 지점도 있다. 구조적(500줄·단일책임·폴더) 위반은 없다.

다만 **규칙 0-5 "동작한다 ≠ 견고하다/완료"** 관점에서 두 가지 공백이 남는다: ① **운영 실화면 미검증**(규칙 0-1 — 기존 Storage `.html`·서술형 섹션·과거 문서), ② **테스트 러너 미연결로 초록불 자체가 없음**(검증기 신뢰 불가). 이 두 가지가 해소되기 전에는 "완료" 선언을 보류해야 한다.

### 수정 우선순위

| 순위 | 항목 | 분류 | 조치 |
| --- | --- | --- | --- |
| 1 | **운영 실화면 검증(잔존-7)** | 운영/규칙0-1 | 운영에서 ① 기존 Storage `.html` 문서 입력값 PATCH 후 inline 최신 반영, ② 서술형 섹션 포함 주간업무/휴가원 본문 무손실, ③ 과거 no-comment 문서 레거시 경로 유지를 **실화면으로 확인**(크로미가 못 보면 대장에게 확인 요청). **통과 전 배포 금지.** |
| 2 | **테스트 러너 연결(잔존-6)** | 검증 인프라 | tsx+node:test 또는 vitest 추가 + `test` 스크립트. 왕복 불변식·손상차단·XSS·Storage 우선순위가 CI에서 실제로 돌게. |
| 3 | 저장성공/미리보기실패 확정 문구(잔존-1) | UX·MED잔여 | `handleSaveInputs` 반환 boolean을 editor가 소비해, 저장 성공 후 미리보기만 실패 시 "입력값은 저장되었지만 미리보기를 불러오지 못했습니다"로 확정 안내. |
| 4 | 503 비-JSON 방어(잔존-3) | 보안·안정성 | `route.ts:316` try/catch 감싸 파싱 실패 시 원본 `mutation.error` 반환. |
| 5 | 접근성(잔존-2) | a11y·LOW | 모드 토글 `aria-pressed`, 비활성 사유 화면텍스트/`aria-describedby`, 공용 필드 label 연결. |
| 6 | status 상수 단일출처화(잔존-4) / 이름 resolver 엄격화(잔존-5) | 유지보수 | DB enum 단일출처, resolver 앵커 또는 template_id 없는 커스텀 문서 추가 방어. 저위험 — 후속. |

### 결론
**Match Rate 약 95%, 코드 품질·계약 일치 양호. HIGH/MED 실질 결함은 교차수정으로 해소됨.** 그러나 **운영 검증(1순위)과 테스트 러너 연결(2순위)을 완료하기 전에는 설계 완료기준 미충족 상태이며 "완료"·배포를 보류**한다. 나머지(3~6순위)는 경미하며 순차 처리 가능.

> 본 분석은 코드 수정 없이 설계·구현 대조만 수행했다. 테스트는 러너 부재로 실행 재현을 못 해 핵심 로직을 코드 라인으로 손 추적했고, 운영 실화면은 확인하지 않았음을 밝힌다(초록불·로컬 통과 미신뢰 원칙).
