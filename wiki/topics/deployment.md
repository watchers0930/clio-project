# 배포 구성

[coverage: medium -- 2 sources: clio-next-phase.plan.md, package.json]

---

## Purpose

CLIO는 Vercel에 배포되며, Supabase는 별도 클라우드 인스턴스를 사용한다.

---

## 배포 정보

| 항목 | 값 |
|------|-----|
| 배포 URL | https://clioai.vercel.app |
| GitHub | https://github.com/watchers0930/clio-project |
| Supabase 프로젝트 | cxsaohiwkeebgshxcypa (watchers0930's Project) |
| Vercel 계정 | watchers0930 |

---

## 배포 명령

```bash
# 반드시 deploy 스크립트 사용 (npx vercel 직접 실행 금지)
deploy clio
# 스크립트: ~/scripts/deploy.sh
```

---

## 환경 변수

| 변수 | 필수 | 설명 |
|------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | 필수 | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 필수 | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | 필수 | 서비스 롤 키 (admin 작업용) |
| `OPENAI_API_KEY` | 필수 | OpenAI GPT-4o + Whisper |
| `INTERNAL_API_SECRET` | 필수 | 내부 API 인증 시크릿 |
| `JWT_SECRET` | 필수 | JWT 서명 키 |

**주의:** `.env.local.example`에 `OPENAI_API_KEY`, `INTERNAL_API_SECRET`가 누락되어 있었음 (P0-2 수정 예정).

---

## Next.js 설정

- Next.js 16.2.1 사용 (App Router)
- **AGENTS.md 경고:** "This is NOT the Next.js you know" — 브레이킹 체인지 있음, `node_modules/next/dist/docs/` 반드시 확인
- Tailwind CSS v4 (`@tailwindcss/postcss` 사용)

---

## 빌드 스크립트

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint"
}
```

---

## 버전 계획

| 버전 | 내용 |
|------|------|
| v5.1.0 | P0 버그 수정 (position 컬럼 + env) |
| v5.2.0 | P1 완성 (localStorage 단일화 + 에러 토스트 + 계약서 확장) |
| v5.5.0 | P2 완성 (실시간 메시지 + 전자서명 + AI Q&A) |
| v6.0.0 | P3 고도화 |

---

## Sources

- `/Users/watchers/Desktop/clio-project/docs/01-plan/features/clio-next-phase.plan.md`
- `/Users/watchers/Desktop/clio-project/package.json`
- `/Users/watchers/Desktop/clio-project/AGENTS.md`
