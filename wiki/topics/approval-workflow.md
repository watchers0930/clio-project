# 댓글 & AI 반영 시스템

> ⚠️ v6.2.0에서 결재(Approval) 시스템을 완전 제거하고 이 시스템으로 대체됨

[coverage: high -- sources: docs/02-design/features/comment-reflect.design.md, src/app/api/documents/[id]/comments/route.ts, src/app/api/documents/[id]/apply-comments/route.ts, src/components/documents/DocumentCommentPanel.tsx, src/lib/utils/parse-sections.ts]

---

## Purpose [coverage: high]

문서 검토자가 댓글로 의견을 남기고, 작성자가 원하는 댓글을 선택해 AI가 원문에 직접 반영하는 시스템이다. 결재 승인/반려라는 단방향 워크플로우 대신, 댓글 기반 협업 + AI 통합으로 문서를 점진적으로 개선한다.

핵심 목적:
- 검토 의견을 수동으로 복사/붙여넣기하지 않고 AI가 문서 원문에 직접 통합
- 기존 섹션 보강(insert 모드)과 새 단락 생성(append 모드) 두 가지 방식 지원
- 반영 전 현재 버전을 자동 스냅샷 저장해 변경 이력 유지

---

## 아키텍처 [coverage: high]

```
[DocumentCommentPanel]
  ↓ 댓글 체크박스 선택 + "반영하기" 버튼 클릭
[CommentReflectModal]
  ↓ 모드 선택 (insert | append)
  ├── insert: 기존 섹션 목록 표시 → 섹션 선택
  └── append: 새 단락명 입력
  ↓ POST /api/documents/[id]/apply-comments
  ↓ 성공 응답 (updatedContent)
[documents/[id]/page.tsx] → fetchDoc() 재호출 → 뷰어 자동 갱신
```

**관련 파일:**

| 파일 | 역할 |
|------|------|
| `src/components/documents/DocumentCommentPanel.tsx` | 댓글 목록, 작성, 체크박스 선택, 반영 버튼 |
| `src/components/documents/CommentReflectModal.tsx` | 반영 모드 선택 모달 (insert/append 2단계) |
| `src/lib/utils/parse-sections.ts` | `##`/`###` 헤더 기준 섹션 파싱 유틸 |
| `src/app/api/documents/[id]/comments/route.ts` | 댓글 CRUD API |
| `src/app/api/documents/[id]/apply-comments/route.ts` | AI 반영 API (핵심) |

---

## 댓글 플로우 [coverage: high]

**조회 (GET `/api/documents/[id]/comments`)**
- admin Supabase 클라이언트로 `document_comments` 테이블 조회
- `users:user_id(name, department_id)` join으로 작성자 이름 포함 반환
- `created_at` 오름차순 정렬 (시간순)
- 인증 필수: `getAuthUserId`로 검증 후 미인증 시 401 반환

**작성 (POST `/api/documents/[id]/comments`)**
- `content` 필드 필수 (빈 문자열 400 에러)
- `users` 테이블에서 작성자 존재 확인 후 `document_comments`에 insert
- 응답에 `user_name` 포함 (클라이언트 즉시 렌더링용)

**삭제 (DELETE `/api/documents/[id]/comments/[commentId]`)**
- `DocumentCommentPanel`에서 자신의 댓글만 삭제 가능 (UI 레벨 제한)
- 삭제 후 선택된 set에서도 제거

**UI 상태 관리 (`DocumentCommentPanel`):**
- `selected: Set<string>` — 체크된 댓글 id 집합
- `showReflectModal: boolean` — 반영 모달 표시 여부
- `documentContent` prop — 부모(`documents/[id]/page.tsx`)에서 전달, 섹션 파싱용
- `inline` prop — `true`면 fixed 포지셔닝 없이 사이드패널로 렌더

---

## AI 반영 플로우 (apply-comments) [coverage: high]

`POST /api/documents/[id]/apply-comments` 처리 순서:

1. **인증 확인** — `getAuthUserId`로 미인증 시 401
2. **문서 조회** — `documents` 테이블에서 `content`, `version_number`, `parent_id` 등 조회
3. **버전 스냅샷 저장** — 반영 전 현재 content를 `documents` 테이블에 새 레코드로 insert (`status: 'completed'`, `parent_id: rootId`)
4. **댓글 조회** — `selectedCommentIds`로 `document_comments` 조회, 작성자 이름 포함
5. **feedbackList 포맷** — `"1. 홍길동: 댓글 내용"` 형태로 번호 + 이름 + 내용 구성
6. **OpenAI GPT-4o 호출** — `temperature: 0.3`, `max_tokens: 4000`
7. **content 업데이트** — `documents` 테이블 `content` + `version_number + 1` 업데이트
8. **응답** — `{ success: true, updatedContent }` 반환

**버전 관리 방식:**
- 원본 문서 레코드의 `version_number`는 1씩 증가
- 스냅샷은 별도 레코드로 저장 (`parent_id`로 원본과 연결)
- `rootId = doc.parent_id ?? documentId` — 이미 자식 문서인 경우 최상위 부모 id 사용

---

## Insert vs Append 모드 [coverage: high]

### 모드 1: Insert (기존 섹션에 삽입)

- Request: `{ mode: 'insert', selectedCommentIds: string[], targetSection: string }`
- `extractSectionContent(doc.content, targetSection)`으로 해당 섹션 현재 내용 추출
- **섹션 존재 시**: 기존 내용 + 댓글을 함께 GPT-4o에 전달 → "구조·문체 유지하며 통합" 프롬프트
- **섹션 없을 시** (HWPX 등 헤더 없는 경우): 댓글만으로 섹션 내용 생성 후 `content` 하단에 `## {targetSection}` 추가
- `replaceSectionContent(doc.content, targetSection, newSectionContent)`로 원본 헤더 포함 전체 재조합

### 모드 2: Append (새 단락 생성)

- Request: `{ mode: 'append', selectedCommentIds: string[], newSectionTitle: string }`
- 댓글들만 GPT-4o에 전달 → `'{newSectionTitle}' 단락으로 정리` 프롬프트
- 생성된 내용을 `\n\n## {newSectionTitle}\n\n{content}` 형태로 기존 content 하단에 append

### AI 프롬프트 공통 규칙

두 모드 모두 프롬프트에 동일한 작성 규칙 적용:
- '첫째', '둘째' 등 순서 표현은 반드시 새 줄에서 시작
- 항목 간 빈 줄 없이 줄바꿈(`\n`)으로 구분
- 헤더(`##` 등)는 AI 출력에서 제외 (API 레벨에서 헤더 조합)

---

## API Surface [coverage: high]

### 댓글 API

| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| GET | `/api/documents/[id]/comments` | 댓글 목록 (작성자 이름 포함) | 필수 |
| POST | `/api/documents/[id]/comments` | 댓글 작성 | 필수 |
| DELETE | `/api/documents/[id]/comments/[commentId]` | 댓글 삭제 | 필수 |

### AI 반영 API

| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| POST | `/api/documents/[id]/apply-comments` | 선택 댓글 AI 반영 | 필수 |

**apply-comments Request Body:**

```typescript
// insert 모드
{
  mode: 'insert',
  selectedCommentIds: string[],
  targetSection: string   // 예: '문제점', '보고내용과 의견'
}

// append 모드
{
  mode: 'append',
  selectedCommentIds: string[],
  newSectionTitle: string  // 예: '해결방안'
}
```

**apply-comments Response:**

```typescript
{ success: true, updatedContent: string }   // 업데이트된 전체 content
{ success: false, error: string }            // 에러 시
```

**에러 케이스:**
- `selectedCommentIds` 빈 배열: 400
- insert 모드에서 `targetSection` 누락: 400
- append 모드에서 `newSectionTitle` 빈 문자열: 400
- OpenAI 응답 비어있음: 500
- DB 업데이트 실패: 500

---

## Key Decisions [coverage: high]

**1. apply-comments가 /reflect를 대체**
기존 `/api/documents/[id]/reflect`는 레거시로 유지되지만, `DocumentCommentPanel`의 반영 버튼은 `/apply-comments`로 전환됨. 향후 `/reflect` 제거 예정.

**2. 반영 전 버전 스냅샷 자동 저장**
apply-comments API 내부에서 반영 전 content를 자동으로 별도 레코드로 저장한다. 클라이언트가 명시적으로 저장 요청할 필요 없음. 이로써 반영 이력 추적 가능.

**3. admin 클라이언트 사용**
댓글 조회/작성 모두 `createAdminSupabaseClient()`를 사용한다. RLS를 우회해 다른 사용자 댓글도 조회 가능 (읽기 전용 문서의 타인 댓글 표시 목적).

**4. documentContent prop 전달**
`CommentReflectModal`에서 섹션 목록을 파싱하려면 문서 content가 필요하다. `documents/[id]/page.tsx`가 `documentContent={doc?.content ?? ''}` prop으로 `DocumentCommentPanel`에 전달하고, 패널이 다시 모달로 전달하는 구조.

**5. GPT-4o, temperature 0.3**
일관성 있는 실무 문서 품질을 위해 낮은 temperature 사용. max_tokens 4000으로 장문 섹션도 처리 가능.

---

## 구 결재 시스템 (deprecated) [coverage: low]

v6.2.0 이전에는 `approvals` 테이블 기반 결재 워크플로우가 있었다. v6.2.0(또는 마이그레이션 기록상 v6.3.0)에서 완전 제거됨.

**제거된 항목:**

| 종류 | 항목 |
|------|------|
| DB 테이블 | `approvals` (`DROP TABLE IF EXISTS approvals CASCADE`) |
| API Routes | `/api/approvals`, `/api/documents/[id]/approve`, `/api/documents/[id]/reject`, `/api/documents/[id]/submit-approval` |
| 페이지 | `src/app/(app)/approvals/page.tsx` |
| 컴포넌트 | `src/components/documents/ApprovalModal.tsx` |
| 타입 | `ApprovalStatus`, `DbApproval`, `documents.status`의 `submitted/approved/rejected` |
| 사이드바 | 결재 메뉴 항목 |

**마이그레이션:**

```sql
-- supabase/migrations/015_drop_approvals_add_comments.sql
DROP TABLE IF EXISTS approvals CASCADE;
UPDATE documents SET status = 'completed'
  WHERE status IN ('submitted', 'approved', 'rejected');
```

기존 `submitted/approved/rejected` 상태 문서는 모두 `completed`로 일괄 변환됨.

**현재 문서 상태값:**

```typescript
type DocumentStatus = 'draft' | 'completed';
// draft: 편집 가능
// completed: 뷰어(/documents/[id])에서 조회 + 댓글 가능
```

---

## Gotchas [coverage: high]

**1. HWPX 문서의 섹션 없음 처리**
HWPX에서 변환된 문서는 `##` 헤더가 없을 수 있다. insert 모드에서 `extractSectionContent`가 빈 문자열을 반환하면, API는 신규 섹션으로 처리해 content 하단에 append한다. 의도적 폴백 동작이므로 오류가 아님.

**2. replaceSectionContent의 헤더 보존**
`replaceSectionContent` 유틸은 교체 대상 헤더 라인 자체는 result에 push하고, 그 아래 내용만 newContent로 대체한다. 헤더가 `##`인지 `###`인지 원본 그대로 유지된다.

**3. selectedCommentIds 빈 배열 체크**
API와 UI 모두에서 체크한다. UI는 `selected.size === 0`이면 반영 버튼 비활성화, API는 400 에러 반환.

**4. 버전 스냅샷의 parent_id 처리**
`rootId = doc.parent_id ?? documentId`로 계산한다. 문서가 이미 자식인 경우(`parent_id`가 있는 경우) 스냅샷의 부모는 최상위 루트가 되어 버전 트리가 평탄하게 유지된다.

**5. 레거시 /reflect API 공존**
`/apply-comments`와 `/reflect`가 동시에 존재한다. `DocumentCommentPanel`은 `/apply-comments`만 사용하지만, 외부에서 `/reflect`를 직접 호출하는 경우 여전히 동작한다. 향후 정리 대상.

---

## Sources [coverage: high]

- `docs/02-design/features/comment-reflect.design.md` — 전체 설계서 (아키텍처, API, 컴포넌트, 프롬프트)
- `src/app/api/documents/[id]/comments/route.ts` — 댓글 CRUD API 구현
- `src/app/api/documents/[id]/apply-comments/route.ts` — AI 반영 API 구현 (버전 스냅샷 포함)
- `src/components/documents/DocumentCommentPanel.tsx` — 댓글 패널 UI 및 상태 관리
- `src/lib/utils/parse-sections.ts` — `parseSections`, `extractSectionContent`, `replaceSectionContent` 유틸
