# CLIO 컨텍스트 요약

> AI 에이전트가 이 프로젝트에서 작업 시 먼저 읽어야 할 핵심 맥락 문서

**생성일:** 2026-04-12 | **최종 갱신:** 2026-04-20 | **버전:** v7.2.0 | **배포:** https://clioai.vercel.app

---

## 이 프로젝트가 무엇인가

CLIO는 **기업 내부용 RAG 기반 AI 문서관리 + 협업 시스템**이다.

- 파일 업로드 → 텍스트 추출 → pgvector 임베딩 → GPT-4o 문서 생성 파이프라인
- 문서 댓글 시스템 + AI 반영 2가지 모드:
  - `reflect` — 전체 재생성 + 스냅샷 저장 (version_number 증가)
  - `apply-comments` — 섹션 삽입 or 새 단락 추가 (부분 반영, **자동 스냅샷 + version_number 증가**)
- 전용 문서 뷰어 페이지 (`/documents/[id]`): 좌측 문서 본문 + 우측 댓글 패널 항상 노출
- **계약서 리스크 분석 + 법령 기반 수정 제안** (v6.5.0):
  - 25개 항목 분석 → `suggest` API로 RAG 법령 검색 + GPT-4o 조항 수정 제안
  - 2컬럼 UI: 좌측 항목 목록(체크박스) + 우측 수정 제안 패널
  - 수정 적용 후 DOCX/HWPX 다운로드 (`apply` API)
- 사내 메시지/채팅 (채널 + DM)
- 일정/할일 (캘린더)
- 5가지 포맷 문서 다운로드 (DOCX/HWPX/XLSX/PPTX/PDF)

> ⚠️ **결재(approvals) 시스템은 v6.3.0에서 완전 삭제됨.** 관련 테이블·API·UI 전체 제거. `approvals` 사이드바 메뉴도 없음.

---

## 핵심 기술 스택

```
Next.js 16 (App Router) + React 19 + Tailwind CSS v4
Supabase (PostgreSQL + pgvector + Storage + Auth)
OpenAI GPT-4o + Whisper-1
Zustand 5 (전역 상태관리)
Vercel (배포)
```

---

## 파일 수정 시 반드시 알아야 할 것

### 1. Next.js 버전 주의
AGENTS.md: "This is NOT the Next.js you know" — Next.js 16에는 브레이킹 체인지가 있다.  
코드 작성 전 `node_modules/next/dist/docs/` 확인 필수.

### 2. RLS 정책 충돌 주의
API Route에서 Supabase를 호출할 때, 사용하는 클라이언트에 따라 RLS 적용 여부가 다르다:
- `createClient()` (client.ts): RLS 적용 (anon key)
- `createServerClient()` (server.ts): RLS 적용 (쿠키 세션)
- `createAdminClient()` (admin.ts): RLS 우회 (service role key)
→ API 수정 시 RLS 정책 충돌 반드시 사전 확인

### 3. 인증 상태 관리
- Zustand `useAuthStore` 사용 (persist: token만 영속화)
- `localStorage.getItem('clio_user')` 직접 호출 금지

### 4. 환경 변수
```
NEXT_PUBLIC_SUPABASE_URL        (필수)
NEXT_PUBLIC_SUPABASE_ANON_KEY   (필수)
SUPABASE_SERVICE_ROLE_KEY        (필수, admin 작업)
OPENAI_API_KEY                   (필수, AI 기능)
INTERNAL_API_SECRET              (필수, 내부 API 보안)
JWT_SECRET                       (필수, 인증)
```

### 5. 배포
```bash
deploy clio   # ~/scripts/deploy.sh 사용 (npx vercel 직접 실행 금지)
```

---

## 현재 알려진 기술부채 (즉시 참고)

| 심각도 | 항목 | 영향 | 상태 |
|--------|------|------|------|
| P0 | .env.local.example에 OPENAI_API_KEY 누락 | 신규 환경 AI 기능 불가 | 미해결 |
| P2 | 문서 목록 모달에 viewerComments 잔재 코드 | 완료 문서는 전용 페이지로 이동하므로 불필요 | 미해결 |

---

## 디렉토리 구조 요약

```
src/
├── app/
│   ├── (auth)/          # 로그인, 회원가입
│   ├── (app)/           # 메인 앱 (인증 필요)
│   │   ├── dashboard, files, documents, documents/[id]
│   │   ├── messages, search, schedule, settings
│   │   └── contract-risk/[id]  ← v6.5.0 2컬럼 수정 제안 UI
│   ├── api/             # API Route Handlers
│   │   ├── documents/[id]/
│   │   │   ├── apply-comments/route.ts  ← v6.4.0 신규 (부분 반영)
│   │   │   └── reflect/route.ts         ← 전체 재생성 + 스냅샷
│   │   └── contract-risk/
│   │       ├── analyze/route.ts  ← v6.5.1 Supabase Storage 업로드 추가
│   │       ├── [id]/suggest/route.ts  ← v6.5.0 신규 (RAG + 수정 제안)
│   │       ├── [id]/apply/route.ts    ← v6.5.0/6.5.1 버킷 경로 수정
│   │       └── [id]/download/route.ts ← v6.5.1 try/catch + 방어 코드 추가
│   └── share/           # 외부 공유
├── lib/
│   ├── ai/              # AI 파이프라인 모듈
│   ├── supabase/        # DB 클라이언트 + 타입
│   ├── renderers/       # 문서 포맷 렌더러
│   ├── contract-suggest/          ← v6.5.0 신규
│   │   ├── clause-extractor.ts    # 조항 추출
│   │   └── clause-replacer.ts     # 조항 교체 + 파일 생성
│   ├── laws/                      ← v6.5.0 신규
│   │   ├── law-embedder.ts        # 법령 임베딩
│   │   └── law-seed-data.ts       # 법령 시드 데이터
│   ├── utils/
│   │   └── parse-sections.ts  ← v6.4.0 신규 (섹션 파싱 유틸)
│   ├── contract-fields.ts
│   └── permissions.ts
├── components/
│   ├── documents/
│   │   ├── CommentReflectModal.tsx  ← v6.4.0 신규 (반영 모드 선택 모달)
│   │   └── DocumentCommentPanel.tsx ← documentContent prop 추가
│   └── contract-risk/             ← v6.5.0 신규
│       ├── RiskItemSidebar.tsx     # 좌측 항목 목록
│       ├── SuggestionPanel.tsx     # 우측 수정 제안 패널
│       ├── LawReferenceCard.tsx    # 관련 법령 카드
│       └── RevisedClauseBox.tsx    # 수정 제안 조항 박스
├── store/
│   └── auth-store.ts    # Zustand 인증 스토어
supabase/
├── schema.sql
├── migrations/          # 015개 마이그레이션
└── seed.sql
```

---

## Wiki 전체 토픽 목록

- [platform-overview.md](topics/platform-overview.md) — 전체 개요, 권한 모델
- [authentication.md](topics/authentication.md) — 인증/권한
- [document-management.md](topics/document-management.md) — 문서 생성, diff, 품질검수, AI 댓글 반영
- [approval-workflow.md](topics/approval-workflow.md) — 댓글 & AI 반영 시스템 (구 결재 대체)
- [database.md](topics/database.md) — DB 스키마 + RLS (migration 001~015)
- [ai-features.md](topics/ai-features.md) — GPT-4o, 계약리스크, STT, 할일추출, 만료일추출, **법령 기반 수정 제안(v6.5.0)**
- [file-management.md](topics/file-management.md) — 파일 업로드, scope, 만료일 알림, 공유 링크
- [messaging.md](topics/messaging.md) — 메시지/채널
- [deployment.md](topics/deployment.md) — 배포 구성
- [work-logs.md](topics/work-logs.md) — 업무일지 (날짜별 일지, 잠금, 팀 현황, 주간 요약 DOCX)
- [memos.md](topics/memos.md) — 메모 CRUD + AI 그룹화 + 아이디어 제안 + 연관 메모 + 그래프 뷰

## Concepts

- [pgvector-multi-purpose.md](concepts/pgvector-multi-purpose.md) — pgvector 3가지 재활용 패턴
- [async-ai-graceful-degradation.md](concepts/async-ai-graceful-degradation.md) — AI 실패 격리 패턴
