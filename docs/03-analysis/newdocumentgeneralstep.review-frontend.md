# newdocumentgeneralstep 프론트엔드 교차검수

- 검토일: 2026-10-23
- 기준: `docs/02-design/features/newdocumentgeneralstep.design.md`, 플랫폼 개발 5대 절대 원칙
- 판정: **수정 필요 — HIGH 2건 / MED 4건 / LOW 1건**
- 범위: `git status --short`, `git diff`로 확인한 미커밋 프론트 변경 10개 파일(신규 3개 포함). 실제 소스 경로는 `src/components/`, `src/app/`, `src/hooks/`이며 `src/hooks/`에는 변경이 없었다. API·lib는 프론트 계약 및 호출 흐름 확인을 위해 참조했다. 라인은 검토 시점 작업 트리 기준이다.
- 애플리케이션 코드는 수정하지 않았다. 신규 기능에서 드러나는 기존 공용 컴포넌트 문제와 리팩터 후 잔존 문제는 아래에 구분했다.

## 지적 사항

### 1. [심각도 HIGH] src/components/documents/document-input-fields.tsx:174 — 손상된 work_rows가 편집 화면을 중단시키거나 후속 수정으로 유실된다

**문제:** 신규 편집 경로가 저장된 `work_rows`를 구조 검증 없이 기존 `WeeklyWorkRowsEditor`에 전달한다. 외부 주석 파서는 값이 문자열인지만 검사하므로 `"broken"`, `"[null]"`도 진입 가능하다. 공용 에디터는 JSON 오류를 빈 배열로 취급하고(`WeeklyWorkRowsEditor.tsx:30–36`), 새 셀 입력 시 그 배열로 전체 값을 재직렬화한다(:43–46). 따라서 손상 원문이 정상적인 새 행 데이터로 덮인다. `[null]`은 :71에서 `row.date` 접근 중 예외를 발생시킨다. 기존 생성 에디터를 저장 문서 편집에 연결하면서 추가된 위험이며, 설계 §6 Phase 5의 “손상 work_rows를 빈 배열로 덮어쓰지 않음”을 충족하지 않는다.

**재현:** 실제 컴포넌트를 메모리에서 TypeScript 변환 후 `renderToStaticMarkup`으로 확인했다. `work_rows="broken"`은 복원 가능 판정, 빈 입력표 표시, 저장 버튼 활성 상태였다. `work_rows="[null]"`은 `Cannot read properties of null (reading 'date')`로 렌더에 실패했다. 숫자 속성도 허용되어 이후 `trim()`에서 실패할 수 있다.

**수정 제안:** 공용 검증 함수에서 JSON 배열 여부, 각 행의 객체 여부, `date/content/progress/note` 문자열 여부를 검사한다. 오류 시 원문을 유지하고 표 편집·저장을 차단하며 복구 안내를 제공한다. 서버에서도 해당 구조를 검증하여 클라이언트 우회를 방어한다.

### 2. [심각도 HIGH] src/components/documents/use-document-viewer-actions.ts:113 — 저장 응답이 저장 시작 이후의 추가 편집을 덮는다

**문제:** 저장 시작 시 `snapshotContent`를 캡처하지만(:93), 응답 시 문서 ID만 비교하고 `setEditContent(savedContent)`를 무조건 실행한다(:115). `saving`은 저장 버튼만 비활성화하며 입력 필드와 “현재 프로필 반영”은 계속 작동한다. 같은 문서에서 저장 응답을 기다리는 동안 입력한 값은 이전 스냅샷으로 되돌아가고, 저장 기준과 같아져 미저장 닫기 확인도 사라질 수 있다. A→B 전환 방어만으로 같은 문서의 편집 경합은 해결되지 않는다.

**재현 조건:** 네트워크가 느릴 때 값 A를 저장하고 응답 전에 B로 변경한다. 응답이 오면 화면과 `editContent`가 A로 돌아간다.

**수정 제안:** 저장된 기준값(`viewDoc.content`·목록)은 응답으로 갱신하되 편집값은 `setEditContent(prev => prev === snapshotContent ? savedContent : prev)`처럼 요청 이후 변경이 없을 때만 교체한다. 문서 전환·재열기는 편집 세션 식별자도 함께 비교한다.

### 3. [심각도 MED] src/components/documents/document-viewer-modal.tsx:358 — 입력값 모드의 다른 저장 경로가 필수값 검증과 content 단독 계약을 우회한다

**문제:** 신규 `DocumentInputEditor`는 필수값 누락 시 내부 “입력값 저장”을 막지만(:108–111), 모달 하단 “초안 저장”은 여전히 `onSave`를 호출하며 `saving/isEdited`만 확인한다. 휴가원의 성명이나 업무일지의 필수 업무내용을 지우면 내부 버튼은 비활성화되어도 하단 버튼으로 저장할 수 있다. 이 경로는 `handleSave`(:62–70)를 통해 `{ content, title }`을 전송하여, 입력값 저장은 `{ content }`만 전송한다는 설계 §5.1과도 다르다. “완료 문서로 전환”(:346) 역시 같은 필수값 검증 없이 편집 content를 저장한다.

**수정 제안:** 입력값 검증을 공유 훅/순수 함수로 추출하고 모든 저장·완료 액션에 적용한다. 입력값 모드의 저장 버튼은 content 전용 액션으로 통일하고, 제목 저장은 설계대로 별도 흐름으로 명확히 처리한다.

### 4. [심각도 MED] src/components/documents/document-viewer-modal.tsx:120 — 제목 기반 선행 조건이 resolver가 복원 가능한 문서의 편집을 막는다

**문제:** `getInputEditorAvailability` 호출과 입력값 버튼 노출(:213)이 모두 `isBuiltinForm`에 종속된다. 이 값(:109)은 `templateId`가 없고 DB 제목이 정규식에 맞아야 참이다. 따라서 제목을 “은행 제출용”으로 변경했더라도 주석의 `__template_name: "재직증명서"`로 안전하게 복원 가능한 문서는 resolver에 도달하지 못한다. 지원 빌트인 ID를 가진 문서도 `isServerTemplate`으로 분류되어 버튼이 없다. 설계 §4의 ID → 이름/메타 → 제목 fallback 우선순위가 실제 UI 진입에서는 적용되지 않는다. 미리보기 훅(:47–52)에도 같은 제목 의존 조건이 있다.

**수정 제안:** 초안 여부와 공용 resolver 결과로 입력값 편집 가용성을 판단하고, resolver가 지원 대상으로 확정한 문서를 서버 미리보기 대상으로 연결한다. 실제 식별 실패는 `ambiguous` 등의 사유로 표시한다. 커스텀 양식 충돌 차단은 resolver에 유지한다.

### 5. [심각도 MED] src/components/documents/use-document-input-autofill.ts:46 — 프로필 중복 조회와 UI 내부 API 호출이 리팩터 후에도 남는다

**문제:** 재직증명서 생성 시 `NewDocumentGeneralStep`의 신규 훅이 `/api/users/profile`을 조회하고, 자식 `EmploymentCertAutofill.tsx:36`도 같은 API를 별도로 호출한다. 서로 다른 컴포넌트의 로컬 상태라 요청 공유가 없으며 각 `loadedRef`도 다른 호출을 막지 못한다. 편집에서는 모드 전환으로 자식이 재마운트될 때 재조회한다. 기존에도 존재했던 중복이 이번 공용폼·자동채움 분리 후 잔존한다. 또한 수정된 `EmploymentCertAutofill`은 UI·조회·상태·자동 적용을 한 파일에 유지하여 플랫폼 원칙 2와 설계 §7.1의 “UI에 네트워크 혼재 금지”에 맞지 않는다.

**수정 제안:** 프로필 조회를 한 공용 훅/캐시에 모으고 생성 자동채움과 재직증명서 UI가 같은 결과를 사용하게 한다. UI는 프로필·로딩·오류·적용 콜백을 받도록 분리하고 편집 모드의 명시적 적용 정책을 유지한다.

### 6. [심각도 MED] src/components/documents/document-input-editor.tsx:140 — 저장 성공 결과를 버려 미리보기 실패와 구분해 안내할 수 없다

**문제:** `onSaveInputs()`의 `Promise<boolean>` 결과를 소비하지 않고, 저장 액션도 성공 상태/알림을 제공하지 않는다. 서버 렌더 재조회는 올바르게 자동 발생하지만, 실패 안내는 `document-viewer-modal.tsx:260`의 “입력값은 저장되었을 수 있습니다”뿐이다. 저장에 성공했는지 확인 가능한 반환값이 있는데도 사용자에게 확정적으로 전달되지 않는다. 처음 열 때의 조회 실패와 저장 성공 후 조회 실패도 같은 문구다. 이는 설계 §6 Phase 5의 “저장 성공 / 미리보기만 실패 구분” 요구에 미달한다.

**수정 제안:** 저장 성공 여부를 현재 문서·저장 버전에 연결해 관리하고 성공 피드백을 표시한다. 해당 저장 뒤의 미리보기만 실패했다면 “입력값은 저장되었지만 미리보기를 불러오지 못했습니다”와 재시도를 제공한다. 현재 자동 GET에 추가 `refetch()`를 무조건 호출하여 중복 요청을 만들지는 않는다.

### 7. [심각도 LOW] src/components/documents/document-viewer-modal.tsx:214 — 신규 모드 버튼의 선택 상태와 비활성 사유가 보조기기에 전달되지 않는다

**문제:** 모드 선택은 CSS 색상으로만 표현되며 `aria-pressed` 또는 탭 선택 상태가 없다. 비활성 사유는 포커스를 받을 수 없는 `disabled` 버튼의 `title`에만 들어가므로 키보드/터치 이용자는 이유를 확인하기 어렵다. 신규 편집 폼이 재사용하는 기존 `TemplateFieldInput.tsx:34`의 라벨에도 `htmlFor/id` 연결이 없어 입력의 접근 가능한 이름이 보장되지 않는다. 후자는 기존 공용 컴포넌트에서 이어진 문제다.

**수정 제안:** 모드 버튼에 `aria-pressed`를 부여하거나 탭 역할·키보드 동작을 함께 구현한다. 비활성 사유를 화면 텍스트 및 `aria-describedby`로 제공한다. 공용 필드에 고유 ID와 연결된 라벨, 오류 설명 및 `aria-invalid`를 부여한다.

## 확인된 정상 동작 및 절대규칙 점검

- 전용 `handleSaveInputs`의 PATCH는 `csrfFetch`를 사용하고 `{ content }`만 전송한다. HTTP 실패와 `success:false`를 오류로 처리하며, 정상 응답의 `data.content`로 목록·저장 기준을 갱신한다.
- 미리보기 GET의 `format=pdf&inline=true&font=...`는 설계 §5.2와 일치한다. 의존성은 저장된 `viewDoc.content`이며 타이핑 중인 `editContent`가 아니므로, 코드상 타이핑마다 GET을 발생시키지 않는다. `refetch`를 저장 시 중복 호출하는 코드도 없다. 기존 `AbortController`를 유지했다.
- 편집 모드 재직증명서는 마운트만으로 프로필을 적용하지 않는다. 일반적인 폼 변경은 `buildContentWithInputs`를 통해 선두 입력값 주석을 교체한다. 모드 간 공유 편집값과 미저장 닫기 확인도 연결되어 있다(저장 경합은 지적 2 참조).
- 프론트 변경 10개 파일 모두 500줄 이하이다. 페이지 242줄, 뷰어 400줄, 공용폼 245줄, `use-documents-page.ts` 493줄이다. 폴더 배치는 설계 §1.1의 `components/documents/use-*` 예외 배치와 일치한다. 사용자 일반 원칙의 `hooks/` 분리와 차이가 있으므로 향후 배치 기준을 통일할 필요가 있으나 이번 신규 버그로 집계하지 않았다.
- 검토한 프론트 변경에서 비밀키·토큰 하드코딩이나 신규 raw HTML 삽입은 확인하지 못했다. 서버의 모든 입력 검증·SQL/XSS/CSRF 방어 전체를 이번 프론트 리뷰만으로 보증하지 않는다. DB 컬럼 선택·N+1은 백엔드 전수검수 범위 밖이다.
- 렌더마다 availability resolver·입력값 파싱이 반복되는 부분은 있지만, 실측 없이 성능 결함으로 단정하지 않았다. 대량 행의 성능과 페이지네이션/지연 렌더는 별도 부하 검증이 필요하다.

## 검증 및 한계

- 변경 프론트 10개 파일에 ESLint 실행: **오류 0, 경고 1**. 경고는 기존 `use-documents-page.ts:284`의 `setNewVersionDocId` effect 의존성 누락이며 이번 변경 라인과 무관하다.
- `npx tsc --noEmit --incremental false`: **통과**.
- 손상 `work_rows` 3개 사례를 실제 컴포넌트의 서버 정적 렌더로 검사했다. 애플리케이션 소스·테스트 파일은 추가/수정하지 않았다.
- 저장 경합·검증 우회·중복 fetch는 호출 경로와 상태 갱신 코드로 확인한 정적 분석 결과다. 로그인 브라우저 E2E, 실제 PATCH, 운영 Storage `.html` 및 실데이터 확인은 실행하지 않았다. 설계의 운영 완료 기준을 충족했다고 판단하지 않는다.
- Next.js 경계는 설치된 `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md`를 참조했다.
