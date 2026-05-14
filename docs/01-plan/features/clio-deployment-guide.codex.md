# CLIO 배포 가이드 (Codex 작업용)

**작성일:** 2026-04-24  
**대상 프로젝트:** `/Users/watchers/Desktop/clio-project`  
**배포 대상:** Vercel (`clio-project`)

---

## 1. 목적

이 문서는 Codex가 이 저장소에서 직접 작업한 뒤,  
로컬 검증을 거쳐 Vercel에 직접 배포할 수 있도록 절차를 정리한 운영 문서다.

핵심 목표는 아래 두 가지다.

- 작업 후 안전하게 Preview 배포를 수행할 것
- 검증 완료 후 Production 배포를 수행할 것

---

## 2. 현재 배포 전제

이 프로젝트는 이미 Vercel에 연결되어 있다.

확인 근거:
- `.vercel/project.json` 존재
- `projectName: clio-project`
- `npx vercel --version` 사용 가능

현재 프로젝트 특성:
- Next.js 16 기반
- Vercel 배포 구조
- Supabase + OpenAI 환경변수 필요
- `src/proxy.ts` 기반 인증 게이트 사용

주의:
- `.vercel` 폴더는 공유용 문서가 아니라 로컬 링크 정보다.
- 환경변수 값은 저장소에 직접 쓰지 않는다.
- 워크스페이스 상위(`/Users/watchers`)에도 `package-lock.json`이 있어 Vercel 로그에서 `lockfile root` 경고가 보일 수 있다.
- 현재 저장소는 `next.config.ts`에서 `turbopack.root = process.cwd()`를 지정해 앱 루트를 고정한다.

---

## 3. 배포 전에 반드시 확인할 것

### 3-1. 환경변수

Vercel 프로젝트에 아래 환경변수가 등록되어 있어야 한다.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `INTERNAL_API_SECRET`

참고 파일:
- `.env.local.example`

중요:
- 로컬 `.env.local`이 있다고 해서 Vercel 배포 환경에 자동 반영되지 않는다.
- 실제 운영 배포는 Vercel Dashboard 또는 `vercel env` 기준으로 관리해야 한다.

### 3-2. 워크트리 상태

이 저장소는 종종 다른 변경사항이 섞여 있을 수 있다.  
배포 전에는 반드시 아래를 확인한다.

- 이번 작업 외 변경이 섞여 있는지
- 사용자가 이미 수정 중인 파일이 포함되어 있는지
- 배포 대상이 의도한 변경만 포함하는지

권장 확인 명령:

```bash
git -C /Users/watchers/Desktop/clio-project status --short
git -C /Users/watchers/Desktop/clio-project diff --stat
```

### 3-3. 로컬 빌드 가능 여부

배포 전 최소한 아래를 확인한다.

```bash
cd /Users/watchers/Desktop/clio-project
npm run build
```

주의:
- `next.config.ts`에서 `typescript.ignoreBuildErrors = true` 상태다.
- 즉 `build`가 통과해도 타입 문제가 숨어 있을 수 있다.
- 따라서 변경한 화면/라우트는 코드 레벨로 추가 검토가 필요하다.

---

## 4. 권장 배포 절차

## Step 1. 현재 변경 범위 확인

먼저 이번 작업에 포함되는 파일이 맞는지 확인한다.

```bash
git -C /Users/watchers/Desktop/clio-project status --short
```

체크 포인트:
- 이번 작업 파일만 포함됐는가
- 사용자 작업 중인 unrelated 변경을 실수로 배포하지 않는가
- Vercel Preview 로그에서 `lockfile root`, `middleware deprecated` 경고가 다시 나타나는가

## Step 2. 로컬 검증

최소 검증:

```bash
cd /Users/watchers/Desktop/clio-project
npm run build
```

선택 검증:

```bash
cd /Users/watchers/Desktop/clio-project
npm run dev
```

브라우저 또는 curl로 직접 봐야 할 화면:
- `/login`
- `/dashboard`
- 이번에 수정한 주요 화면

## Step 3. Preview 배포

먼저 Preview로 올린다.

```bash
cd /Users/watchers/Desktop/clio-project
npx vercel
```

기대 결과:
- Preview URL 발급
- 실제 배포본에서 주요 화면 확인 가능

Preview에서 반드시 확인할 것:
- 로그인 진입
- 수정한 화면 렌더링
- 콘솔 에러 여부
- 핵심 API 호출 실패 여부

## Step 4. Preview 검증 후 Production 배포

문제가 없을 때만 운영 배포한다.

```bash
cd /Users/watchers/Desktop/clio-project
npx vercel --prod
```

배포 후 확인:
- Production URL 접속
- 주요 진입 화면 점검
- 수정 기능 수동 테스트

---

## 5. Codex가 배포할 때의 행동 규칙

Codex는 배포 전 아래 규칙을 반드시 따른다.

1. 현재 워크트리가 더럽다면 어떤 변경이 포함되는지 먼저 점검한다.
2. 사용자가 만든 다른 변경을 임의로 되돌리지 않는다.
3. Preview 없이 바로 Production 배포하지 않는다.
4. 로컬 검증 또는 최소한 코드 검토 결과를 먼저 정리한다.
5. 배포 후에는 URL과 점검 결과를 사용자에게 짧게 보고한다.

---

## 6. Codex용 실행 프롬프트

아래 프롬프트를 그대로 사용하면 된다.

```text
/Users/watchers/Desktop/clio-project에서 현재 변경사항을 확인하고, 이번 작업 범위만 배포 대상인지 먼저 검토해줘.

그 다음 아래 순서대로 진행해줘.
1. git status로 변경 파일 확인
2. npm run build로 로컬 검증
3. 문제 없으면 npx vercel로 Preview 배포
4. Preview URL 기준으로 수정한 핵심 화면 점검
5. 이상 없으면 npx vercel --prod로 운영 배포

주의사항:
- 사용자가 만든 다른 변경은 되돌리지 말 것
- 배포 전 어떤 변경이 포함되는지 요약할 것
- 테스트를 못 하면 이유를 말할 것
- 최종 응답에는 Preview URL, Production URL, 검증 결과를 포함할 것
```

---

## 7. 운영상 주의사항

### 7-1. 이 프로젝트는 빌드 통과만으로 안전하지 않다

이유:
- TypeScript build error 무시 설정 존재
- Supabase/OpenAI 환경변수 의존도 높음
- 일부 기능은 런타임 API 호출을 해야 실제 상태를 확인할 수 있음

즉, 배포 기준은 아래 세 가지를 함께 봐야 한다.

- build 통과
- 화면 렌더링 확인
- 핵심 플로우 수동 점검

### 7-2. 배포 전에 특히 조심할 기능

- 파일 업로드/처리
- 문서 생성
- AI 검색
- 계약 리스크 분석
- 인증/로그인

이 기능들은 환경변수, Supabase, OpenAI 호출에 직접 연결된다.

---

## 8. 추천 배포 운영 방식

가장 안전한 운영 방식:

1. Codex가 기능 수정
2. Codex가 로컬 build 확인
3. Codex가 Preview 배포
4. 사용자가 Preview 확인
5. Codex가 Production 배포

이 흐름을 기본으로 삼는다.

---

## 9. 한줄 요약

Codex는 이 프로젝트에서 작업 후 바로 배포할 수 있다.  
다만 항상 `변경 범위 확인 -> 로컬 검증 -> Preview 배포 -> 확인 -> Production 배포` 순서를 지켜야 한다.
