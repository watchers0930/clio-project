# 설계서: 댓글 반영 고도화 (comment-reflect)

**작성일:** 2026-04-13  
**버전:** v1.0  
**상태:** Design  
**참조:** `docs/01-plan/features/comment-reflect.plan.md`

---

## 1. 아키텍처 개요

```
[DocumentCommentPanel]
  ↓ 댓글 선택 + "반영하기" 클릭
[CommentReflectModal]  ← 새 컴포넌트
  ↓ 모드 선택
  ├── 모드1: 섹션 선택 → POST /api/documents/[id]/apply-comments
  └── 모드2: 단락명 입력 → POST /api/documents/[id]/apply-comments
  ↓ 성공
[documents/[id]/page.tsx] → fetchDoc() 재호출 → 뷰어 갱신
```

---

## 2. API 설계

### `POST /api/documents/[id]/apply-comments`

기존 `/reflect` 대체. 모드에 따라 두 가지 처리.

#### Request Body

```typescript
// 모드 1: 기존 섹션에 삽입
{
  mode: 'insert',
  selectedCommentIds: string[],
  targetSection: string  // 예: '문제점', '보고내용과 의견'
}

// 모드 2: 새 단락 생성
{
  mode: 'append',
  selectedCommentIds: string[],
  newSectionTitle: string  // 예: '해결방안'
}
```

#### Response

```typescript
{
  success: boolean,
  updatedContent: string  // 업데이트된 전체 content
}
```

#### 처리 로직

**모드 1 (insert):**
1. 현재 문서 content 조회
2. content를 `##` / `###` 헤더 기준으로 섹션 파싱
3. `targetSection`과 일치하는 섹션 찾기
4. 선택된 댓글들 + 해당 섹션 내용을 AI에 전달
5. AI: "이 섹션에 댓글 내용을 자연스럽게 통합해줘" 프롬프트
6. 수정된 섹션으로 교체 후 전체 content 재조합
7. `documents` 테이블 content 업데이트 (새 레코드 생성 없음)

**모드 2 (append):**
1. 현재 문서 content 조회
2. 선택된 댓글들을 AI에 전달
3. AI: "이 댓글들을 '[newSectionTitle]' 단락으로 정리해줘" 프롬프트
4. 생성된 내용을 `## {newSectionTitle}` 형태로 content 하단에 추가
5. `documents` 테이블 content 업데이트

---

## 3. 컴포넌트 설계

### 3-1. `CommentReflectModal` (신규)

**위치:** `src/components/documents/CommentReflectModal.tsx`

**Props:**
```typescript
interface CommentReflectModalProps {
  documentId: string
  selectedComments: { id: string; content: string; userName: string }[]
  documentContent: string  // 섹션 파싱용
  onClose: () => void
  onReflected: () => void  // 반영 완료 후 fetchDoc 트리거
}
```

**내부 상태:**
```typescript
const [mode, setMode] = useState<'select' | 'insert' | 'append'>('select')
const [targetSection, setTargetSection] = useState('')
const [newSectionTitle, setNewSectionTitle] = useState('')
const [loading, setLoading] = useState(false)
```

**렌더 흐름:**
```
step 1 (select):
  "어떻게 반영할까요?"
  [기존 섹션에 추가]  [새 단락 만들기]

step 2a (insert):
  "어느 섹션에 추가할까요?"
  섹션 목록 버튼 (파싱된 헤더 목록)
  [적용하기]

step 2b (append):
  "새 단락 이름을 입력하세요"
  <input placeholder="예: 해결방안" />
  [AI로 생성하기]
```

### 3-2. `DocumentCommentPanel` 수정

**변경 내용:**
- 기존 "AI 반영" 버튼 → "반영하기" 버튼으로 교체
- 클릭 시 `CommentReflectModal` 열기
- `onReflected` prop은 동일하게 유지

**Props 추가:**
```typescript
documentContent?: string  // 섹션 파싱을 위해 부모에서 전달
```

### 3-3. `documents/[id]/page.tsx` 수정

- `DocumentCommentPanel`에 `documentContent={doc?.content ?? ''}` 전달

---

## 4. 섹션 파싱 유틸리티

**위치:** `src/lib/utils/parse-sections.ts`

```typescript
export function parseSections(content: string): string[] {
  return content
    .split('\n')
    .filter(line => line.startsWith('## ') || line.startsWith('### '))
    .map(line => line.replace(/^#{2,3}\s+/, '').trim())
}
```

섹션 삽입 시 원본 content에서 해당 헤더를 찾아 다음 헤더 전까지 교체.

---

## 5. AI 프롬프트

### 모드 1 (섹션 삽입)

```
현재 섹션 내용:
---
{currentSectionContent}
---

아래 의견/댓글을 위 섹션에 자연스럽게 통합해주세요.
기존 내용의 구조와 문체를 유지하면서 내용만 추가/보완하세요.

의견:
{feedbackList}

수정된 섹션 내용만 출력하세요. 섹션 헤더(##)는 포함하지 마세요.
```

### 모드 2 (새 단락)

```
아래 의견/댓글들을 바탕으로 '{newSectionTitle}' 단락을 작성해주세요.
핵심 내용을 구조적으로 정리하고, 실무 문서 형식으로 작성하세요.

의견:
{feedbackList}

단락 내용만 출력하세요. 헤더(##)는 포함하지 마세요.
```

---

## 6. 파일 변경 목록

| 파일 | 변경 유형 | 내용 |
|------|----------|------|
| `src/components/documents/CommentReflectModal.tsx` | 신규 | 반영 모드 선택 모달 |
| `src/lib/utils/parse-sections.ts` | 신규 | content 섹션 파싱 유틸 |
| `src/app/api/documents/[id]/apply-comments/route.ts` | 신규 | 댓글 반영 API |
| `src/components/documents/DocumentCommentPanel.tsx` | 수정 | 버튼 교체, 모달 연결 |
| `src/app/(app)/documents/[id]/page.tsx` | 수정 | documentContent prop 전달 |

---

## 7. 기존 reflect API 처리

- `/api/documents/[id]/reflect` — 그대로 유지 (레거시, 향후 제거 검토)
- 신규 `/apply-comments`가 주 API로 사용
- `DocumentCommentPanel`의 반영 버튼은 신규 API로 전환

---

## 8. 구현 순서

1. `parse-sections.ts` 유틸 작성
2. `apply-comments` API 구현 (모드 2 먼저, 모드 1 후)
3. `CommentReflectModal` 컴포넌트 구현
4. `DocumentCommentPanel` 버튼 교체 및 모달 연결
5. `documents/[id]/page.tsx` prop 전달 추가
