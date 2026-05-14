# Wiki Compile Log

## 2026-04-24 — v7.7.0 갱신 (v14)

**프로젝트 버전:** v7.7.0

**업데이트된 토픽:**
- `ai-features` — embed-document.ts 신규, document_embeddings 파이프라인, 통합 검색 알고리즘(title-only + work_logs + 벡터 threshold 0.15), embed-all 백필 API, admin client bypass 결정
- `database` — document_embeddings 테이블(migration 022) + match_document_embeddings RPC + RLS 정책 추가
- `file-management` — 파일관리 UI에서 AI 생성 문서 병합 표시, sourceType 구분, 문서 항목 클릭 동작 차이 설명

**변경된 소스:**
- `supabase/migrations/022_document_embeddings.sql` (신규)
- `src/lib/ai/embed-document.ts` (신규)
- `src/app/api/documents/embed-all/route.ts` (신규)
- `src/app/api/search/route.ts` (title-only 검색, work_logs, document_embeddings 통합)
- `src/app/api/documents/route.ts` (embedDocument fire-and-forget 추가)
- `src/app/api/documents/[id]/route.ts` (content 변경 시 재임베딩)
- `src/app/(app)/files/page.tsx` (AI 생성 문서 병합 로드)

**소스 스캔:** 7개
**변경된 소스:** 7개

---

## 2026-04-24 — v7.5.0 갱신 (v13)

**프로젝트 버전:** v7.5.0

**업데이트된 토픽:**
- `file-management` — 재처리 API(`POST /api/files/[id]/reprocess`) 신규, `maxDuration=60` 파이프라인 확장, `isOwner` UI 가드, process 내부 엔드포인트 API Surface 추가
- `memos` — 그래프 튕김 버그 수정 원인/해법 Gotchas 추가, 버전 v7.5.0 반영

**변경된 소스:**
- `src/app/api/files/[id]/reprocess/route.ts` (신규)
- `src/app/api/files/process/route.ts` (maxDuration=60 추가)
- `src/app/(app)/files/page.tsx` (isOwner 조건 + reprocess 버튼)
- `src/components/memos/MemoGraphView.tsx` (absolute overlay 레이아웃)
- `src/components/memos/MemoGraphSidePanel.tsx` (스타일 개선)
- `src/components/memos/memo-view-modal.tsx` (FormModal 디자인 통일)

**소스 스캔:** 6개
**변경된 소스:** 6개

---

## 2026-04-21 — GAP 분석 후 소스 확인 등록 (v12)

**업데이트된 토픽:** 없음 (memos 토픽 내용 이미 정확)

**신규 소스 등록 (실 구현 파일 확인):**
- `src/components/memos/memo-idea-panel.tsx`
- `src/components/memos/memo-todo-confirm-modal.tsx`
- `src/hooks/useMemoIdea.ts`
- `src/app/api/todos/from-idea/route.ts`

**GAP 분석 결과:** `docs/03-analysis/clio.analysis.md` 생성

---

## 2026-04-21 — clio.design.md UI 구현 반영 (v11)

**업데이트된 토픽:**
- `memos` — clio.design.md 기반 아키텍처 갱신. 신규 컴포넌트(memo-idea-panel, useMemoIdea, memo-graph-controls, memo-todo-confirm-modal) + 클러스터 헐 + 멀티셀렉트 + ClusterInfo 타입 반영

**소스 스캔:** 1개 (memos topic)
**변경된 소스:** 1개

---

## 2026-04-21 — v7.4.0 설계 반영 (v10)

**프로젝트 버전:** v7.4.0 (설계 단계)

**업데이트된 토픽:**
- `memos` — groups API 제거 + idea/route.ts 신규 반영. 아키텍처 전면 갱신 (3종 링크 타입, memoIds 직접 선택)
- `ai-features` — 메모 인사이트 섹션 갱신 (groups/suggest 제거, memos/idea + todos/from-idea 추가)

**신규 파일:**
- `docs/01-plan/features/clio.plan.md` (memos·ai-features 토픽으로 분류)
- `src/app/api/memos/idea/route.ts` (신규 구현)

**제거된 파일 반영:**
- groups/route.ts, groups/suggest/route.ts, memo-clustering.ts, IdeaSuggestPanel.tsx 외 다수

**소스 스캔:** 11개
**변경된 소스:** 11개 (memos 관련 리팩토링 전체)

---

## 2026-04-20 — v7.2.0 갱신 (v9)

**프로젝트 버전:** v7.2.0

**업데이트된 토픽:**
- `memos` — 신규 토픽 생성 (메모 인사이트 전체 기능: 그룹화, 아이디어 제안, 연관 메모, 그래프 뷰)
- `ai-features` — 메모 인사이트 섹션 추가 (임베딩 파이프라인, 클러스터링, 아이디어 제안 SSE, 그래프 뷰, API Surface)
- `database` — migration 021 추가 (memo_embeddings, memo_groups, match_memo_embeddings RPC)
- `platform-overview` — v7.2.0, 메모 인사이트 기능 상세 반영, react-force-graph-2d 스택 추가

**신규 컨셉:**
- `pgvector-multi-purpose` — file_chunks/law_chunks/memo_embeddings 3가지 pgvector 재활용 패턴
- `async-ai-graceful-degradation` — 기본 CRUD + AI 실패 격리 패턴

**소스 스캔:** 26개  
**변경된 소스:** 26개 (migration 021 신규, 메모 AI 관련 파일 다수)

---

## 2026-04-17 — v6.9.0 갱신 (v8)

**프로젝트 버전:** v6.9.0

**업데이트된 토픽:**
- `work-logs` — 신규 토픽 생성 (업무일지 전체 기능)
- `database` — migration 016~020 추가 (memos, autofill_sessions, contract_clause_fixes, law_chunks, work_logs/work_log_attachments), RLS 정책 표 갱신
- `platform-overview` — v6.9.0, 사이드바 10개 메뉴 반영 (업무일지/메모 신규, 템플릿 제거), 신규 기능 섹션 추가
- `ai-features` — 문서 자동채우기(autofill) 섹션 신규, API Surface 테이블 갱신
- `schema.md` — v6.9.0, migration 016~020 추가, 새 테이블 관계도 갱신
- `INDEX.md` — v6.9.0, work-logs 토픽 추가, 최근 변경 갱신

**소스 변경 (v6.5.1 → v6.9.0):**

| 파일/마이그레이션 | 내용 |
|------|------|
| `016_memos.sql` | memos 테이블 신규 |
| `017_autofill_sessions.sql` | autofill_sessions 테이블 신규 |
| `018_contract_clause_fixes.sql` | contract_clause_fixes 테이블 신규 |
| `019_law_chunks.sql` | law_chunks 테이블 + match_law_chunks RPC 신규 |
| `020_work_logs.sql` | work_logs + work_log_attachments 테이블 신규 |
| `src/types/work-log.ts` | 업무일지 타입 정의 신규 |
| `src/hooks/useWorkLog.ts` | 업무일지 상태 관리 훅 신규 |
| `src/components/work-logs/` | WorkLogEditor/Viewer/AttachmentSelector/TeamLogGrid/WeeklySummaryModal |
| `src/app/(app)/work-logs/` | 업무일지 메인 페이지 신규 |
| `src/app/api/work-logs/` | API 라우트 전체 신규 |
| `src/app/(app)/memos/` | 메모 페이지 신규 |
| `src/app/api/memos/` | 메모 CRUD API 신규 |
| `src/app/api/autofill/` | 자동채우기 analyze/generate API 신규 |
| `src/components/layout/sidebar.tsx` | 메뉴 10개로 갱신 (업무일지/메모 추가, 템플릿 제거) |

---

## 2026-04-16 — v6.5.1 갱신 (v7)

**프로젝트 버전:** v6.5.1

**업데이트된 토픽:**
- ai-features — 법령 기반 수정 제안 섹션 신규 추가 (v6.5.0), Storage 버그픽스 반영 (v6.5.1)
- CONTEXT.md — 버전 v6.5.1, 디렉토리 구조 신규 파일 추가 (contract-suggest, laws, contract-risk 컴포넌트)
- INDEX.md — 버전 v6.5.1, 주요 경로 4개 추가, 최근 변경 갱신

**주요 변경 요약 (v6.5.0~v6.5.1):**

| 파일 | 변경 내용 |
|------|----------|
| `src/app/api/contract-risk/analyze/route.ts` | 분석 후 Supabase Storage에 원본 파일 저장 (v6.5.1) |
| `src/app/api/contract-risk/[id]/suggest/route.ts` | 신규 — RAG 법령 검색 + GPT-4o 수정 제안 |
| `src/app/api/contract-risk/[id]/apply/route.ts` | 신규/수정 — `contract-files`→`files` 버킷, 경로 `contract-risk/` 프리픽스 (v6.5.1) |
| `src/app/api/contract-risk/[id]/download/route.ts` | try/catch 추가, `risk_result.items ?? []` 방어 코드 (v6.5.1) |
| `src/lib/contract-suggest/clause-extractor.ts` | 신규 — 조항 발췌 |
| `src/lib/contract-suggest/clause-replacer.ts` | 신규 — 조항 교체 + DOCX/HWPX 생성 |
| `src/lib/laws/law-embedder.ts` | 신규 — 법령 임베딩 |
| `src/lib/laws/law-seed-data.ts` | 신규 — 법령 시드 데이터 |
| `src/components/contract-risk/RiskItemSidebar.tsx` | 신규 — 좌측 항목 목록 컴포넌트 |
| `src/components/contract-risk/SuggestionPanel.tsx` | 신규 — 우측 수정 제안 패널 |
| `src/components/contract-risk/LawReferenceCard.tsx` | 신규 — 관련 법령 카드 |
| `src/components/contract-risk/RevisedClauseBox.tsx` | 신규 — 수정 제안 조항 박스 |
| `src/app/(app)/contract-risk/[id]/page.tsx` | 2컬럼 suggest 모드 UI 추가 |

**스캔 파일:** 15개 신규/수정 파일
**신규 DB 테이블:** `law_chunks` (pgvector, 법령 조문)

---

## 2026-04-13 — v6.4.0 전면 갱신 (v6)

**프로젝트 버전:** v6.4.0

**업데이트된 토픽:**
- document-management (댓글 반영 2모드, diff, 품질검수 추가)
- ai-features (계약리스크, STT, 할일추출, 만료일추출 추가)
- database (migration 009~015 반영, approvals→document_comments)
- platform-overview (결재 제거, 신규 기능 전체 반영)
- approval-workflow (결재 시스템 → 댓글&AI반영 시스템으로 교체)
- **file-management** (신규 토픽 생성)

**소스 스캔:** 60+ 파일
**변경 감지:** v5.4.0 이후 ~50개 파일 변경
**신규 토픽:** file-management

---

## 2026-04-13 — v6.4.0 댓글 반영 고도화 (v5)

**프로젝트 버전:** v6.4.0  
**갱신 아티클:**

| 파일 | 변경 내용 |
|------|----------|
| `CONTEXT.md` | 버전 v6.4.0, 댓글 반영 2모드 설명, 디렉토리 구조 신규 파일 3개 추가 |
| `INDEX.md` | 버전 v6.4.0, 컴파일v5, 토픽 설명 갱신, 주요 경로 3개 추가, 기술부채 P3 추가 |
| `topics/document-management.md` | coverage sources 갱신, 댓글 시스템 섹션 v6.4.0 재작성 (CommentReflectModal/parse-sections/apply-comments API 상세), 문서목록 스냅샷 필터 추가, API Routes 표 apply-comments 항목 추가, Sources 갱신 |
| `topics/ai-features.md` | 댓글 부분 반영 AI 섹션 신규 추가 (insert/append 모드 프롬프트 전략, 공통 GPT-4o 설정 상세) |

**신규 소스 파일 반영:**
- `src/components/documents/CommentReflectModal.tsx` — 3-step 모달 (select/insert/append)
- `src/lib/utils/parse-sections.ts` — parseSections / extractSectionContent / replaceSectionContent
- `src/app/api/documents/[id]/apply-comments/route.ts` — insert/append 이중 모드 API

---

## 2026-04-13 — v6.3.0 결재 삭제 + 댓글/AI 반영 시스템 반영 (v4)

**프로젝트 버전:** v6.3.0  
**갱신 아티클:**

| 파일 | 변경 내용 |
|------|----------|
| `CONTEXT.md` | 버전 v6.3.0, 결재 삭제 공지, 댓글 반영 시스템 설명, 디렉토리 구조 갱신 |
| `INDEX.md` | 버전 갱신, approval-workflow 삭제 표기, document-management 설명 갱신, 기술부채 갱신 |
| `topics/platform-overview.md` | 버전 v6.3.0, 결재 삭제 반영, 댓글/뷰어 완성 표기 |
| `topics/document-management.md` | 전용 뷰어 페이지, 댓글 시스템, reflect API 플로우, 문서 상태(draft/completed) 상세 추가 |
| `topics/approval-workflow.md` | 삭제 공지 문서로 전환, 삭제된 항목 목록 + 대체 시스템 안내 |
| `topics/database.md` | document_comments 테이블 추가, approvals 삭제 표기, RLS 테이블 갱신, 마이그레이션 015 추가 |

---

## 2026-04-13 — v5.13.0 버그수정 + 파일 공개범위 반영 (v3)

**프로젝트 버전:** v5.13.0  
**갱신 아티클:**

| 파일 | 변경 내용 |
|------|----------|
| `topics/document-management.md` | 파일 scope(전사/부서) 추가, 결재 뷰어 서명 수정, DOCX/HWPX inline 렌더링 |

---

## 2026-04-12 — P2 구현 반영 갱신 (v2)

**프로젝트 버전:** v5.5.0  
**갱신 아티클:**

| 파일 | 변경 내용 |
|------|----------|
| `CONTEXT.md` | 버전 v5.5.0, 기술부채 해결 현황 업데이트 |
| `topics/messaging.md` | P2-1 Realtime 전환 완료 반영 (폴링 → Realtime) |
| `topics/document-management.md` | P2-2 전자서명 삽입 완료 / P1-3 계약서 3종 완료 반영 |
| `topics/ai-features.md` | P2-3 AI Q&A 채팅 구현 완료 반영 |

---

## 2026-04-12 — 초기 컴파일 (v1)

**실행 모드:** codebase  
**프로젝트 버전:** v5.4.0  
**소스 읽기 완료:**

- README.md, CLAUDE.md, AGENTS.md
- docs/01-plan/features/clio-next-phase.plan.md
- package.json, supabase/schema.sql
- supabase/migrations/004_approval_workflow.sql
- supabase/migrations/007_users_signature.sql
- src/lib/supabase/types.ts, src/store/auth-store.ts
- src/app/api/, src/lib/ai/, src/lib/renderers/, src/lib/supabase/

**생성된 아티클:**

| 파일 | 커버리지 |
|------|---------|
| topics/platform-overview.md | high |
| topics/authentication.md | high |
| topics/document-management.md | high |
| topics/approval-workflow.md | high (→ v6.3.0에서 삭제 공지로 전환) |
| topics/database.md | high |
| topics/ai-features.md | high |
| topics/messaging.md | medium |
| topics/deployment.md | medium |
| INDEX.md, schema.md, CONTEXT.md | - |

**총 아티클:** 8개 토픽 + 3개 메타 문서
