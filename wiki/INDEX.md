# CLIO Wiki Index

**최종 컴파일:** 2026-04-17  
**프로젝트 버전:** v6.9.0

---

## 토픽 목록

| 파일 | 설명 | 커버리지 | 상태 |
|------|------|---------|------|
| [platform-overview.md](topics/platform-overview.md) | CLIO 플랫폼 전체 개요, 기술 스택, 화면 구성(10개 메뉴), 권한 모델 | high | active |
| [authentication.md](topics/authentication.md) | 인증/권한 시스템 (Supabase Auth + JWT + Zustand) | high | active |
| [document-management.md](topics/document-management.md) | 문서 생성, 뷰어, diff, AI 댓글 반영(insert/append), 품질검수 | high | active |
| [approval-workflow.md](topics/approval-workflow.md) | 댓글 & AI 반영 시스템 (⚠️ 구 결재 시스템 v6.2.0 제거됨) | high | active |
| [ai-features.md](topics/ai-features.md) | GPT-4o, 계약 리스크 분석, 법령 수정 제안, STT, 할일 추출, 만료일 추출, 품질검수, **문서 자동채우기(v6.7.0+)** | high | active |
| [database.md](topics/database.md) | DB 스키마, RLS 정책, 마이그레이션 001~020 | high | active |
| [file-management.md](topics/file-management.md) | 파일 업로드, scope 관리, 만료일 알림, 외부 공유 링크, 벡터화 파이프라인 | high | active |
| [messaging.md](topics/messaging.md) | 채팅 채널/메시지 시스템 | medium | active |
| [deployment.md](topics/deployment.md) | Vercel 배포, 환경 변수, deploy.sh | medium | active |
| [work-logs.md](topics/work-logs.md) | 업무일지 (날짜별 done/plan/note, 잠금, 팀 현황, 주간 요약 DOCX) | high | **new** |

---

## 주요 경로 빠른 참조

| 항목 | 경로 |
|------|------|
| DB 스키마 | `supabase/schema.sql` |
| 마이그레이션 | `supabase/migrations/` (020개) |
| 타입 정의 | `src/lib/supabase/types.ts` |
| 인증 스토어 | `src/store/auth-store.ts` |
| AI 모듈 | `src/lib/ai/` |
| 렌더러 | `src/lib/renderers/` |
| API Routes | `src/app/api/` |
| 문서 뷰어 | `src/app/(app)/documents/[id]/page.tsx` |
| 댓글 패널 | `src/components/documents/DocumentCommentPanel.tsx` |
| 반영 모달 | `src/components/documents/CommentReflectModal.tsx` |
| 댓글 반영 API | `src/app/api/documents/[id]/apply-comments/route.ts` |
| 계약 리스크 분석 | `src/lib/ai/contract-risk-analyzer.ts` |
| 법령 기반 수정 제안 | `src/lib/contract-suggest/`, `src/lib/laws/` |
| 수정 제안 API | `src/app/api/contract-risk/[id]/suggest/route.ts` |
| 수정 적용 API | `src/app/api/contract-risk/[id]/apply/route.ts` |
| STT 변환 | `src/app/api/transcribe/route.ts` |
| 파일 관리 | `src/app/(app)/files/page.tsx` |
| 만료일 알림 | `src/components/expiry/ExpiryAlertProvider.tsx` |

---

## 현재 기술부채

| 우선순위 | 항목 | 상태 |
|----------|------|------|
| P0 | `.env.local.example`에 `OPENAI_API_KEY` 누락 | 미해결 |
| P1 | `document_comments` 테이블이 `types.ts` 미등록 → Supabase 타입 추론 불가 | 미해결 |
| P2 | migration 012가 ALTER하는 테이블명(`schedules`)이 schema.sql의 `events`와 불일치 가능 | 확인 필요 |
| P2 | `apply-comments` API가 `version_number` 미증가 → 버전 패널 이력 미기록 | 미해결 |
| P3 | 레거시 `/reflect` API가 `/apply-comments`와 공존 중 | 미해결 |

---

## Concepts

- [concepts/](concepts/) — 추가 개념 아티클 위치

---

## 최근 변경

- **2026-04-17**: v6.9.0 갱신 — 업무일지(work-logs) 토픽 신규, 메모/자동채우기 기능 추가, migration 016~020, 사이드바 10개 메뉴 반영
- **2026-04-16**: v6.5.1 갱신 — 법령 기반 수정 제안(v6.5.0), Storage 버그픽스(v6.5.1), ai-features 섹션 추가
- **2026-04-13**: v6.4.0 전면 갱신 — 결재→댓글/AI반영, 계약리스크, STT, diff, 품질검수, 만료일, 파일scope 반영
- **2026-04-13**: `file-management` 토픽 신규 생성
- **2026-04-12**: 초기 컴파일 (v5.4.0)
