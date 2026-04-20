# CLIO 플랫폼 개요

[coverage: high -- sources: package.json, src/components/layout/sidebar.tsx, src/app/(app)/dashboard/page.tsx, supabase/migrations/014_files_scope.sql, supabase/migrations/015_drop_approvals_add_comments.sql, src/lib/permissions.ts, src/app/(app)/contract-risk/, src/app/(app)/documents/[id]/diff/]

---

## Purpose

[coverage: high]

CLIO는 기업 내부용 **RAG 기반 AI 문서관리 + 협업 통합 플랫폼**이다.  
파일 업로드 → 텍스트 추출 → pgvector 임베딩 → AI 문서 생성으로 이어지는 전 파이프라인이 실운영 상태이며, 문서 댓글·AI 반영·계약 리스크 분석·STT 회의록·문서 Diff·품질 검수·만료일 알림·파일 공개 범위 관리까지 포괄하는 통합 사내 협업 플랫폼이다.

- **배포 URL:** https://clioai.vercel.app
- **현재 버전:** v6.9.0
- **위치:** `/Users/watchers/Desktop/clio-project`
- **결재(Approval) 워크플로우:** v6.2.0에서 완전 제거됨 (DB 테이블 포함 삭제)

---

## 기술 스택

[coverage: high]

| 영역 | 기술 | 버전 |
|------|------|------|
| 프론트엔드 | Next.js (App Router) | 16.2.1 |
| UI 프레임워크 | React | 19.2.4 |
| 스타일링 | Tailwind CSS | v4 |
| 상태관리 | Zustand (persist 미들웨어) | ^5.0.12 |
| 백엔드/DB | Supabase (PostgreSQL + pgvector + Storage + Auth) | ^2.100.0 |
| AI 모델 | OpenAI GPT-4o (`@ai-sdk/openai` + `openai` SDK) | ai ^6.0.138 |
| STT | OpenAI Whisper-1 | — |
| 문서 생성 | docx / adm-zip(HWPX) / exceljs(XLSX) / pptxgenjs(PPTX) / jspdf(PDF) | 각 최신 |
| 파일 파싱 | mammoth(DOCX) / pdf-parse(PDF) / xlsx / cheerio | — |
| 문서 템플릿 | docxtemplater + pizzip | — |
| 인증 | Supabase Auth + JWT (jsonwebtoken) + bcryptjs | — |
| 날짜 유틸 | date-fns | ^4.1.0 |
| 배포 | Vercel | — |

---

## 화면 구성 (메뉴)

[coverage: high]

사이드바(`src/components/layout/sidebar.tsx`)에 고정된 10개 메뉴:

| 순서 | 메뉴 라벨 | 경로 | 비고 |
|------|-----------|------|------|
| 1 | 대시보드 | `/dashboard` | 통계 위젯 + 빠른 액션 + 만료일 알림 위젯 |
| 2 | AI 검색 | `/search` | 시맨틱 검색 (pgvector + 텍스트 폴백 + AI 요약) |
| 3 | 파일 관리 | `/files` | 멀티파트 업로드, 공개 범위(scope) 설정 |
| 4 | 문서 생성 | `/documents` | 초안 편집 모달 / 완료 문서는 전용 뷰어로 이동 |
| 5 | 계약 리스크 | `/contract-risk` | 계약서 업로드 → AI 리스크 조항 분석 + 법령 수정 제안 |
| 6 | 메시지 | `/messages` | DM/채널, 첨부파일, Supabase Realtime; 미읽음 배지 (10초 폴링) |
| 7 | 일정/할일 | `/schedule` | 월간 캘린더 + CRUD |
| 8 | 업무일지 | `/work-logs` | 날짜별 일지, 잠금, 팀 현황, 주간 요약 DOCX (v6.9.0 신규) |
| 9 | 메모 | `/memos` | 개인 메모, 색상/고정 지원 (v6.9.0 신규) |
| 10 | 설정 | `/settings` | 부서/사용자 관리, RBAC 역할 설정 |

> **결재 메뉴 없음** — v6.2.0에서 완전 제거.  
> **템플릿 메뉴 없음** — 사이드바에서 제거됨 (v6.5.0 이후). `/templates` 경로는 유지되나 직접 접근 방식.

문서 뷰어 서브 라우트:
- `/documents/[id]` — 전용 문서 뷰어 (좌: 본문, 우: 댓글 패널)
- `/documents/[id]/diff` — 문서 버전 Diff 비교
- `/contract-risk/[id]` — 계약 리스크 분석 상세 결과

---

## 주요 기능 지도

[coverage: high]

### 파일 관리
- 멀티파트 업로드, 50MB 제한
- 공개 범위(scope) 관리: `company`(전사 공개) / `department`(부서 공유) — migration 014
- RLS: 전사 공개 파일은 모든 로그인 사용자 조회 가능; 부서 파일은 같은 부서 + 본인만

### AI 파이프라인
- 파일 업로드 시 텍스트 추출 → 청킹 → pgvector 임베딩 자동 처리
- 시맨틱 검색: `/api/search` — pgvector 유사도 검색 + 텍스트 폴백 + AI 요약

### 문서 생성 및 뷰어
- DOCX / HWPX / XLSX / PPTX / PDF 5개 포맷 생성 지원
- 계약서 템플릿: 시스템구축 / 유지보수 / 소프트웨어구축 (`src/lib/contract-fields.ts`)
- 전자서명: DOCX/HWPX 마커 기반 서명 이미지 삽입
- 전용 뷰어 `/documents/[id]`: 좌측 본문, 우측 댓글 패널

### 문서 댓글 + AI 반영 (v6.4.0)
- `document_comments` 테이블 (migration 015)
- 사내 직원 댓글 작성/삭제 (RLS: 본인 댓글만 삭제 가능)
- 선택한 댓글을 AI에 전달해 문서 본문에 반영 (섹션 삽입 / 새 단락 2가지 모드)
- `/api/documents/[id]/apply-comments` — 댓글 반영 API

### 계약서 리스크 분석 (v6.3.0+)
- `/contract-risk` 페이지: 계약서 파일 업로드 → GPT-4o가 위험 조항 추출 및 등급 분류
- 분석 이력 조회 (`/api/contract-risk/history`)
- 결과 다운로드 (`/api/contract-risk/[id]/download`)

### STT 회의록 생성
- `/api/transcribe` — Whisper-1으로 음성/영상 파일 텍스트 변환
- 변환 후 GPT-4o로 자동 회의록 요약 생성

### 문서 Diff & 버전 비교
- `/documents/[id]/diff` 페이지
- `/api/documents/[id]/diff` — 버전 간 텍스트 차이 계산
- `/api/documents/[id]/diff/analyze` — AI 변경 내용 요약

### 문서 품질 검수
- `/api/quality-check` — 문서 내용 품질 점수 및 개선 제안 반환

### 만료일 알림
- `ExpiryDashboardWidget` — 대시보드에 만료 임박 파일 목록 표시
- `ExpiryAlertProvider` / `ExpiryAlertModal` — 앱 전체 레벨 알림 팝업
- `/api/files/[id]/expiry` — 만료일 설정/조회 API (migration 012)

### 업무일지 (v6.9.0)
- 날짜별 `done/plan/note` 3개 필드 입력
- Lazy auto-lock: 전일 이전 날짜 GET 시 서버에서 자동 잠금
- 부서장/관리자만 잠금 해제 가능 (`/api/work-logs/[date]/unlock`)
- 팀 현황 그리드: manager/admin이 부서 팀원 전체 일지 상황 열람
- 주간 요약 DOCX: GPT-4o로 주간 일지 요약 + 다운로드
- 사이드바: 오늘 일지 미작성 시 빨간 점 배지 표시

### 메모 (v6.9.0)
- 개인 메모, 색상 구분, 고정(pin) 지원
- `/memos` 페이지 — RLS: 본인 메모만 접근

### 문서 자동채우기
- DOCX/HWPX 빈 필드 자동 감지 (빈칸/언더라인/대괄호/플레이스홀더)
- GPT-4o로 필드명 추론 + 사용자 DB 정보(이름/직급/부서/날짜) 자동 매핑
- `/api/autofill/analyze` → 세션 생성, `/api/autofill/generate` → 채워진 파일 다운로드

### 메시지 (채팅)
- DM + 채널 구분, 첨부파일 지원
- Supabase Realtime 구독
- 사이드바에서 미읽음 수 배지 (10초 폴링: `/api/messages/unread`)

---

## 권한 모델

[coverage: high]

`src/lib/permissions.ts` 기준 RBAC 3단계:

| 역할 | 주요 권한 |
|------|-----------|
| `admin` | 부서 생성/편집/삭제, 사용자 역할 변경, 모든 파일 삭제, 전사 파일 공유, 모든 템플릿 편집 |
| `manager` | 소속 부서 편집, 부서 내 사용자 편집, 부서 내 파일 삭제, 파일 공유, 부서 템플릿 편집 |
| `user` | 파일 업로드, 본인 파일 삭제, 본인 파일 공유, 템플릿 사용 |

파일 RLS (scope 기준):
- `scope = 'company'` → 모든 인증 사용자 SELECT 가능
- `scope = 'department'` → 같은 부서 + 본인 업로드만 SELECT 가능
- 업데이트(scope 변경 포함) → `uploaded_by = auth.uid()` 조건 유지

댓글 RLS:
- SELECT: 모든 로그인 사용자
- INSERT: `auth.uid() = user_id` (본인 명의만)
- DELETE: `auth.uid() = user_id` (본인 댓글만)

---

## Key Decisions

[coverage: high]

1. **결재 워크플로우 완전 제거 (v6.2.0)** — `approvals` 테이블 DROP CASCADE, 문서 상태 `submitted/approved/rejected` → `completed`로 일괄 마이그레이션. 사이드바에서도 메뉴 삭제. 이유: 사용 빈도 낮고 댓글+AI 반영 흐름이 검토 프로세스를 대체.

2. **문서 상태 단순화** — 결재 제거 후 문서 status는 `draft` / `completed` 2단계로 정리. 초안은 편집 모달, 완료는 전용 뷰어 페이지(`/documents/[id]`)로 이동.

3. **파일 공개 범위 명시적 컬럼화 (migration 014)** — 기존 부서 공유만 지원하던 구조에서 `scope TEXT CHECK IN ('company','department')` 컬럼 추가. 기본값 `department`. RLS 정책을 scope 기반으로 교체.

4. **댓글 반영 2-모드 설계** — AI 댓글 반영 시 "섹션 삽입"과 "새 단락" 두 가지 삽입 방식을 사용자가 선택. 기존 버전은 보존하고 신규 버전 생성.

5. **STT + 회의록 one-shot** — Whisper-1 변환과 GPT-4o 요약을 단일 API 호출(`/api/transcribe`)에서 순차 처리. 프론트는 결과만 수신.

6. **사이드바 미읽음 배지 폴링 방식** — Supabase Realtime 구독 대신 10초 인터벌 폴링(`/api/messages/unread`) 채택. Realtime 연결 수 절약 목적.

---

## Tech Debt

[coverage: medium]

- `node-hwp ^0.1.0-alpha` — HWPX 파싱 라이브러리가 알파 버전. 복잡한 HWP 포맷 처리 시 불안정할 수 있음.
- `xlsx ^0.18.5` — 해당 버전은 SheetJS 커뮤니티 에디션 마지막 공개 버전. 보안 패치 미지원 가능성.
- 사이드바 미읽음 폴링 — Realtime 대신 10초 폴링 사용 중. 서버 부하 증가 가능성.
- 문서 품질 검수(`/api/quality-check`) — API 라우트만 존재하고 전용 UI 페이지 없음. 문서 뷰어 내 인라인 호출 여부 확인 필요.
- `migration 015`에서 결재 관련 RLS 정책 잔존 여부 별도 확인 필요 (`DROP TABLE approvals CASCADE`로 제거되었으나 정책명 충돌 가능성 낮음).

---

## Gotchas

[coverage: high]

- **`/documents` 이중 동작** — `status = 'draft'`인 문서는 목록에서 클릭 시 편집 모달 열림. `status = 'completed'`는 `/documents/[id]` 전용 뷰어로 이동. 같은 목록 페이지에서 두 UX가 공존.
- **결재 상태 잔류 가능성** — 구버전 데이터에 `submitted/approved/rejected` 상태가 남아있을 경우 migration 015의 UPDATE로 `completed`로 일괄 전환됨. 롤백 시 상태 복구 불가.
- **파일 scope 기본값** — migration 014 적용 전 업로드된 기존 파일은 `DEFAULT 'department'`가 소급 적용됨. 의도치 않게 전사 공개로 변경하려면 수동 UPDATE 필요.
- **계약 리스크 분석 입력** — `/contract-risk` 페이지는 파일 업로드 방식. 기존 `/files`에 저장된 파일을 참조하는 방식이 아니라 별도 업로드임 (중복 저장 가능성).
- **Next.js 16 App Router** — `AGENTS.md` 주의사항: 트레이닝 데이터와 다른 Breaking Change가 있음. `node_modules/next/dist/docs/` 가이드 우선 참조.
- **`@ai-sdk/openai ^3.0.48`** — Vercel AI SDK v3 계열. v2와 API 호환 안 됨. `useChat`, `streamText` 등 v3 문법 사용.

---

## Sources

[coverage: high]

- `/Users/watchers/Desktop/clio-project/package.json`
- `/Users/watchers/Desktop/clio-project/src/components/layout/sidebar.tsx`
- `/Users/watchers/Desktop/clio-project/src/app/(app)/dashboard/page.tsx`
- `/Users/watchers/Desktop/clio-project/src/lib/permissions.ts`
- `/Users/watchers/Desktop/clio-project/supabase/migrations/014_files_scope.sql`
- `/Users/watchers/Desktop/clio-project/supabase/migrations/015_drop_approvals_add_comments.sql`
- `/Users/watchers/Desktop/clio-project/src/app/(app)/contract-risk/page.tsx`
- `/Users/watchers/Desktop/clio-project/src/app/(app)/documents/[id]/diff/page.tsx`
- `/Users/watchers/Desktop/clio-project/src/app/api/quality-check/route.ts`
- `/Users/watchers/Desktop/clio-project/src/components/expiry/ExpiryDashboardWidget.tsx`
