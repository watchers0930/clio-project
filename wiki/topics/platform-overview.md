# CLIO 플랫폼 전체 개요

[coverage: high -- 4 sources: clio-next-phase.plan.md, package.json, schema.sql, src/lib/supabase/types.ts]

---

## Purpose

CLIO는 기업 내부용 **RAG 기반 AI 문서관리 시스템**이다.  
파일 업로드 → 텍스트 추출 → 벡터 임베딩 → AI 문서 생성으로 이어지는 전 파이프라인이 실운영 상태이며, 결재 워크플로우·메시지·일정·할일까지 포괄하는 통합 사내 협업 플랫폼이다.

- **배포 URL:** https://clioai.vercel.app
- **현재 버전:** v5.4.0 (package.json 기준)
- **GitHub:** https://github.com/watchers0930/clio-project

---

## Architecture

```
Next.js 16 (App Router)
  ├── src/app/(auth)/          # 로그인/회원가입 라우트
  ├── src/app/(app)/           # 메인 앱 라우트 (인증 필요)
  │   ├── dashboard/
  │   ├── files/
  │   ├── documents/
  │   ├── templates/
  │   ├── approvals/
  │   ├── messages/
  │   ├── search/
  │   ├── schedule/
  │   └── settings/
  ├── src/app/api/             # API Route Handlers
  └── src/app/share/           # 외부 공유 라우트
  
src/lib/
  ├── ai/                      # AI 파이프라인 모듈
  ├── supabase/                # Supabase 클라이언트 및 타입
  ├── renderers/               # 문서 포맷 렌더러 (DOCX/HWPX/XLSX/PPTX/PDF)
  ├── contract-fields.ts       # 계약서 템플릿 스키마
  ├── permissions.ts           # RBAC 권한 로직
  └── constants/               # 앱 상수

src/store/
  └── auth-store.ts            # Zustand 전역 인증 상태

supabase/
  ├── schema.sql               # 기본 스키마
  ├── migrations/              # 순번 마이그레이션 파일
  └── seed.sql                 # 초기 시드 데이터
```

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트엔드 | Next.js 16.2.1, React 19, Tailwind CSS v4 |
| 상태관리 | Zustand 5 (persist 미들웨어) |
| 백엔드/DB | Supabase (PostgreSQL + pgvector + Storage + Auth) |
| AI | OpenAI GPT-4o (`@ai-sdk/openai`), Whisper-1 STT |
| 문서 생성 | docx, adm-zip (HWPX), exceljs (XLSX), pptxgenjs (PPTX), jspdf (PDF) |
| 파일 파싱 | mammoth (DOCX), pdf-parse (PDF), xlsx, cheerio |
| 인증 | Supabase Auth + JWT (jsonwebtoken) + bcryptjs |
| 배포 | Vercel |

---

## 구현 완성도 (v5.4.0 기준)

| 모듈 | 완성도 | 비고 |
|------|--------|------|
| 인증 (Auth) | 완성 | Supabase Auth + 쿠키 세션 |
| 파일 관리 | 완성 | 멀티파트 업로드, 50MB 제한, NFC 정규화 |
| AI 파이프라인 | 완성 | 텍스트 추출 → 청킹 → pgvector 임베딩 |
| 시맨틱 검색 | 완성 | pgvector + 텍스트 폴백 + AI 요약 |
| 멀티포맷 문서 생성 | 완성 | DOCX/HWPX/XLSX/PPTX/PDF 전체 지원 |
| 결재 워크플로우 | 완성 | 요청/승인/반려, 결재함 UI |
| 메시지 (채팅) | 완성 | DM/채널, 첨부파일, 폴링 방식 |
| 일정/할일 | 완성 | 월간 캘린더, CRUD |
| 설정 (부서/사용자) | 완성 | RBAC, 역할 관리 |
| STT 회의록 | 완성 | Whisper-1 + 자동 요약 |
| 계약서 입력폼 | 완성 | 시스템구축계약서 스키마, 직접 치환 렌더러 |

---

## Sources

- `/Users/watchers/Desktop/clio-project/docs/01-plan/features/clio-next-phase.plan.md`
- `/Users/watchers/Desktop/clio-project/package.json`
- `/Users/watchers/Desktop/clio-project/supabase/schema.sql`
- `/Users/watchers/Desktop/clio-project/src/lib/supabase/types.ts`
