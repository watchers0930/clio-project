# CLIO Wiki Index

**생성일:** 2026-04-12  
**컴파일 버전:** 1  
**프로젝트 버전:** v5.4.0

---

## 토픽 목록

| 파일 | 설명 | 커버리지 |
|------|------|---------|
| [platform-overview.md](topics/platform-overview.md) | CLIO 플랫폼 전체 개요, 기술 스택, 구현 완성도 | high |
| [authentication.md](topics/authentication.md) | 인증/권한 시스템 (Supabase Auth + JWT + Zustand) | high |
| [document-management.md](topics/document-management.md) | 파일 업로드, AI 문서 생성, 템플릿 시스템 | high |
| [approval-workflow.md](topics/approval-workflow.md) | 결재 요청/승인/반려 워크플로우 | high |
| [database.md](topics/database.md) | DB 스키마 전체, RLS 정책, 마이그레이션 목록 | high |
| [ai-features.md](topics/ai-features.md) | AI 파이프라인, 시맨틱 검색, STT 회의록 | high |
| [messaging.md](topics/messaging.md) | 채팅 채널/메시지 시스템 | medium |
| [deployment.md](topics/deployment.md) | Vercel 배포, 환경 변수, 버전 계획 | medium |

---

## 주요 경로 빠른 참조

| 항목 | 경로 |
|------|------|
| 계획서 | `docs/01-plan/features/clio-next-phase.plan.md` |
| DB 스키마 | `supabase/schema.sql` |
| 마이그레이션 | `supabase/migrations/` |
| 타입 정의 | `src/lib/supabase/types.ts` |
| 인증 스토어 | `src/store/auth-store.ts` |
| AI 모듈 | `src/lib/ai/` |
| 렌더러 | `src/lib/renderers/` |
| API Routes | `src/app/api/` |

---

## 현재 기술부채 (계획서 기준)

| 우선순위 | 항목 | 상태 |
|----------|------|------|
| P0 | users.position DB 마이그레이션 | migration 006 존재 (확인 필요) |
| P0 | .env.local.example 완성 | 미완 |
| P1 | localStorage 단일화 (auth-store로) | 미완 |
| P1 | 클라이언트 에러 토스트 시스템 | 미완 |
| P1 | 계약서 템플릿 확장 | 미완 |
| P2 | 실시간 메시지 (Supabase Realtime) | 미완 |
| P2 | 전자서명/도장 삽입 | migration 007 존재, UI 미완 |
| P2 | AI 문서 질의응답 강화 | 미완 |

---

## Concepts

- [개념 디렉토리](concepts/) — 추가 개념 아티클 위치
