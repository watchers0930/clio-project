# Wiki Compile Log

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
