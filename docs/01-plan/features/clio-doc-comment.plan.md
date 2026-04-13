# CLIO 문서 댓글 & 협업 반영 시스템 계획서

**버전:** v1.0.0  
**작성일:** 2026-04-13  
**현재 버전:** v5.13.0  
**배포:** https://clioai.vercel.app  

---

## 1. 맥락기술서 (Context Document)

### 1-1. 변경 배경

기존 결재(Approval) 워크플로우는 "AI가 생성한 문서를 승인/반려"하는 구조였다.  
그러나 AI 문서 생성 시스템의 실제 사용 패턴은 다음과 같다:

1. 담당자가 AI로 문서를 초안 생성
2. 관련 직원들에게 공유해 의견 수렴
3. 의견을 반영해 문서를 고도화

이 흐름에서 결재는 자연스럽지 않다. **"함께 다듬는"** 협업 모델이 AI 도구에 적합하다.

### 1-2. 기존 결재 시스템 현황

| 구성요소 | 파일/경로 |
|---------|-----------|
| DB 테이블 | `approvals` |
| 결재함 페이지 | `/src/app/approvals/` |
| 결재 API | `/src/app/api/approvals/` |
| 문서 상태 | `submitted / approved / rejected` |
| 사이드바 메뉴 | ClipboardCheck 아이콘 |
| 대시보드 위젯 | 결재 대기 카드, 결재 audit 라벨 |
| 문서 페이지 | 결재 요청/재요청 버튼, 결재자 선택 모달 |

### 1-3. 활용 가능한 기존 인프라

| 인프라 | 버전 | 활용 방법 |
|--------|------|-----------|
| 문서 버전 관리 | v5.6.0 | 댓글 반영 전 자동 버전 스냅샷 |
| 문서 생성 파이프라인 | v2.1.0~ | 댓글 컨텍스트 추가 후 재생성 |
| 외부 공유 링크 | v5.6.0 | 공유 후 사내 댓글 수집 |
| Supabase Auth | v1.9.1 | 댓글 작성자 인증 |
| 슬라이드 패널 UI | v5.8.0 (AI 검수) | 댓글 패널 동일 패턴 적용 |

---

## 2. 작업 범위

### 2-1. 제거 (결재 시스템 전체 삭제)

#### DB
```sql
-- 결재 테이블 삭제
DROP TABLE IF EXISTS approvals;

-- 문서 상태에서 결재 관련 값 제거
-- documents.status: 'submitted' | 'approved' | 'rejected' → 모두 'completed'로 변환 후 enum 정리
UPDATE documents SET status = 'completed' WHERE status IN ('submitted', 'approved', 'rejected');
```

#### 파일 삭제
```
src/app/approvals/               ← 페이지 전체 삭제
src/app/api/approvals/           ← API 라우트 전체 삭제
src/components/approvals/        ← 관련 컴포넌트 (있을 경우)
```

#### 코드 수정 (결재 참조 제거)
- `src/components/layout/Sidebar.tsx` — 결재함 메뉴 항목 제거
- `src/app/dashboard/page.tsx` — 결재 대기 카드, audit 결재 라벨 제거
- `src/app/documents/page.tsx` — 결재 요청/재요청 버튼, 결재자 선택 모달 제거
- `src/lib/supabase/types.ts` — approvals 타입 제거, document status 타입 정리

---

### 2-2. 신규 구현 (댓글 & 반영 시스템)

#### DB — `document_comments` 테이블

```sql
CREATE TABLE document_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- RLS: 로그인한 사내 사용자만 접근
ALTER TABLE document_comments ENABLE ROW LEVEL SECURITY;

-- 읽기: 같은 조직 모든 사용자
CREATE POLICY "comments_select" ON document_comments
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 쓰기: 로그인 사용자
CREATE POLICY "comments_insert" ON document_comments
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

-- 삭제: 본인 댓글만
CREATE POLICY "comments_delete" ON document_comments
  FOR DELETE USING (auth.uid()::text = user_id::text);
```

#### API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/api/documents/[id]/comments` | 댓글 목록 (작성자 이름 JOIN) |
| `POST` | `/api/documents/[id]/comments` | 댓글 작성 |
| `DELETE` | `/api/documents/[id]/comments/[commentId]` | 댓글 삭제 (본인 것만) |
| `POST` | `/api/documents/[id]/reflect` | 선택 댓글 → AI 재생성 → 새 버전 저장 |

#### reflect API 처리 흐름

```
POST /api/documents/[id]/reflect
  body: { selectedCommentIds: string[] }

1. 선택된 댓글 내용 조회
2. 현재 문서 content → 버전 관리 시스템으로 스냅샷 저장
   (기존 createVersion() 재사용)
3. 댓글 목록을 프롬프트에 추가:
   "다음 피드백을 반영해 문서를 수정해주세요:\n- {댓글1}\n- {댓글2}..."
4. 기존 generate 파이프라인 재호출 (포맷 유지)
5. 생성된 content로 documents 레코드 업데이트
6. 성공 응답 반환
```

---

## 3. UI 설계

### 3-1. 댓글 패널 (문서 상세 페이지)

- **위치:** 우측 슬라이드 패널 (AI 검수 패널과 동일 패턴)
- **진입:** 문서 상세 우측 상단 "댓글" 버튼 (MessageSquare 아이콘)

```
┌─────────────────────────────────┐
│ 💬 댓글 (3)          [반영하기] │  ← 선택된 댓글 수 표시
├─────────────────────────────────┤
│ ☑ 김철수  2026-04-13 14:22    [삭제] │
│   "3페이지 납기일을 2026-06으로  │
│    수정해주세요"                 │
├─────────────────────────────────┤
│ ☑ 이영희  2026-04-13 15:01    [삭제] │
│   "계약금 비율을 30%로 변경"    │
├─────────────────────────────────┤
│ ☐ 박민준  2026-04-13 15:30    [삭제] │
│   "전반적으로 좋습니다"          │
├─────────────────────────────────┤
│ ┌──────────────────────────────┐ │
│ │ 댓글을 입력하세요...         │ │
│ │                        [등록] │ │
│ └──────────────────────────────┘ │
└─────────────────────────────────┘
```

**동작 규칙:**
- 체크박스로 반영할 댓글 선택 (다중 선택)
- [삭제] 버튼: 본인 댓글만 표시, 즉시 삭제
- [반영하기]: 선택된 댓글 1개 이상일 때 활성화
- 반영 완료 후: "이전 버전이 저장되었습니다. 문서가 업데이트되었습니다." 토스트

### 3-2. 반영 확인 모달

[반영하기] 클릭 시 확인 모달:

```
┌──────────────────────────────────┐
│ 댓글 반영 확인                    │
│                                  │
│ 선택된 댓글 2개를 반영하여        │
│ 문서를 재생성합니다.              │
│                                  │
│ • 현재 문서는 이전 버전으로       │
│   자동 저장됩니다.                │
│ • 재생성에는 약 10~30초 소요됩니다│
│                                  │
│          [취소]  [반영하기]       │
└──────────────────────────────────┘
```

---

## 4. 작업 순서

```
Step 1. 결재 코드 삭제          (30분)
  - DB migration (drop approvals, update document status)
  - 파일/컴포넌트 삭제
  - 사이드바, 대시보드, 문서 페이지 참조 제거
  - types.ts 정리

Step 2. DB 마이그레이션         (10분)
  - 015_document_comments.sql 작성
  - Supabase 실행

Step 3. 댓글 API 구현           (1시간)
  - GET, POST, DELETE /comments
  - POST /reflect (버전 저장 + AI 재생성)

Step 4. 댓글 UI 구현            (1~2시간)
  - DocumentCommentPanel 컴포넌트
  - 체크박스 선택 상태 관리
  - 반영 확인 모달
  - 문서 상세 페이지에 패널 연결

Step 5. 통합 테스트 & 배포
```

---

## 5. 검증 계획

### 5-1. 결재 삭제 검증

| 항목 | 방법 | 기대 결과 |
|------|------|-----------|
| 사이드바 | 결재함 메뉴 없음 | 메뉴 항목 미노출 |
| 대시보드 | 결재 위젯 없음 | 결재 관련 카드 미노출 |
| 문서 페이지 | 결재 버튼 없음 | 결재 요청 UI 미노출 |
| DB | approvals 테이블 없음 | Supabase 대시보드 확인 |
| 빌드 | 타입 에러 없음 | `next build` 성공 |

### 5-2. 댓글 시스템 검증

| 항목 | 방법 | 기대 결과 |
|------|------|-----------|
| 댓글 작성 | 로그인 후 댓글 입력 | DB 저장 + 즉시 목록 노출 |
| 댓글 삭제 | 본인 댓글 삭제 버튼 | 즉시 제거 |
| 타인 댓글 삭제 | 타인 댓글에 삭제 버튼 | 버튼 미노출 |
| 미로그인 접근 | RLS | 401 반환 |

### 5-3. 댓글 반영 검증

| 항목 | 방법 | 기대 결과 |
|------|------|-----------|
| 버전 자동 저장 | 반영 후 버전 패널 확인 | 이전 버전 타임라인에 존재 |
| 문서 업데이트 | 반영 후 문서 내용 확인 | 댓글 내용 반영된 새 내용 |
| 선택 없이 반영 | 체크박스 0개 선택 후 버튼 | [반영하기] 버튼 비활성 |
| 버전 복원 | 이전 버전으로 되돌리기 | 반영 전 내용 복원 |

---

## 6. 버전 계획

| 버전 | 내용 |
|------|------|
| v6.0.0 | 결재 시스템 전체 제거 |
| v6.1.0 | 댓글 시스템 (작성/삭제/목록) |
| v6.2.0 | 댓글 → 문서 반영 (AI 재생성 + 버전 저장) |
